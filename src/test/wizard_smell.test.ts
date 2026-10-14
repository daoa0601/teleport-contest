import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('#wizsmell sniffs an unseen monster and removes a stale invisible marker from an empty square', async () => {
    const level = freshObjectRoom({ flags: { debug: true, tips: false } });
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 11, 10);
    dog.minvis = true;
    level.requireAt(12, 10).remembered_glyph = { kind: 'invisible', ch: 'I', color: 8 };
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /smell|sniff|monster/, limit: 8 });
    const pager = input.display;
    assert.ok(pager);
    const choices = [...'l.l.\x1b'];
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--')) return pager.readKey();
            const choice = choices.shift();
            assert.ok(choice, `Unexpected input request: ${game._pending_message}`);
            return choice.charCodeAt(0);
        },
    };

    await runExtendedCommand('wizsmell');

    assert.ok(messages.some(message => message.includes('You notice a dog smell.')));
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    assert.notEqual(level.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(game.context.move, 0);
});

void test('#wizsmell reports when the current form cannot detect odors', async () => {
    freshObjectRoom({ flags: { debug: true }, hero: {
        umonnum: nameToMonster('floating eye'), umonster: nameToMonster('cave dweller'),
    } });
    requirePlayingGame(game);

    await runExtendedCommand('wizsmell');

    assert.equal(game._pending_message, 'You are incapable of detecting odors in your present form.');
    assert.equal(game.context.move, 0);
});
