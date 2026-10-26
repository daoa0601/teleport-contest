import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun, rhack } from '../js/cmd.js';
import { DUST, DOOR, ROOM } from '../js/const.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';

// C engrave.c:read_engr_at() ends a real run (context.run > 0) with nomul(0)
// but leaves a counted walk (multi > 0, context.run == 0) moving; the
// subsequent arrival messages then merge or page like any other prose.
void test('a counted walk reads a dust engraving and keeps walking', async () => {
    const level = freshObjectRoom();
    makeEngravingAt(11, 10, 'hi', null, game.moves, DUST);

    game.multi = 2;
    game._commandKey = 'l'.charCodeAt(0);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message ?? '', /Something is written here in the dust\./);

    // One scheduler step performs the remaining walk move; the engraving
    // read must not have cancelled it.
    await continueRun();

    assert.equal(game.u.ux, 12, 'the walk must not stop on the engraving');
    assert.equal(level.at(11, 10)?.typ, ROOM);
});

void test('a run stops on the engraving it just read', async () => {
    freshObjectRoom();
    makeEngravingAt(11, 10, 'hi', null, game.moves, DUST);

    await rhack('L'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message ?? '', /You read: "hi"\./);
    assert.equal(game.context.run, 0);
    assert.equal(game._runState, null);
});

// C hack.c:domove_core() stops only context.run runs on entering a doorway;
// a counted walk crosses it and continues.
void test('a counted walk crosses a doorway without stopping', async () => {
    const level = freshObjectRoom();
    level.requireAt(12, 10).typ = DOOR;

    game.multi = 2;
    game._commandKey = 'l'.charCodeAt(0);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);

    await continueRun();
    assert.equal(game.u.ux, 12, 'the walk reaches the doorway');
    await continueRun();
    assert.equal(game.u.ux, 13, 'the doorway must not end the counted walk');
});
