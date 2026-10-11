import test from 'node:test';
import assert from 'node:assert/strict';

import { A_CHA } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { objectDescription } from '../js/object_description.js';
import { objectDescriptionPrice } from '../js/object_description_price.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import {
    DAGGER, FOOD_RATION, GLOB_OF_GRAY_OOZE, GOLD_PIECE, POT_HEALING, SACK,
} from '../js/object_data.js';
import {
    priceQuoteSuffix, recordObjectKnowledge, recordObjectPriceQuote,
} from '../js/object_knowledge.js';
import { unlinkObject } from '../js/object_location.js';
import { addShopObjectToBill, getCostOfShopItem, unpaidObjectCost } from '../js/shk.js';
import { addInventoryItem } from '../js/u_init.js';
import { addInventoryObject, floorObject, uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

async function pricingShop() {
    freshObjectRoom();
    return await createStaffedShop();
}

void test('an owned floor bag quotes its nested merchandise, excluding owned contents and gold', async () => {
    await pricingShop();
    const bag = await floorObject(SACK, 10, 10, { initialize: false, no_charge: true });
    const inner = await uninitializedObject(SACK, { no_charge: true });
    await addCreatedObjectToContainer(bag, inner);
    await addCreatedObjectToContainer(inner, await uninitializedObject(DAGGER, { quan: 2 }));
    await addCreatedObjectToContainer(bag, await uninitializedObject(FOOD_RATION, { no_charge: true }));
    await addCreatedObjectToContainer(bag, await uninitializedObject(GOLD_PIECE, { quan: 100 }));

    const cost = getCostOfShopItem(bag);
    assert.equal(cost.price, 8);
    assert.equal(cost.noCharge, 1);
    assert.equal(priceQuoteSuffix(SACK), '', 'a cost lookup does not teach a quoted price');
    assert.match(objectDescription(bag, { withPrice: true }), / \(contents, 8 zorkmids\)$/);
    assert.equal(priceQuoteSuffix(SACK), ' {buy 8}');
});

void test('the keeper home square makes the whole floor container free', async () => {
    const { shopkeeper } = await pricingShop();
    const home = shopkeeper.eshk.shk;
    const bag = await floorObject(SACK, home.x, home.y, { initialize: false });
    await addCreatedObjectToContainer(bag, await uninitializedObject(DAGGER));

    assert.match(objectDescription(bag, { withPrice: true }), / \(no charge\)$/);
    assert.equal(priceQuoteSuffix(SACK), '');
});

void test('an unpaid stack keeps its agreed unit price and charges only the remaining objects', async () => {
    const { shopkeeper } = await pricingShop();
    requirePlayingGame(game);
    const daggers = await floorObject(DAGGER, 10, 10, { initialize: false, quan: 3 });
    await addShopObjectToBill(daggers, game, { silent: true });
    await addInventoryItem(unlinkObject(daggers));
    // One billed dagger has been used; its debt remains on the bill but
    // the inventory description prices only the two objects still held.
    daggers.quan = daggers.quantity = 2;
    game.u.acurr.a[A_CHA] = game.u.amax.a[A_CHA] = 5;

    assert.equal(shopkeeper.eshk.bill[0]?.bquan, 3);
    assert.equal(unpaidObjectCost(daggers), 8);
    assert.equal(unpaidObjectCost(daggers, game, 'single'), 4);
    assert.match(objectDescription(daggers), / \(unpaid, 8 zorkmids\)$/);
});

void test('a carried owned bag describes unpaid contents at the current shop price', async () => {
    await pricingShop();
    requirePlayingGame(game);
    const bag = await floorObject(SACK, 10, 10, { initialize: false, no_charge: true });
    const dagger = await uninitializedObject(DAGGER);
    await addCreatedObjectToContainer(bag, dagger);
    await addShopObjectToBill(bag, game, { silent: true });
    await addInventoryItem(unlinkObject(bag));
    game.u.acurr.a[A_CHA] = game.u.amax.a[A_CHA] = 5;

    assert.equal(unpaidObjectCost(dagger), 4, 'the dagger itself keeps its bill price');
    assert.equal(getCostOfShopItem(bag).price, 8, 'carried contents use the hero location');
    assert.match(objectDescription(bag), / \(contents, 8 zorkmids\)$/);
});

void test('glob quotes remember the displayed price for the full weight', async () => {
    await pricingShop();
    const glob = await floorObject(GLOB_OF_GRAY_OOZE, 10, 10, {
        initialize: false, globby: true, owt: 41,
    });

    assert.match(objectDescription(glob, { withPrice: true }), / \(for sale, 18 zorkmids\)$/);
    assert.equal(priceQuoteSuffix(GLOB_OF_GRAY_OOZE), ' {buy 18}');
});

void test('remembered quotes appear only for unidentified types when price quotes are enabled', async () => {
    freshObjectRoom();
    const potion = await addInventoryObject(POT_HEALING, { typeKnown: false });
    recordObjectPriceQuote(POT_HEALING, 50);
    recordObjectPriceQuote(POT_HEALING, 75);
    recordObjectPriceQuote(POT_HEALING, 20, 'sell');

    assert.equal(objectDescriptionPrice(potion), '');
    game.flags.price_quotes = true;
    assert.match(objectDescription(potion), / \{buy 50-75 sell 20\}$/);
    assert.equal(objectDescriptionPrice(potion, { withPrice: true }), ' {buy 50-75 sell 20}');
    recordObjectKnowledge(POT_HEALING);
    assert.equal(objectDescriptionPrice(potion), '');
});

void test('suppressed and restoring descriptions do not display or remember shop prices', async () => {
    await pricingShop();
    const dagger = await floorObject(DAGGER, 10, 10, { initialize: false });
    game.iflags.suppress_price = true;
    assert.equal(objectDescriptionPrice(dagger, { withPrice: true }), '');
    assert.equal(priceQuoteSuffix(DAGGER), '');

    game.iflags.suppress_price = false;
    game.program_state.restoring = true;
    assert.equal(objectDescriptionPrice(dagger, { withPrice: true }), '');
    assert.equal(priceQuoteSuffix(DAGGER), '');
    game.program_state.restoring = false;
    assert.equal(objectDescriptionPrice(dagger, { withPrice: true }), ' (for sale, 4 zorkmids)');
});

void test('a carried paid item does not become merchandise inside a shop', async () => {
    await pricingShop();
    const dagger = await addInventoryObject(DAGGER, { initialize: false });

    assert.equal(getCostOfShopItem(dagger).price, 0);
    assert.equal(objectDescriptionPrice(dagger, { withPrice: true }), '');
});
