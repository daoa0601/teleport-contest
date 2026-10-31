import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun } from '../js/hack.js';
import { rhack } from '../js/cmd.js';
import { DOOR, D_ISOPEN, ROOM, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
// C refs: hack.c:findtravelpath() (1266-1288 shortcut, 1400-1418 stop,
// 1416 setpoint), hack.c:end_running() (4129-4158), selvar.c:
// selection_setpoint() (186).
//
// The adjacent-target shortcut runs end_running(FALSE) before its
// test_move(TEST_MOVE). That call frees gt.travelmap and zeroes the rush
// ration while leaving the travel flags set. When the shortcut's
// ordinary move is illegal - a diagonal step out of an intact doorway
// (hack.c:test_move 1208) - the backward search still finds a route and
// the hero takes one step, but the trailing selection_setpoint() writes
// into the freed map and marks nothing. A later travel through the
// doorway cell therefore keeps going: C recreated an empty selection at
// that call's entry, so the step back into the doorway is not a visited
// step and prints no stop message.
void test('a travel through a doorway a blocked shortcut routed out of does not stop as revisited', async () => {
    const level = await freshObjectRoom({ left: 8, right: 13, top: 8, bottom: 12 });
    // A wall column with one intact open doorway at the hero's square.
    for (let y = 8; y <= 12; y++) {
        if (y === 10)
            continue;
        const wall = level.requireAt(10, y);
        wall.typ = STONE;
        wall.seenv = 255;
    }
    const doorway = level.requireAt(10, 10);
    doorway.typ = DOOR;
    doorway.doormask = D_ISOPEN;
    doorway.seenv = 255;
    for (let x = 11; x <= 13; x++) {
        const east = level.requireAt(x, 9);
        east.typ = ROOM;
        east.seenv = 255;
        east.lit = true;
    }
    await vision_recalc(0);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    // The shortcut cannot walk diagonally out of the doorway, so the
    // backward search routes the hero east. end_running(FALSE) zeroed
    // the ration, so this rush ends after the single step, with the
    // travel flags lingering and the destination kept for a retravel.
    game._pending_message = '';
    game._travelTarget = { x: 11, y: 9 };
    await rhack(31);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game._pending_message, '');
    assert.equal(game.multi, 0);
    assert.equal(game.context.travel, true);
    assert.equal(game.context.travel1, false);
    assert.equal(game.context.mv, true);
    assert.equal(game.context.run, 8);
    assert.deepEqual(game._travelTarget, { x: 11, y: 9 });
    // Traveling back west: the first backward-search step re-enters the
    // doorway square the hero left. C's selection was freed with the
    // shortcut and recreated empty at this call's entry, so the step is
    // not a revisit: no stop message, and the run continues.
    game._pending_message = '';
    game._travelTarget = { x: 9, y: 10 };
    await rhack(31);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game._pending_message, '');
    assert.equal(game.context.travel, true);
    assert.equal((await continueRun()).tookTime, true);
    assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
    assert.equal(game._pending_message, '');
    assert.equal(game._travelTarget, null, 'arrival clears the destination');
    assert.equal(game.context.travel, false);
});
//# sourceMappingURL=travel_doorway_shortcut.test.js.map