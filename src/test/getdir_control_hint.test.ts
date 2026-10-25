import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';

function screenText(): string {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

// C pager.c:doidtrap() uses getdir("^"); cmd.c:help_dir() then explains that
// a typed letter probably meant its control-key command.
void test("the showtrap direction help explains a typed letter's control command", async () => {
    const input = freshTurnRoom();
    const command = rhack(0);
    input.feed('^x');
    await input.waitUntilBlocked();

    const screen = screenText();
    assert.match(screen, /cmdassist: Invalid direction key!/);
    assert.match(screen, /Are you trying to use \^X as specified in the Guidebook\?/);
    assert.match(screen, /\^X {6}show your attributes \(#attributes\)\./);
    assert.match(screen, /To use that command, hold down the <Ctrl> key as a shift/);
    assert.match(screen, /and press the <X> key\./);
    assert.match(screen, /Valid direction keys are:/);

    input.feed(' ');
    await command;
    assert.equal(game.context.move, 0);
});

void test('the showtrap direction help skips letters with no control binding', async () => {
    const input = freshTurnRoom();
    const command = rhack(0);
    input.feed('^q');
    await input.waitUntilBlocked();

    const screen = screenText();
    assert.doesNotMatch(screen, /Are you trying to use/);
    assert.match(screen, /cmdassist: Invalid direction key!/);
    assert.match(screen, /Valid direction keys are:/);

    input.feed(' ');
    await command;
    assert.equal(game.context.move, 0);
});

void test('the showtrap direction help hides wizard-only control commands', async () => {
    const input = freshTurnRoom();
    const command = rhack(0);
    input.feed('^f');
    await input.waitUntilBlocked();

    assert.doesNotMatch(screenText(), /Are you trying to use/);

    input.feed(' ');
    await command;
    assert.equal(game.context.move, 0);
});

void test('a wizard sees the wizard-only control command without the Guidebook hint', async () => {
    const input = freshTurnRoom({ flags: { debug: true } });
    const command = rhack(0);
    input.feed('^f');
    await input.waitUntilBlocked();

    const screen = screenText();
    assert.match(screen, /Are you trying to use \^F\?/);
    assert.doesNotMatch(screen, /Guidebook/);
    assert.match(screen, /\^F {6}map the level \(#wizmap\)\./);

    input.feed(' ');
    await command;
    assert.equal(game.context.move, 0);
});

void test('without cmdassist the showtrap direction prompt reports the strange direction', async () => {
    const input = freshTurnRoom({ flags: { cmdassist: false } });
    input.feed('^x');
    await rhack(0);
    assert.equal(game._pending_message, 'What a strange direction!');
    assert.equal(game.context.move, 0);
});

void test('a rebound letter help key still explains its control command', async () => {
    const input = freshTurnRoom();
    assert.equal(
        game.commandBindings.bindSpecialKey('x'.charCodeAt(0), 'getdir.help'),
        true,
    );
    const command = rhack(0);
    input.feed('^x');
    await input.waitUntilBlocked();

    const screen = screenText();
    assert.match(screen, /Are you trying to use \^X as specified in the Guidebook\?/);
    // Explicit help omits both the cmdassist heading and its closing note.
    assert.doesNotMatch(screen, /cmdassist: Invalid direction key!/);
    assert.doesNotMatch(screen, /Suppress this message/);
    assert.match(screen, /Valid direction keys are:/);

    // help_dir() with an explicit request returns to the direction prompt.
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed('l');
    await command;
    assert.equal(game._pending_message, "I can't see a trap there.");
    assert.equal(game.context.move, 0);
});
