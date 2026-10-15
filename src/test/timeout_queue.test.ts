import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { EGG } from '../js/object_data.js';
import {
    claimNextDueObjectTimer, LEVEL_TIMER_KIND, OBJECT_TIMER_KIND,
    scheduleLevelTimer, scheduleObjectTimer,
} from '../js/object_timers.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('starting a duplicate object timer leaves the original callback due', async () => {
    freshObjectRoom();
    const egg = await addInventoryObject(EGG, { initialize: false });
    const deadline = game.moves + 5;
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, deadline);

    const duplicate = scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, deadline + 10);
    const due = claimNextDueObjectTimer(game, deadline);

    assert.equal(duplicate, null);
    assert.equal(due?.object, egg);
    assert.equal(egg.timed, 0);
});

void test('starting a duplicate spot timer leaves the original melt due', () => {
    freshObjectRoom();
    const deadline = game.moves + 5;
    scheduleLevelTimer(12, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, deadline);

    const duplicate = scheduleLevelTimer(12, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, deadline + 10);
    const due = claimNextDueObjectTimer(game, deadline);

    assert.equal(duplicate, null);
    assert.ok(due && due.object === null);
    assert.equal(due.position.x, 12);
    assert.equal(due.position.y, 10);
});
