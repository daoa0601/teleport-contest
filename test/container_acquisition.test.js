import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, LUCKSTONE } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('taking a luckstone out of a carried chest grants its carried luck', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', olocked: false, otrapped: false, cknown: true,
    });
    const stone = await knownObject(LUCKSTONE, { where: 'contained', container: chest });
    chest.contents = [stone];
    assert.equal(game.u.moreluck ?? 0, 0);
    await applyInventoryObject(chest, 'oa\n');
    assert.equal(game.inventory.includes(stone), true);
    assert.equal(game.u.moreluck, 3);
    assert.equal(stone.pickup_prev, true);
});
void test('taking luckstones out of a chest updates luck after merging', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', olocked: false, otrapped: false, cknown: true,
    });
    await addInventoryObject(LUCKSTONE, { quantity: 3, cursed: true });
    const carried = await addInventoryObject(LUCKSTONE, { quantity: 2 });
    const stones = await knownObject(LUCKSTONE, {
        where: 'contained', container: chest, quantity: 2,
    });
    chest.contents = [stones];
    assert.equal(game.u.moreluck, -3);
    await applyInventoryObject(chest, 'oa\n');
    assert.equal(carried.quan, 4);
    assert.equal(game.u.moreluck, 3);
});
//# sourceMappingURL=container_acquisition.test.js.map