import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { BAG_OF_HOLDING, CLUB } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
import { addShopObjectToBill } from '../js/shk.js';

void test('known personal items lost from a cursed bag have vanished without charging a loot turn', async () => {
    freshPlayableRoom();
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cursed: true, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: bag });
    bag.contents = [club];
    initRng(17n);

    await applyInventoryObject(bag, ' q');

    assert.equal(club.where, 'gone');
    assert.equal(game.context.move, 0);
});

void test('losing unpaid contents from a carried cursed bag adds shop debt and clears the bill', async () => {
    freshPlayableRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cursed: true, cknown: true,
    });
    const club = await knownObject(CLUB);
    await addShopObjectToBill(club, game, { silent: true });
    club.where = 'contained';
    club.container = bag;
    bag.contents = [club];
    const price = shopkeeper.eshk.bill[0]?.price;
    assert.ok(price && price > 0);
    initRng(17n);

    await applyInventoryObject(bag, '  q');

    assert.equal(club.where, 'gone');
    assert.equal(shopkeeper.eshk.debit, price);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(game.context.move, 1);
});
