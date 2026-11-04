import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { rememberCommand, rememberObjectChoice } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_FRUIT_JUICE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { planInput } from './support/planned-input.js';
import { freshTurnRoom } from './support/playable-room.js';

// C do_name.c:docallcmd() takes a queued key as its category, so a saved
// inventory letter can select a different naming action during #repeat.
void test('repeating a type-call replays the saved letter as the naming category', async t => {
    freshTurnRoom({ flags: { tips: false } });
    const potion = await addInventoryObject(POT_FRUIT_JUICE, { invlet: 'd', dknown: true });
    assert.equal(potion.invlet, 'd');
    const input = resetInputState();

    let discoMenu = '';
    input.beforeRead = () => {
        discoMenu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    // 'C' opens the naming menu, 'n' names an object type, 'd' picks the
    // potion, then the call text is typed and accepted.
    planInput(input, t, [
        { prompt: /What do you want to name\?/, keys: 'n' },
        { prompt: /What do you want to call\?/, keys: 'd' },
        { prompt: /Call a potion of fruit juice:/, keys: 'wide\r' },
        { prompt: /Pick an object type to name/, keys: '\x1b' },
    ]);
    await rhack('C'.charCodeAt(0));
    assert.doesNotMatch(discoMenu, /Pick an object type to name/);

    // The repeat consumes the saved 'd' as the category, which is the
    // discoveries-list rename.
    await rhack('\x01'.charCodeAt(0));
    assert.match(discoMenu, /Pick an object type to name/);
    assert.equal(game.context.move, 0);
});

void test('repeating an individual naming quietly does nothing', async t => {
    freshTurnRoom({ flags: { tips: false } });
    const potion = await addInventoryObject(POT_FRUIT_JUICE, { invlet: 'c', dknown: true });
    assert.equal(potion.invlet, 'c');
    const input = resetInputState();

    planInput(input, t, [
        { prompt: /What do you want to name\?/, keys: 'y' },
        { prompt: /What do you want to name\? \[.*\]/, keys: 'c' },
        { prompt: /What do you want to name this potion/, keys: 'wide\r' },
    ]);
    await rhack('C'.charCodeAt(0));

    // The saved letter 'c' is no naming category, so the switch default
    // repeats nothing: no menu opens and no time is spent.
    const before = game._pending_message;
    await rhack('\x01'.charCodeAt(0));
    assert.equal(game._pending_message, before);
    assert.ok(!/What do you want to name\?/.test(game._pending_message ?? ''));
    assert.equal(game.context.move, 0);
});

void test('a non-key naming repeat skips the menu and discards canned commands', async t => {
    const input = freshTurnRoom();
    const naming = game.commandBindings.lookup('C'.charCodeAt(0));
    assert.ok(naming);
    rememberCommand(naming, false);
    rememberObjectChoice('a'.charCodeAt(0), 2);
    // Resume a repeat with a count where docallcmd() expects a category.
    game._inDoAgain = true;
    game._cannedCommands = [{ kind: 'command', name: 'wait' }];
    planInput(input, t, []);

    try {
        await rhack(0);
    } finally {
        game._inDoAgain = false;
    }

    assert.equal(game.context.move, 0);
    const screen = () => requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.doesNotMatch(screen(), /What do you want to name\?/);

    // The queued wait must not replace the next command.
    await rhack(':'.charCodeAt(0));
    assert.equal(game.context.move, 0);
    await flush_screen(1);
    assert.match(screen(), /You see no objects here\./);
});
