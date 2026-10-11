import { requirePlayingGame } from '../js/gstate.js';
import test, { type TestContext } from 'node:test';
import { planInput } from './support/planned-input.js';
import type { PromptAnswer } from './support/input-boundaries.js';
import assert from 'node:assert/strict';

import { SHOPBASE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import {
    CORPSE, DAGGER, EGG, FOOD_RATION, GOLD_PIECE, OBJECT_COST, OBJECT_NAMES,
    POT_FRUIT_JUICE, SACK, TIN,
} from '../js/object_data.js';
import { HUNGRY, WEAK } from '../js/const.js';
import { resetInputState } from '../js/input.js';
import {
    SELL_DELIBERATE, SELL_DONTSELL, SELL_NORMAL, sellHeroDroppedObject,
    setSellDisposition, shopOfferForObject, shopStocksObject,
} from '../js/shop_sell.js';
import { shopGetPrice } from '../js/shop_loss.js';
import {
    MONSTER_CONVEYS, MONSTER_LEVEL, MONSTER_NAME, MONSTER_NUTRITION,
} from '../js/monster_data.js';
import {
    addCreatedObjectToContainer, addObjectToContainer,
} from '../js/object_container.js';
import {
    floorObject, knownObject, uninitializedObject,
} from './support/game-objects.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { createStaffedShop } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';

const SHOP = { left: 9, right: 13, top: 9, bottom: 11 };

const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');


function monsterLevel(species: number): number {
    const level = MONSTER_LEVEL[species];
    assert.ok(level !== undefined);
    return level;
}

async function priceShop({ shoptype = SHOPBASE } = {}) {
    const level = freshObjectRoom({ ...SHOP, role: 'caveman' });
    const { shopkeeper } = await createStaffedShop({ ...SHOP,
        keeperX: 12, keeperY: 10, shopType: shoptype });
    return { level, shopkeeper };
}

async function sellShop(t: TestContext, answers: readonly PromptAnswer[] = [], { shoptype = SHOPBASE, gold = 1000 } = {}) {
    freshObjectRoom({ ...SHOP, role: 'caveman' });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({
        ...SHOP, keeperX: 12, keeperY: 10, doorX: 9, doorY: 10,
        shopType: shoptype,
    });
    shopkeeper.gold = gold;
    setHeroGoldAmount(game, 0);
    setSellDisposition(SELL_DELIBERATE);
    planInput(resetInputState(), t, answers);
    return { shopkeeper };
}

void test('answering the offer sells the item for the whole-stack offer', async t => {
    const { shopkeeper } = await sellShop(t, [{ prompt: /Sell (?:it|them)\?/, keys: 'y' }]);
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10);
    const offer = shopOfferForObject(dagger, shopkeeper);
    const outcome = await sellHeroDroppedObject(dagger, 10, 10);
    assert.deepEqual(outcome, { sold: true, offer });
    assert.equal(heroGoldAmount(game), offer);
    assert.equal(shopkeeper.gold, 1000 - offer);
    assert.match(game._lastPlineMessage, /sold dagger for 2 gold pieces\./);
});

void test('declining the offer marks the item no charge and pays nothing', async t => {
    const { shopkeeper } = await sellShop(t, [{ prompt: /Sell (?:it|them)\?/, keys: 'n' }]);
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10);
    const outcome = await sellHeroDroppedObject(dagger, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(shopkeeper.gold, 1000);
    assert.equal(dagger.no_charge, true);
});

void test('a SELL_NORMAL disposition sells automatically without a query', async t => {
    const { shopkeeper } = await sellShop(t, [{ prompt: /relinquish dagger and receive.*gold pieces/, keys: ' ' }]);
    requirePlayingGame(game);
    setSellDisposition(SELL_NORMAL);
    const first = await floorObject(DAGGER, 10, 10);
    const second = await floorObject(DAGGER, 10, 10);
    assert.equal((await sellHeroDroppedObject(first, 10, 10)).sold, true);
    assert.equal((await sellHeroDroppedObject(second, 10, 10)).sold, true);
    assert.equal(heroGoldAmount(game),
        shopOfferForObject(first, shopkeeper)
        + shopOfferForObject(second, shopkeeper));
});

