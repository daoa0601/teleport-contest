import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, CLUB, DART, FOOD_RATION } from '../js/object_data.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('applying a container preserves the previous just-picked inventory batch', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, { invlet: 'a', initialize: false, olocked: false, cknown: true });
    const previous = await addInventoryObject(CLUB, { invlet: 'b', pickup_prev: true });
    const dart = await knownObject(DART, { where: 'contained', container: chest });
    chest.contents = [dart];
    await applyInventoryObject(chest, 'oa\n');
    assert.equal(previous.pickup_prev, true);
    assert.equal(dart.pickup_prev, true);
});
void test('looting several containers replaces the old batch once and retains both new pickups', async () => {
    freshPlayableRoom();
    const previous = await addInventoryObject(CLUB, { pickup_prev: true });
    const first = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const dart = await knownObject(DART, { where: 'contained', container: first });
    first.contents = [dart];
    const second = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const ration = await knownObject(FOOD_RATION, { where: 'contained', container: second });
    second.contents = [ration];
    await runExtendedCommand('loot', 'ab\noa\noa\n');
    assert.equal(previous.pickup_prev, false);
    assert.equal(dart.pickup_prev, true);
    assert.equal(ration.pickup_prev, true);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=container_just_picked.test.js.map