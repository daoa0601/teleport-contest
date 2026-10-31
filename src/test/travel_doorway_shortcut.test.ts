import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DOOR, D_ISOPEN, ROOM, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';

// C refs: hack.c:findtravelpath() (1266-1288 shortcut, 1416 setpoint),
// hack.c:end_running() (4129-4158), selvar.c:selection_setpoint() (186).
//
// The adjacent-target shortcut runs end_running(FALSE) before its
// test_move(TEST_MOVE). That call frees gt.travelmap, zeroes the rush
// ration, and (unlike and_travel=TRUE) leaves the travel flags set. When
// the shortcut's ordinary move is illegal - a diagonal step out of an
// intact doorway (hack.c:test_move 1208) - the backward search still
// finds a route and the hero takes one step, but every later
// selection_setpoint() in the same invocation writes into the freed map:
// the origin cell is not marked, and the zeroed multi ends the rush after
// that single step.
void test('a blocked adjacent travel target frees the visited map and ends the rush after one step', async () => {
    const level = await freshObjectRoom({ left: 8, right: 13, top: 8, bottom: 12 });
    // A wall column with one intact open doorway at the hero's square.
    for (let y = 8; y <= 12; y++) {
        if (y === 10) continue;
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

    game._pending_message = '';
    game._travelTarget = { x: 11, y: 9 };
    await rhack(31);

    // The shortcut cannot walk diagonally out of the doorway, so the
    // backward search routes the hero east instead. C marks nothing: the
    // shortcut already freed the selection, and it only returns at the
    // next findtravelpath() entry.
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game._pending_message, '');
    assert.equal(game._travelMap, undefined, 'the freed selection stays freed');
    // end_running(FALSE) zeroed the ration, so moveloop takes no second
    // step; the travel flags linger with run restored to 8, and the
    // destination is kept for a retravel.
    assert.equal(game.multi, 0);
    assert.equal(game.context.travel, true);
    assert.equal(game.context.travel1, false);
    assert.equal(game.context.mv, true);
    assert.equal(game.context.run, 8);
    assert.deepEqual(game._travelTarget, { x: 11, y: 9 });
});
