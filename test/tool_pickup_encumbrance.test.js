import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DART, ROCK } from '../js/object_data.js';
import { pickupFloorObject } from '../js/pickup.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('consecutive remote pickups report an unchanged burden only once', async () => {
    freshObjectRoom();
    await addInventoryObject(ROCK, { quantity: 70 });
    const darts = await floorObject(DART, 12, 10, { quantity: 2 });
    resetInputState().feed(' '.repeat(8));
    assert.equal(nearCapacity(game), 1, 'the hero starts slightly burdened');
    assert.equal(await pickupFloorObject(darts, 1), true);
    assert.match(game._lastPlineMessage, /^You have a little trouble lifting/);
    assert.equal(await pickupFloorObject(darts, 1), true);
    assert.equal(nearCapacity(game), 1, 'both pickups leave the burden unchanged');
    assert.doesNotMatch(game._lastPlineMessage, /trouble lifting/);
    assert.equal(game.inventory.find(object => object.otyp === DART)?.quan, 2);
});
void test('an ordinary pickup resets load feedback for the next remote pickup', async () => {
    freshObjectRoom();
    await addInventoryObject(ROCK, { quantity: 70 });
    const darts = await floorObject(DART, 12, 10, { quantity: 2 });
    await floorObject(DART, 10, 10);
    resetInputState().feed(' '.repeat(12));
    await pickupFloorObject(darts, 1);
    await rhack(','.charCodeAt(0));
    await pickupFloorObject(darts, 1);
    assert.match(game._lastPlineMessage, /^You have a little trouble lifting/);
    assert.equal(game.inventory.find(object => object.otyp === DART)?.quan, 3);
});
//# sourceMappingURL=tool_pickup_encumbrance.test.js.map