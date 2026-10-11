import { requirePlayingGame } from '../js/gstate.js';
import test, {} from 'node:test';
import { planInput } from './support/planned-input.js';
import assert from 'node:assert/strict';
import { SHOPBASE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { cls } from '../js/display.js';
import { addInventoryItem } from '../js/u_init.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { CHEST, CRYSKNIFE, DAGGER, GOLD_PIECE, LARGE_BOX, OBJECT_NAMES, SACK, WORM_TOOTH, WAN_DIGGING, } from '../js/object_data.js';
import { addCreatedObjectToContainer, addObjectToContainer, } from '../js/object_container.js';
import { unlinkObject } from '../js/object_location.js';
import { addShopObjectToBill, billedPickupQuote, chargeAlteredUnpaidObject, checkSpecialRoom, getCostOfShopItem, settleThrownShopObject, splitObjectBill, } from '../js/shk.js';
import { splitObjectStack } from '../js/object_stack.js';
import { mergeObjectStacks } from '../js/object_merge.js';
import { pickupAtHero } from '../js/pickup.js';
import { floorObject, knownObject, uninitializedObject, } from './support/game-objects.js';
import { placeCreatedObject, placeObject, } from '../js/floor_object.js';
import { createStaffedShop } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';
const SHOP = { left: 9, right: 13, top: 9, bottom: 11 };
async function staffedShop(t, answers = [], { shoptype = SHOPBASE, keeperX = 12, keeperY = 10 } = {}) {
    freshObjectRoom({ left: 4, right: 16, top: 4, bottom: 14, role: 'caveman',
        flags: { verbose: true, autoopen: true, pickup: true } });
    requirePlayingGame(game);
    const shop = await createStaffedShop({
        ...SHOP, keeperX, keeperY, doorX: 9, doorY: 10, shopType: shoptype,
    });
    planInput(resetInputState(), t, answers);
    return shop;
}
async function moveHeroTo(x, y = 10) {
    requirePlayingGame(game);
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    game.u.ux = x;
    game.u.uy = y;
    await checkSpecialRoom();
    if (game._pending_message)
        pushKeys(' ');
    await cls();
}
void test('picking up in a shop bills the item through the real pickup owner', async (t) => {
    const { shopkeeper } = await staffedShop(t, [{ prompt: /only 4 zorkmids for this.*dagger/, keys: ' ' }]);
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: true });
    // Shop merchandise is never autopicked (C pickup.c costly_spot guard);
    // the deliberate pickup command is the real owner.
    await pickupAtHero();
    const entry = shopkeeper.eshk.bill.find(candidate => candidate.bo_id === dagger.o_id);
    assert.ok(entry, 'dagger billed');
    assert.equal(dagger.unpaid, true);
    assert.ok(game.inventory.includes(dagger));
    // The final inventory line itself proves the billing.
    assert.match(game._lastPlineMessage, /unpaid, 4 zorkmids/);
});
void test('picking up a container bills its eligible contents too', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const sack = placeCreatedObject(await uninitializedObject(SACK, { dknown: true, cknown: true }), 10, 10);
    const blade = await knownObject(DAGGER, { dknown: true });
    await addCreatedObjectToContainer(sack, blade, game);
    const purse = await knownObject(GOLD_PIECE, { dknown: true, quan: 30 });
    await addCreatedObjectToContainer(sack, purse, game);
    const transaction = await addShopObjectToBill(sack);
    assert.ok(transaction != null, 'Expected transaction to be initialized');
    assert.ok(transaction.entry, 'sack itself billed');
    const bladeEntry = shopkeeper.eshk.bill.find(candidate => candidate.bo_id === blade.o_id);
    assert.ok(bladeEntry, 'content billed recursively');
    assert.equal(blade.unpaid, true);
    assert.ok(transaction.contentscount >= 1);
    // Contained gold became debt, not a bill entry.
    assert.ok(shopkeeper.eshk.debit >= 30);
    assert.ok(shopkeeper.eshk.loan != null, 'Expected shopkeeper.eshk.loan to be initialized');
    assert.ok(shopkeeper.eshk.loan >= 30);
});
void test('a no_charge box with merchandise still bills the contents', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const box = placeCreatedObject(await uninitializedObject(LARGE_BOX, { dknown: true, no_charge: true }), 10, 10);
    const blade = await knownObject(DAGGER, { dknown: true });
    await addCreatedObjectToContainer(box, blade, game);
    const transaction = await addShopObjectToBill(box);
    // Only the contents were billable; the transaction still carries the
    // content offer for the pickup quote.
    assert.ok(transaction != null, 'Expected transaction to be initialized');
    assert.equal(transaction.entry, null);
    assert.ok(transaction.offer > 0);
    const bladeEntry = shopkeeper.eshk.bill.find(candidate => candidate.bo_id === blade.o_id);
    assert.ok(bladeEntry, 'content billed under a no_charge box');
    assert.ok(!blade.no_charge); // picked_container reset
    assert.equal(box.unpaid, undefined);
});
void test('a sealed Schroedinger box keeps its contents unbilled', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const box = placeCreatedObject(await uninitializedObject(LARGE_BOX, { dknown: true, spe: 1, cknown: false }), 10, 10);
    const blade = await knownObject(DAGGER, { dknown: true });
    await addCreatedObjectToContainer(box, blade, game);
    await addShopObjectToBill(box);
    assert.equal(shopkeeper.eshk.bill.some(candidate => candidate.bo_id === blade.o_id), false);
});
void test('a full bill hands the item over for free', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    shopkeeper.eshk.bill = Array.from({ length: 200 }, (_, index) => ({ bo_id: 1000 + index, bquan: 1, useup: false, price: 1 }));
    shopkeeper.eshk.billct = 200;
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: true });
    const outcome = await addShopObjectToBill(dagger);
    assert.equal(outcome, null);
    assert.match(game._lastPlineMessage, /got that for free!/);
    assert.equal(dagger.unpaid, undefined);
});
void test('picked-up gold pays credit down before creating debt', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    shopkeeper.eshk.credit = 10;
    const purse = await floorObject(GOLD_PIECE, 10, 10, { dknown: true, quan: 25 });
    await addShopObjectToBill(purse);
    assert.equal(shopkeeper.eshk.credit, 0);
    assert.equal(shopkeeper.eshk.debit, 15);
    assert.equal(shopkeeper.eshk.loan, 15);
});
void test('the keeper home square is free, not non-shop, for display pricing', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const home = shopkeeper.eshk.shk;
    const daggerHome = await floorObject(DAGGER, home.x, home.y, { dknown: true });
    const onHome = getCostOfShopItem(daggerHome);
    assert.deepEqual([onHome.noCharge, onHome.price], [1, 0]);
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: true });
    const priced = getCostOfShopItem(dagger);
    assert.equal(priced.noCharge, 0);
    assert.ok(priced.price > 0);
    await moveHeroTo(5, 5);
    assert.equal(getCostOfShopItem(dagger).noCharge, -1);
    await moveHeroTo(10, 10);
    const ball = { ...dagger, o_id: 999999, oclass: 15 };
    game.uball = ball;
    assert.equal(getCostOfShopItem(ball).noCharge, -1);
    game.uball = null;
});
void test('contained objects price through their top and billed contents', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const sack = placeCreatedObject(await uninitializedObject(SACK, { dknown: true, cknown: true }), 10, 10);
    const blade = await knownObject(DAGGER, { dknown: true });
    await addCreatedObjectToContainer(sack, blade, game);
    await addShopObjectToBill(sack);
    const cost = getCostOfShopItem(sack);
    assert.equal(cost.noCharge, 0);
    assert.ok(cost.price > 0);
    // The dropped container no longer sits at the hero square; the price
    // still resolves because the top keeps its floor coordinates.
    const billedBlade = shopkeeper.eshk.bill.find(candidate => candidate.bo_id === blade.o_id);
    assert.ok(billedBlade);
});
void test('an intact return removes only the assigned keeper bill', async (t) => {
    const first = await staffedShop(t);
    requirePlayingGame(game);
    const other = await createStaffedShop({
        left: 20, right: 24, top: 9, bottom: 11,
        keeperX: 23, keeperY: 10, doorX: 20, doorY: 10,
    });
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: true });
    // The object was billed by the OTHER shop's keeper.
    other.shopkeeper.eshk.bill = [
        { bo_id: dagger.o_id, bquan: 1, useup: false, price: 40 },
    ];
    other.shopkeeper.eshk.billct = 1;
    dagger.unpaid = true;
    dagger.ox = 10;
    dagger.oy = 10;
    const settled = await settleThrownShopObject(dagger, 10, 10);
    assert.equal(settled, true);
    // The hero's shop settled through its own keeper; the other shop's
    // bill entry survives.
    assert.equal(other.shopkeeper.eshk.bill.length, 1);
});
void test('altering a carried unpaid item bills the used-up remainder', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const wand = await knownObject(WAN_DIGGING, { dknown: true, spe: -1 });
    // Carried and unpaid: the C carried path only needs the flag.
    wand.where = 'inventory';
    wand.unpaid = true;
    wand.ox = 10;
    wand.oy = 10;
    shopkeeper.eshk.bill = [
        { bo_id: wand.o_id, bquan: 1, useup: false, price: 80 },
    ];
    shopkeeper.eshk.billct = 1;
    game.inventory.unshift(wand);
    const settled = await chargeAlteredUnpaidObject(wand, 'drain');
    assert.ok(settled && typeof settled === 'object', 'dummy billed');
    assert.equal(wand.unpaid, false);
    assert.equal(wand.no_charge, false); // inventory placement keeps it clear
    const dummyEntry = shopkeeper.eshk.bill.find(candidate => candidate.bo_id === settled.object.o_id);
    assert.ok(dummyEntry, 'dummy entry on the bill');
    assert.equal(dummyEntry.useup, true);
    assert.match(game._lastPlineMessage, /You drain .* you pay for/);
});
void test('an uncurse alteration teaches the beatitude of a carried item', async (t) => {
    await staffedShop(t);
    requirePlayingGame(game);
    const water = await knownObject(OBJECT_NAMES.indexOf('potion of unholy water') >= 0
        ? OBJECT_NAMES.indexOf('potion of unholy water')
        : OBJECT_NAMES.indexOf('water'), { dknown: true, cursed: true, bknown: false });
    water.where = 'inventory';
    water.unpaid = true;
    water.ox = 10;
    water.oy = 10;
    await chargeAlteredUnpaidObject(water, 'uncurse');
    assert.equal(water.bknown, true);
});
void test('altering floor stock outside the hero shop settles as theft', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: true });
    // Hero leaves the shop before the alteration completes.
    await moveHeroTo(5, 5);
    game.level.requireAt(5, 5).roomno = 0;
    const settled = await chargeAlteredUnpaidObject(dagger, 'rust');
    assert.ok(settled === null || settled !== undefined);
    assert.ok((shopkeeper.eshk.robbed ?? 0) > 0);
    assert.equal(shopkeeper.eshk.following, 1);
    assert.match(game._lastPlineMessage, /Thief!|thief!/);
});
void test('splitting a billed stack clones the price to the split', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const original = await knownObject(DAGGER, { dknown: true, quan: 5, quantity: 5, unpaid: true });
    original.o_id = 777;
    shopkeeper.eshk.bill = [
        { bo_id: original.o_id, bquan: 5, useup: false, price: 4 },
    ];
    shopkeeper.eshk.billct = 1;
    const split = { ...original, o_id: 778, quan: 2, quantity: 2 };
    splitObjectBill(original, split);
    const entries = shopkeeper.eshk.bill;
    assert.equal(entries.length, 2);
    assert.ok(entries[0] != null);
    assert.equal(entries[0].bquan, 3);
    assert.ok(entries[1] != null);
    assert.deepEqual([entries[1].bo_id, entries[1].bquan, entries[1].price], [778, 2, 4]);
    assert.equal(entries[1].useup, false);
    // A full bill keeps the split off the bill entirely.
    shopkeeper.eshk.bill = [
        { bo_id: original.o_id, bquan: 4, useup: false, price: 4 },
        ...Array.from({ length: 199 }, (_, index) => ({
            bo_id: 2000 + index, bquan: 1, useup: false, price: 1,
        })),
    ];
    const offBill = { ...original, o_id: 779, quan: 2, quantity: 2,
        unpaid: true };
    splitObjectBill(original, offBill);
    assert.equal(shopkeeper.eshk.bill.length, 200);
    assert.equal(offBill.unpaid, false);
});
void test('splitting an unpaid stack through the stack owner carries the bill', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const stack = await knownObject(DAGGER, { dknown: true, quan: 5, quantity: 5, unpaid: true });
    stack.o_id = 900;
    shopkeeper.eshk.bill = [
        { bo_id: stack.o_id, bquan: 5, useup: false, price: 4 },
    ];
    shopkeeper.eshk.billct = 1;
    const split = splitObjectStack(stack, 2);
    assert.ok(split);
    const entries = shopkeeper.eshk.bill;
    assert.equal(entries.length, 2);
    assert.equal(entries.find(e => e.bo_id === stack.o_id)?.bquan, 3);
    const splitEntry = entries.find(e => e.bo_id === split.o_id);
    assert.ok(splitEntry != null, 'Expected splitEntry to be initialized');
    assert.deepEqual([splitEntry.bquan, splitEntry.price, splitEntry.useup], [2, 4, false]);
});
void test('merging a split back folds the bill through the merge owner', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const stack = await floorObject(DAGGER, 10, 10, { dknown: true, quan: 5 });
    await addShopObjectToBill(stack, game, { ininv: false, silent: true });
    const split = splitObjectStack(stack, 2);
    const merged = await mergeObjectStacks(stack, split);
    assert.equal(merged, stack);
    assert.equal(stack.quan, 5);
    assert.ok(split != null, 'Expected split to be initialized');
    assert.equal(split.where, 'gone');
    const entries = shopkeeper.eshk.bill;
    assert.equal(entries.length, 1);
    assert.ok(entries[0] != null);
    assert.equal(entries[0].bo_id, stack.o_id);
    assert.equal(entries[0].bquan, 5);
});
void test('equal-price items from different keepers cannot merge', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const { shopkeeper: other } = await createStaffedShop({
        left: 27, right: 33, top: 9, bottom: 11, keeperX: 32, keeperY: 10,
    });
    const first = await floorObject(DAGGER, 10, 10, { dknown: true, quan: 3 });
    await addShopObjectToBill(first, game, { ininv: false, silent: true });
    // An absent keeper leaves an outstanding bill; a tended-shop exit
    // would instead convert the first purchase to a robbery.
    placeMonsterAt(shopkeeper, 5, 5);
    await moveHeroTo(30);
    placeMonsterAt(shopkeeper, 12, 10);
    const second = await floorObject(DAGGER, 30, 10, { dknown: true });
    await addShopObjectToBill(second, game, { ininv: false, silent: true });
    assert.equal(first.unpaid, true);
    assert.equal(second.unpaid, true);
    assert.ok(other.eshk.bill[0] != null);
    assert.ok(shopkeeper.eshk.bill[0] != null);
    assert.equal(shopkeeper.eshk.bill[0].price, other.eshk.bill[0].price);
    assert.equal(await mergeObjectStacks(first, second), null);
    assert.equal(first.quan, 3);
    assert.equal(second.quan, 1);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(other.eshk.bill.length, 1);
    assert.equal(shopkeeper.eshk.bill[0].bquan, 3);
    assert.equal(other.eshk.bill[0].bquan, 1);
});
void test('placing an unpaid free crysknife degrades it onto the bill', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    // C obj_no_longer_held: the release charges a top-level unpaid
    // crysknife before it reverts to a worm tooth.
    const knife = await knownObject(CRYSKNIFE, { dknown: true, unpaid: true, oerodeproof: false, where: 'free' });
    await placeObject(knife, 10, 10);
    assert.equal(knife.where, 'floor');
    assert.equal(knife.otyp, WORM_TOOTH); // reverted during release
    assert.equal(knife.unpaid, false);
    assert.ok(shopkeeper.eshk.bill.some(entry => entry.useup), 'degrade charge folded onto the bill');
    assert.match(game._lastPlineMessage, /You degrade .* you pay for/);
});
void test('a contained unbilled crysknife in a dropped sack reverts silently', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    // A legitimately held container: the knife is carried (not billed),
    // so C billable() can claim it once the sack is unlinked - but the
    // costly_alteration switch has no OBJ_CONTAINED case, so nothing is
    // charged and only the reversion happens.
    const bag = await uninitializedObject(SACK, { dknown: true, where: 'inventory' });
    const knife = await knownObject(CRYSKNIFE, { dknown: true, oerodeproof: false });
    knife.where = 'free';
    await addObjectToContainer(bag, knife, game);
    game.inventory.unshift(bag);
    unlinkObject(bag, game);
    bag.where = 'free';
    game._pending_message = '';
    game._lastPlineMessage = '';
    await placeObject(bag, 10, 10);
    assert.equal(bag.where, 'floor');
    assert.equal(knife.otyp, WORM_TOOTH); // reverted during release
    assert.equal(knife.where, 'contained');
    // No degrade dummy, no bill entry at all, no speech.
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(game._lastPlineMessage, '');
});
void test('a sleeping keeper offers no greeting or pickup quote', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    shopkeeper.msleeping = 1;
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: true });
    const transaction = await addShopObjectToBill(dagger);
    assert.ok(transaction);
    assert.equal(billedPickupQuote(transaction, 'dagger'), null);
    shopkeeper.msleeping = 0;
    assert.match(billedPickupQuote(transaction, 'dagger') ?? '', /For you/);
});
for (const away of [false, true]) {
    void test(`billing looks up an angry keeper ${away ? 'outside' : 'inside'} the shop`, async (t) => {
        freshObjectRoom({ right: 25 });
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop();
        const first = await floorObject(DAGGER, 10, 10);
        await addShopObjectToBill(first, game, { silent: true });
        const firstEntry = shopkeeper.eshk.bill[0];
        assert.ok(firstEntry != null, 'Expected firstEntry to be initialized');
        const oldPrice = firstEntry.price;
        shopkeeper.mpeaceful = 0;
        if (away)
            shopkeeper.mx = 20;
        const second = await floorObject(DAGGER, 10, 10);
        await addShopObjectToBill(second, game, { silent: true });
        assert.equal(firstEntry.price, oldPrice + Math.ceil(oldPrice / 3));
        assert.equal(!!second.unpaid, !away);
        assert.equal(shopkeeper.eshk.bill.length, away ? 1 : 2);
    });
}
void test('altering a billed stack keeps its unit charge and riles earlier billed keepers', async (t) => {
    const { shopkeeper } = await staffedShop(t);
    requirePlayingGame(game);
    const stack = await floorObject(DAGGER, 10, 10, { quan: 3, initialize: false });
    await addShopObjectToBill(stack, game, { silent: true });
    assert.ok(shopkeeper.eshk.bill[0] != null);
    const unitPrice = shopkeeper.eshk.bill[0].price;
    unlinkObject(stack);
    await addInventoryItem(stack);
    const { shopkeeper: other } = await createStaffedShop({
        left: 27, right: 33, top: 9, bottom: 11, keeperX: 32, keeperY: 10,
    });
    placeMonsterAt(shopkeeper, 5, 5);
    await moveHeroTo(30);
    placeMonsterAt(shopkeeper, 12, 10);
    const stock = await floorObject(DAGGER, 30, 10);
    await addShopObjectToBill(stock, game, { silent: true });
    const otherEntry = other.eshk.bill[0];
    assert.ok(otherEntry != null, 'Expected otherEntry to be initialized');
    const otherPrice = otherEntry.price;
    other.mpeaceful = 0;
    game.level.monsters = [other, shopkeeper];
    placeMonsterAt(other, 5, 5);
    await moveHeroTo(10);
    placeMonsterAt(other, 32, 10);
    const charge = await chargeAlteredUnpaidObject(stack, 'disenchant');
    assert.ok(charge && typeof charge === 'object');
    assert.ok(charge.entry && charge.object);
    assert.equal(charge.entry.price, unitPrice);
    assert.equal(charge.entry.bquan, 3);
    assert.equal(charge.entry.price * charge.entry.bquan, unitPrice * 3);
    assert.equal(otherEntry.price, otherPrice + Math.ceil(otherPrice / 3));
    assert.equal(stack.unpaid, false);
    assert.equal(charge.object.where, 'onbill');
    assert.equal(charge.object.unpaid, true);
});
//# sourceMappingURL=shop_billing.test.js.map