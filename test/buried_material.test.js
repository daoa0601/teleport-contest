import assert from 'node:assert/strict';
import test from 'node:test';
import { buryObject } from '../js/buried_object.js';
import { game } from '../js/gstate.js';
import { WAN_CANCELLATION } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { runDueTimers } from '../js/timer_effects.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a buried wand rots according to its shuffled wooden material', async () => {
    freshObjectRoom();
    const wand = await floorObject(WAN_CANCELLATION, 12, 10);
    game.objectMaterials ??= [];
    game.objectMaterials[wand.otyp] = 8;
    await buryObject(wand);
    const timer = objectTimers(wand).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_ORGANIC);
    assert.ok(timer, 'wooden wands should start rotting when buried');
    game.moves = timer.deadline;
    await runDueTimers();
    assert.equal(wand.where, 'gone');
});
//# sourceMappingURL=buried_material.test.js.map