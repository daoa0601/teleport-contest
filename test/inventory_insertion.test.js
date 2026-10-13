import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { DAGGER, GOLD_PIECE, TRIPE_RATION } from '../js/object_data.js';
import { addPickedInventoryObject } from '../js/pickup.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('newly picked up gold precedes lettered objects with fixed inventory letters', async () => {
    freshObjectRoom();
    const food = await addInventoryObject(TRIPE_RATION);
    const gold = await knownObject(GOLD_PIECE, { quan: 4 });
    await addPickedInventoryObject(gold);
    assert.equal(game.inventory[0], gold);
    assert.ok(game.inventory.indexOf(gold) < game.inventory.indexOf(food));
});
void test('a recovered object keeps its vacant letter and its place in inventory order', async () => {
    freshObjectRoom();
    const food = await addInventoryObject(TRIPE_RATION, { invlet: 'c' });
    const dagger = await knownObject(DAGGER, { invlet: 'a' });
    await addPickedInventoryObject(dagger);
    assert.equal(dagger.invlet, 'a');
    assert.ok(game.inventory.indexOf(dagger) < game.inventory.indexOf(food));
});
void test('unfixed inventory letters leave new objects at the end of the carried chain', async () => {
    freshObjectRoom({ flags: { fixinv: false } });
    const food = await addInventoryObject(TRIPE_RATION);
    const gold = await knownObject(GOLD_PIECE, { quan: 4 });
    await addPickedInventoryObject(gold);
    assert.ok(game.inventory.indexOf(food) < game.inventory.indexOf(gold));
});
//# sourceMappingURL=inventory_insertion.test.js.map