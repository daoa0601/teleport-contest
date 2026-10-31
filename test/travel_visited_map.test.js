import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { autoDescribePosition } from '../js/getpos.js';
import { continueRun } from '../js/hack.js';
import { freshObjectRoom } from './support/object-room.js';
// C refs: hack.c:findtravelpath() (gt.travelmap), hack.c:is_valid_travelpt(),
// getpos.c:auto_describe(), cmd.c:dotravel_target().
//
// gt.travelmap is a global selection, not per-run state: every successful
// is_valid_travelpt() marks the hero's cell in it, and the marks survive
// ordinary movement until end_running() or reset_cmd_vars() frees the map.
// cmd.c:dotravel_target()'s "You are already here." early return leaves
// iflags.getloc_travelmode set, so any later getpos auto-describe keeps
// validating through is_valid_travelpt(). A travel that then starts with
// its first step on one of those marked cells stops after that single
// step with "You stop, unsure which way to go." (hack.c:1398-1418).
void test('travel stops after one step onto a cell marked by an earlier getpos validation', async () => {
    await freshObjectRoom({ left: 8, right: 14, top: 10, bottom: 10 });
    game._pending_message = '';
    // Walk east; a successful travel-mode describe of the next cell marks
    // the hero's current cell in gt.travelmap.
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    game.iflags.getloc_travelmode = true;
    await autoDescribePosition(12, 10);
    game.iflags.getloc_travelmode = false;
    // Ordinary movement leaves the marked cell in place.
    await rhack('h'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    game._travelTarget = { x: 13, y: 10 };
    await rhack(31);
    // The first travel step enters the marked cell: C still takes that
    // step, then nomul(0) ends travel and run is restored to 8 for the
    // domove run checks.
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game._pending_message, 'You stop, unsure which way to go.');
    assert.equal(game.multi, 0, 'the stopping step still spends its turn');
    assert.equal(game.context.move, 1);
    assert.equal(game.context.travel, false);
    assert.equal(game.context.travel1, false);
    assert.equal(game.context.mv, false);
    // The unsure stop keeps the travel destination for a retravel.
    assert.deepEqual(game._travelTarget, { x: 13, y: 10 });
    assert.equal((await continueRun()).tookTime, false, 'the stopped travel cannot take another step');
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
});
//# sourceMappingURL=travel_visited_map.test.js.map