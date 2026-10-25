import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('redraw refreshes the map and takes no time after a movement command', async () => {
    const input = freshTurnRoom();
    input.feed('l\x12');
    await rhack(0);
    assert.equal(game.context.move, 1);
    await rhack(0);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, '');
    assert.equal(game.nhDisplay?.grid[11]?.[10]?.ch, '@');
});

void test('the full options command opens its editable options menu without time passing', async () => {
    const input = freshTurnRoom();
    input.feed('#optionsfull\n');
    const action = rhack(0);
    try {
        const waiting = await Promise.race([
            input.waitUntilBlocked().then(() => true), action.then(() => false),
        ]);
        assert.equal(waiting, true, 'optionsfull must open its options menu');
        assert.match(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '',
            /Set what options\?/);
    } finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});

void test("the persistent inventory command reports the disabled option without taking time", async () => {
    const input = freshTurnRoom();
    input.feed('|');
    await rhack(0);
    assert.equal(game._pending_message,
        "Persistent inventory ('perm_invent' option) is not presently enabled.");
    assert.equal(game.context.move, 0);
});
