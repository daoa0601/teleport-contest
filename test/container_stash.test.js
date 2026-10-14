import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, DART } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('stash accepts a count and inventory letter without waiting for menu confirmation', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: false, cknown: true,
    });
    const darts = await addInventoryObject(DART, { invlet: 'b', quantity: 5 });
    const input = resetInputState();
    const operation = applyInventoryObject(chest, 's2b');
    const boundary = await Promise.race([
        operation.then(() => 'completed'),
        input.waitUntilBlocked().then(() => 'input'),
    ]);
    if (boundary === 'input') {
        input.feed('\x1b');
        await operation;
    }
    assert.equal(boundary, 'completed', 'An inventory letter completes the native stash selection.');
    assert.equal(darts.quan, 3);
    assert.equal(chest.contents?.find(object => object.otyp === DART)?.quan, 2);
    assert.equal(game.context.move, 1);
});
void test('counted stash cannot split darts welded to the hero hand', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: false, cknown: true,
    });
    const darts = await addInventoryObject(DART, { invlet: 'b', quantity: 5, cursed: true, bknown: false });
    await setPrimaryWeapon(darts, game);
    await applyInventoryObject(chest, 's2b');
    assert.equal(darts.quan, 5);
    assert.equal(game.uwep, darts);
    assert.equal(chest.contents?.length ?? 0, 0);
    assert.equal(darts.bknown, true);
    assert.match(game._pending_message, /darts are welded to your hand!/);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=container_stash.test.js.map