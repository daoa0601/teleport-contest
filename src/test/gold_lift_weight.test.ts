import assert from 'node:assert/strict';
import test from 'node:test';

// C pickup.c:carry_count() weighs the lifted coins with weight(), which
// counts at least one unit, and subtracts only the GOLD_WT() merge change.
// One coin can therefore push a hero over the next burden threshold.

import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { liftObject } from '../js/lift_object.js';
import { DART, GOLD_PIECE } from '../js/object_data.js';
import { invWeight, nearCapacity, weightCapacity } from '../js/weight.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('lifting one gold piece at the strained threshold asks to continue', async () => {
    freshObjectRoom();
    const capacity = weightCapacity(game);
    const carried = invWeight(game) + capacity;
    await addInventoryObject(DART, { quantity: 2 * capacity - 1 - carried });
    assert.equal(nearCapacity(game), 2, 'the hero starts stressed one unit below strained');
    const coin = await floorObject(GOLD_PIECE, game.u.ux, game.u.uy, { quantity: 1 });
    const input = resetInputState();

    const lift = await answerPrompts(liftObject({ object: coin }), input, [{
        prompt: /You have much trouble lifting a gold piece\.  Continue\? \[ynq\] \(q\)/u,
        keys: 'q',
    }]);

    assert.deepEqual(lift, { decision: 'stop', count: 0 });
});
