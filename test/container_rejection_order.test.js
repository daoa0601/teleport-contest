import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { W_WEP } from '../js/const.js';
import { CHEST, POT_HEALING } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a cursed potion wielded as an improvised weapon can be stashed because it does not weld', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, { invlet: 'a', initialize: false, olocked: false, cknown: true });
    const potion = await addInventoryObject(POT_HEALING, {
        invlet: 'b', cursed: true, wielded: true, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = potion;
    await applyInventoryObject(chest, 'sb');
    assert.equal(chest.contents?.includes(potion), true);
    assert.equal(game.uwep, null);
});
void test('trying to stash a wielded box unwields it before discovering it cannot fit', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, { invlet: 'a', initialize: false, olocked: false, cknown: true });
    const other = await addInventoryObject(CHEST, {
        invlet: 'b', initialize: false, wielded: true, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = other;
    await applyInventoryObject(chest, 'sb');
    assert.equal(game.inventory.includes(other), true);
    assert.equal(chest.contents?.length, 0);
    assert.equal(game.uwep, null);
    assert.match(game._pending_message, /cannot fit/);
});
//# sourceMappingURL=container_rejection_order.test.js.map