void test('dropping an unpaid billed item removes it from the bill only', async t => {
    const { shopkeeper } = await sellShop(t);
    requirePlayingGame(game);
    const potion = await floorObject(POT_FRUIT_JUICE, 10, 10);
    potion.unpaid = true; // billed state is a fixture concern, not creation
    shopkeeper.eshk.bill = [
        { bo_id: potion.o_id, bquan: 1, useup: false, price: 60 },
    ];
    shopkeeper.eshk.billct = 1;
    const outcome = await sellHeroDroppedObject(potion, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(heroGoldAmount(game), 0);
});

void test('an angry shopkeeper confiscates with thanks and no payment', async t => {
    const { shopkeeper } = await sellShop(t);
    requirePlayingGame(game);
    shopkeeper.mpeaceful = 0;
    const dagger = await floorObject(DAGGER, 10, 10);
    const outcome = await sellHeroDroppedObject(dagger, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.equal(heroGoldAmount(game), 0);
    assert.match(game._lastPlineMessage, /Thank you, scum!/);
});

void test('a broke shopkeeper pays in credit', async t => {
    const { shopkeeper } = await sellShop(t, [
        { prompt: /cannot pay you at present/, keys: ' ' },
        { prompt: /accept.*in credit for dagger\?/, keys: 'y' },
    ], { gold: 0 });
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10);
    const offer = shopOfferForObject(dagger, shopkeeper);
    const expectedCredit = Math.trunc((offer * 9) / 10)
        + (offer <= 1 ? 1 : 0);
    const outcome = await sellHeroDroppedObject(dagger, 10, 10);
    assert.deepEqual(outcome, { sold: true, credit: expectedCredit });
    assert.equal(shopkeeper.eshk.credit, expectedCredit);
    assert.equal(heroGoldAmount(game), 0);
    assert.match(game._lastPlineMessage, /traded .* in credit\./);
});

void test('an "all" answer keeps accepting credit for the batch', async t => {
    await sellShop(t, [
        { prompt: /cannot pay you at present/, keys: ' ' },
        { prompt: /accept.*in credit for dagger\?/, keys: 'a' },
        { prompt: /traded dagger.*in credit/, keys: ' ' },
    ], { gold: 0 });
    requirePlayingGame(game);
    assert.equal(
        (await sellHeroDroppedObject(await floorObject(DAGGER, 10, 10), 10, 10))
            .sold, true);
    assert.equal(
        (await sellHeroDroppedObject(await floorObject(DAGGER, 10, 10), 10, 10))
            .sold, true);
    assert.ok(game._lastPlineMessage);
});

void test('a robbed shop takes the drop as a contribution', async t => {
    const { shopkeeper } = await sellShop(t);
    requirePlayingGame(game);
    shopkeeper.eshk.robbed = 50;
    const dagger = await floorObject(DAGGER, 10, 10);
    const offer = shopOfferForObject(dagger, shopkeeper);
    const outcome = await sellHeroDroppedObject(dagger, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.equal(shopkeeper.eshk.robbed, 50 - offer);
    assert.equal(heroGoldAmount(game), 0);
    assert.match(game._lastPlineMessage,
        /contribution to restock this recently plundered shop/);
});

void test('dropped gold pays debt before establishing credit', async t => {
    const { shopkeeper } = await sellShop(t);
    requirePlayingGame(game);
    shopkeeper.eshk.debit = 10;
    const purse = await knownObject(GOLD_PIECE, { quan: 25, quantity: 25 });
    purse.ox = 10;
    purse.oy = 10;
    purse.where = 'floor';
    game.level.objects[10] ||= [];
    game.level.objects[10][10] ||= [];
    game.level.objects[10][10].unshift(purse);
    const outcome = await sellHeroDroppedObject(purse, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.credit, 15);
});

void test('an out-of-stock item draws no interest', async t => {
    const { shopkeeper } = await sellShop(t, [],
        { shoptype: SHOPBASE + 3 });
    requirePlayingGame(game); // potion shop
    const dagger = await floorObject(DAGGER, 10, 10);
    const outcome = await sellHeroDroppedObject(dagger, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.equal(heroGoldAmount(game), 0);
    assert.match(game._lastPlineMessage, /seems uninterested/);
    assert.equal(dagger.no_charge, true);
    assert.equal(shopStocksObject(SHOPBASE + 3, dagger), false);
    assert.equal(shopStocksObject(SHOPBASE, dagger), true);
});

void test('a container sells with its contents', async t => {
    const { shopkeeper } = await sellShop(t, [{ prompt: /Sell (?:it|them)\?/, keys: 'y' }]);
    requirePlayingGame(game);
    // An uninitialized sack: knownObject() stocks containers like mklev.
    const sack = placeCreatedObject(await uninitializedObject(SACK,
        { dknown: true, cknown: true }), 10, 10);
    const blade = await knownObject(DAGGER, { dknown: true });
    await addCreatedObjectToContainer(sack, blade, game);
    const expected = shopOfferForObject(sack, shopkeeper)
        + shopOfferForObject(blade, shopkeeper);
    const outcome = await sellHeroDroppedObject(sack, 10, 10);
    assert.deepEqual(outcome, { sold: true, offer: expected });
    assert.equal(heroGoldAmount(game), expected);
});

void test('species-priced corpses, tins and eggs follow the C terms', async t => {
    const { shopkeeper } = await priceShop();
    requirePlayingGame(game);
    const jackal = MONSTER_NAME.indexOf('jackal');
    const eye = MONSTER_NAME.indexOf('floating eye');
    const dragon = MONSTER_NAME.indexOf('red dragon');

    // A non-conveying species: level term plus the corpse-only nutrition
    // term; tins and eggs keep the species terms without nutrition.
    const corpse = await knownObject(CORPSE, { dknown: true, corpsenm: jackal });
    const expectedJackal = Math.max(1, (monsterLevel(jackal) - 1) * 2)
        + Math.max(1, Math.trunc((MONSTER_NUTRITION[jackal] ?? 0) / 30));
    assert.equal(shopGetPrice(corpse, true),
        (OBJECT_COST[CORPSE] ?? 0) + expectedJackal);

    // A telepathic species adds the TELEPAT intrinsic cost (x6 multiplier).
    const eyeTin = await knownObject(TIN, { dknown: true, corpsenm: eye });
    const expectedEye = Math.max(1, (monsterLevel(eye) - 1) * 2) * 6;
    assert.equal(shopGetPrice(eyeTin, true),
        (OBJECT_COST[TIN] ?? 0) + expectedEye);

    // A conveying species: the fire resistance cost enters through
    // MONSTER_CONVEYS, and only the corpse adds nutrition.
    const dragonEgg = await knownObject(EGG, { dknown: true, corpsenm: dragon });
    const expectedDragonEgg = (Math.max(1, (monsterLevel(dragon) - 1) * 2))
        * (1 + 2); // fire
    assert.equal(shopGetPrice(dragonEgg, true),
        (OBJECT_COST[EGG] ?? 0) + expectedDragonEgg);
    const dragonCorpse = await knownObject(CORPSE,
        { dknown: true, corpsenm: dragon });
    assert.equal(shopGetPrice(dragonCorpse, true),
        (OBJECT_COST[CORPSE] ?? 0) + expectedDragonEgg
        + Math.max(1, Math.trunc((MONSTER_NUTRITION[dragon] ?? 0) / 30)) * 3);
    assert.ok((MONSTER_CONVEYS[dragon] ?? 0) & 0x01);

    // Sanity only: the offer divides the price for an ordinary seller.
    assert.ok(shopOfferForObject(corpse, shopkeeper) >= 1);
});

void test('a hungry hero pays hunger multiples when buying food only', async t => {
    const ration = await knownObject(FOOD_RATION, { dknown: true });
    const base = shopGetPrice(ration, false);
    assert.ok(base > 0);

    game.u.uhs = HUNGRY;
    assert.equal(shopGetPrice(ration, false), base * HUNGRY);
    game.u.uhs = WEAK;
    assert.equal(shopGetPrice(ration, false), base * WEAK);
    // The shopkeeper buying is never charged the hunger multiplier.
    assert.equal(shopGetPrice(ration, true), base);

    // A partly eaten ration still prices to zero after the multiplier.
    const eaten = await knownObject(FOOD_RATION, { dknown: true, oeaten: 100 });
    assert.equal(shopGetPrice(eaten, false), 0);
});

void test('an unpaid descendant keeps the container on the bill path', async t => {
    const { shopkeeper } = await sellShop(t);
    requirePlayingGame(game);
    setSellDisposition(SELL_DONTSELL);
    const sack = placeCreatedObject(await uninitializedObject(SACK,
        { dknown: true, cknown: true }), 10, 10);
    const blade = await knownObject(DAGGER, { dknown: true });
    await addObjectToContainer(sack, blade, game);
    blade.unpaid = true; // billed state is a fixture concern, not creation
    shopkeeper.eshk.bill = [
        { bo_id: blade.o_id, bquan: 1, useup: false, price: 40 },
    ];
    shopkeeper.eshk.billct = 1;
    const outcome = await sellHeroDroppedObject(sack, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    // is_unpaid() saw the descendant, so subfrombill cleared the bill.
    assert.equal(shopkeeper.eshk.bill.length, 0);
});

void test('candelabra are not candles for pricing, tallow candles are', async t => {
    const candelabrum = await knownObject(
        OBJECT_NAMES.indexOf('Candelabrum of Invocation'),
        { dknown: true, age: 0, spe: 3 });
    const tallow = await knownObject(
        OBJECT_NAMES.indexOf('tallow candle'), { dknown: true, age: 0 });
    // A fresh candelabrum does not take the half-price worn-candle cut.
    assert.equal(shopGetPrice(candelabrum, true),
        OBJECT_COST[OBJECT_NAMES.indexOf('Candelabrum of Invocation')]);
    // A nearly-burned tallow candle does.
    assert.equal(shopGetPrice(tallow, true),
        Math.trunc((OBJECT_COST[OBJECT_NAMES.indexOf('tallow candle')] ?? 0) / 2));
});

void test('spinach tins and ghost corpses stock in the health food shop', async t => {
    const health = SHOPBASE + 10;
    const spinach = await knownObject(TIN,
        { dknown: true, corpsenm: -1, spe: 1 });
    const empty = await knownObject(TIN, { dknown: true, corpsenm: -1, spe: 0 });
    assert.equal(shopStocksObject(health, spinach), true);
    assert.equal(shopStocksObject(health, empty), false);
    const ghost = MONSTER_NAME.indexOf('ghost');
    const wraith = MONSTER_NAME.indexOf('wraith');
    assert.equal(shopStocksObject(health,
        await knownObject(CORPSE, { corpsenm: ghost })), true);
    // Wraiths are unsolid but not ghosts: not vegan.
    assert.equal(shopStocksObject(health,
        await knownObject(CORPSE, { corpsenm: wraith })), false);
});

void test('a robbed shop takes one zorkmid for contained gold', async t => {
    const { shopkeeper } = await sellShop(t);
    requirePlayingGame(game);
    shopkeeper.eshk.robbed = 50;
    const sack = placeCreatedObject(await uninitializedObject(SACK,
        { dknown: true, cknown: true }), 10, 10);
    const purse = await knownObject(GOLD_PIECE, { dknown: true, quan: 25 });
    await addCreatedObjectToContainer(sack, purse, game);
    // The sack itself offers one zorkmid (general store), plus the C
    // boolean quirk adds exactly one more for the contained gold.
    const outcome = await sellHeroDroppedObject(sack, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.equal(shopkeeper.eshk.robbed, 48);
});

void test('an out-of-town candelabrum draw is refused, not advised', async t => {
    const { shopkeeper } = await sellShop(t, [], { shoptype: SHOPBASE + 11 });
    requirePlayingGame(game);
    shopkeeper.eshk.shknam = '+Izchak';
    const candelabrum = await floorObject(
        OBJECT_NAMES.indexOf('Candelabrum of Invocation'), 10, 10);
    const outcome = await sellHeroDroppedObject(candelabrum, 10, 10);
    assert.deepEqual(outcome, { sold: false });
    assert.match(game._lastPlineMessage, /won't stock that/);
});

void test('a short keeper offers only what it can pay', async t => {
    const { shopkeeper } = await sellShop(t, [{ prompt: /Sell it\?/, keys: 'y' }], { gold: 1 });
    requirePlayingGame(game);
    const potion = await floorObject(POT_FRUIT_JUICE, 10, 10);
    const outcome = await sellHeroDroppedObject(potion, 10, 10);
    // The short-funds clip is observable in the paid offer itself.
    assert.deepEqual(outcome, { sold: true, offer: 1 });
    assert.equal(heroGoldAmount(game), 1);
    assert.equal(shopkeeper.gold, 0);
});
