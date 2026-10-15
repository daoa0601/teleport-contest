import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_ICE, DRAWBRIDGE_UP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { GLOB_OF_GRAY_OOZE } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, scheduleObjectTimer, stopAllObjectTimers } from '../js/object_timers.js';
import { runDueTimers } from '../js/timer_effects.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('ice below a raised bridge delays a floor glob shrinking', async () => {
    const level = freshObjectRoom({ moves: 43 });
    const square = level.requireAt(12, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_ICE;
    const glob = await floorObject(GLOB_OF_GRAY_OOZE, 12, 10, { owt: 20 });
    stopAllObjectTimers(glob);
    scheduleObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB, game.moves);
    await runDueTimers();
    assert.equal(glob.owt, 20);
});
//# sourceMappingURL=glob_ice_underlay.test.js.map