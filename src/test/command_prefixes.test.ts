import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const [keys, message] of [
    ['mm', 'Double m prefix, canceled.'],
    ['FF', 'Double fight prefix, canceled.'],
    ['gg', 'Double rush prefix, canceled.'],
    ['GG', 'Double run prefix, canceled.'],
    ['gG', 'Double run prefix, canceled.'],
    ['Gg', 'Double rush prefix, canceled.'],
] as const) {
    void test(`${keys} cancels the movement prefix and leaves the next key unread`, async () => {
        const input = freshTurnRoom();
        input.feed(keys + 'l');
        await rhack(0);
        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 0);
        assert.equal(game.u.ux, 10);
        assert.equal(await nhgetch(), 'l'.charCodeAt(0));
    });
}

for (const [keys, message] of [
    ['mi', "The inventory command does not accept 'm' prefix."],
    ['F>', "The 'F' prefix should be followed by a movement command other than up or down."],
    ['g.', "The 'g' prefix should be followed by a movement command."],
    ['m~', "Unknown command '~'."],
    ['gL', "The 'g' prefix should be followed by a movement command."],
    ['F\x1b', ''],
] as const) {
    void test(`${JSON.stringify(keys)} reports the native prefix rejection without spending time`, async () => {
        const input = freshTurnRoom();
        input.feed(keys);
        await rhack(0);
        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 0);
    });
}

for (const [prefix, direction, mode, noPickup] of [
    ['g', 'l', 2, false], ['G', 'l', 3, false], ['mG', 'L', 3, true],
    ['Gm', 'L', 3, true], ['m', 'L', 1, true],
] as const) {
    void test(`${prefix}${direction} preserves its movement mode`, async () => {
        const input = freshTurnRoom();
        input.feed(prefix + direction);
        await rhack(0);
        assert.equal(game.u.ux, 11);
        assert.equal(game.context.move, 1);
        assert.equal(game.context.run, mode);
        assert.equal(!!game.context.nopick, noPickup);
        assert.equal(await continueRun(), true);
        assert.equal(game.u.ux, 12);
    });
}

void test('a movement prefix can be entered as an extended command', async () => {
    const input = freshTurnRoom();
    input.feed('#rush\nl');
    await rhack(0);
    assert.equal(game.u.ux, 11);
    assert.equal(game.context.run, 2);
    assert.equal(game.context.move, 1);
});

void test('a rebound menu prefix names its actual key when doubled', async () => {
    const input = freshTurnRoom();
    game.commandBindings.bindKey('!'.charCodeAt(0), 'reqmenu');
    input.feed('!!');
    await rhack(0);
    assert.equal(game._pending_message, 'Double ! prefix, canceled.');
});

void test('a grid bug rejects diagonal movement before attempting a step', async () => {
    const input = freshTurnRoom();
    game.u.umonnum = MONSTER_NAME.indexOf('grid bug');
    input.feed('y');
    await rhack(0);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.dx, 0);
    assert.equal(game.u.dy, 0);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, "You can't get there from here...");
});

void test('an unknown key clears command recall while retaining an unfinished fight request', async () => {
    const input = freshTurnRoom();
    input.feed('F~l');
    await rhack(0);
    assert.equal(game._pending_message, "Unknown command '~'.");
    await rhack(0);
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /attack thin air/);
});
