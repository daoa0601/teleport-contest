import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOST_DROPPED, SHOPBASE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { meldNearbyFloorGlobs, runClaimedGlobTimer } from '../js/glob.js';
import { claimNextDueObjectTimer, OBJECT_TIMER_KIND, scheduleObjectTimer } from '../js/object_timers.js';
import { landFloorObject } from '../js/floor_effects.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { unlinkObject } from '../js/object_location.js';
import { GLOB_OF_BLACK_PUDDING } from '../js/object_data.js';
import { addShopObjectToBill, billForObject, carriedShopBill } from '../js/shk.js';
import { shopOfferForObject } from '../js/shop_sell.js';
import { pushKeys } from '../js/input.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
async function glob(properties = {}) {
    return await knownObject(GLOB_OF_BLACK_PUDDING, properties);
}
async function land(object) {
    pushKeys('                                                                                ');
    await landFloorObject(object, 12, 10);
}
function requireBill(object) {
    const bill = billForObject(object);
    assert.ok(bill, 'The shop must retain a bill for this object.');
    return bill;
}
async function billedGlob() {
    const object = await glob();
    placeCreatedObject(object, 13, 10);
    await addShopObjectToBill(object, game, { ininv: false, silent: true });
    assert.equal(object.unpaid, true);
    unlinkObject(object);
    return object;
}
void test('a billed glob returned into shop stock leaves no charge for the absorbed identity', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    const stock = placeCreatedObject(await glob(), 12, 10);
    const incoming = await billedGlob();
    await land(incoming);
    assert.equal(incoming.where, 'gone');
    assert.equal(stock.where, 'floor');
    assert.equal(shopkeeper.eshk.bill.length, 0);
});
void test('two billed globs combine their recorded charges, not their billed quantities', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const { shopkeeper } = await createStaffedShop();
    const stock = placeCreatedObject(await glob(), 12, 10);
    await addShopObjectToBill(stock, game, { ininv: false, silent: true });
    const incoming = await billedGlob();
    const total = shopkeeper.eshk.bill.reduce((sum, entry) => sum + entry.price, 0);
    await land(incoming);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(requireBill(stock).entry.price, total);
    assert.equal(requireBill(stock).entry.bquan, 1);
});
void test('a donated grown glob pays down shop debt and borrowed gold', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    placeCreatedObject(await glob(), 12, 10);
    const incoming = await glob();
    incoming.owt *= 2;
    // C globby donations multiply the quoted whole-glob offer by its size again.
    const amount = 2 * shopOfferForObject(incoming, shopkeeper);
    assert.ok(amount > 0);
    shopkeeper.eshk.debit = amount + 7;
    shopkeeper.eshk.loan = amount + 3;
    shopkeeper.eshk.credit = 4;
    await land(incoming);
    assert.equal(shopkeeper.eshk.debit, 7);
    assert.equal(shopkeeper.eshk.loan, 3);
    assert.equal(shopkeeper.eshk.credit, 4);
});
void test('a glob donation clears a smaller debt and adds the remainder to credit', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    placeCreatedObject(await glob(), 12, 10);
    const incoming = await glob();
    const offer = shopOfferForObject(incoming, shopkeeper);
    assert.ok(offer > 1);
    shopkeeper.eshk.debit = 1;
    shopkeeper.eshk.loan = 1;
    shopkeeper.eshk.credit = 4;
    await land(incoming);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.loan, 0);
    assert.equal(shopkeeper.eshk.credit, 4 + offer - 1);
});
void test('player material absorbed by a billed glob increases its outstanding price', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await createStaffedShop();
    const stock = placeCreatedObject(await glob(), 12, 10);
    await addShopObjectToBill(stock, game, { ininv: false, silent: true });
    const billed = billForObject(stock);
    assert.ok(billed !== null && billed !== undefined);
    const oldPrice = billed.entry.price;
    const incoming = await glob();
    const offer = shopOfferForObject(incoming, billed.resident);
    await land(incoming);
    assert.equal(requireBill(stock).entry.price, oldPrice + offer);
});
void test('shop material mixed into a player glob remains owed through a used-up charge', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    const owned = placeCreatedObject(await glob({ no_charge: true }), 12, 10);
    const incoming = await billedGlob();
    const oldPrice = requireBill(incoming).entry.price;
    await land(incoming);
    assert.equal(incoming.where, 'gone');
    assert.equal(billForObject(incoming), null);
    assert.equal(owned.no_charge, true);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    const [remainingCharge] = shopkeeper.eshk.bill;
    assert.ok(remainingCharge);
    assert.equal(remainingCharge.price, oldPrice);
    assert.equal(remainingCharge.useup, true);
    assert.ok(carriedShopBill(shopkeeper).some(({ object }) => object.o_id === remainingCharge.bo_id && object.where === 'onbill'));
});
void test('merging two player globs inside a staffed shop creates no charge or credit', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    placeCreatedObject(await glob({ no_charge: true }), 12, 10);
    const incoming = await glob();
    shopkeeper.eshk.debit = 9;
    shopkeeper.eshk.loan = 3;
    shopkeeper.eshk.credit = 4;
    await land(incoming);
    assert.equal(incoming.where, 'gone');
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(shopkeeper.eshk.debit, 9);
    assert.equal(shopkeeper.eshk.loan, 3);
    assert.equal(shopkeeper.eshk.credit, 4);
});
void test('a recently dropped glob can join an ordinary floor glob', async () => {
    freshObjectRoom();
    const settled = placeCreatedObject(await glob(), 12, 10);
    const incoming = await glob({ how_lost: LOST_DROPPED });
    const weight = settled.owt + incoming.owt;
    await land(incoming);
    assert.equal(incoming.where, 'gone');
    assert.equal(settled.owt, weight);
});
void test('absorbing a glob preserves the survivor name and rounds relative age', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.moves = 100;
    const settled = placeCreatedObject(await glob({ age: 10 }), 12, 10);
    const incoming = await glob({ age: 11, oname: 'Lunch' });
    await land(incoming);
    assert.equal(settled.age, 11);
    assert.equal(settled.oname || settled.oextra?.oname || '', '');
});
void test('a partly eaten glob retains its full mass while adding the incoming nutrition', async () => {
    freshObjectRoom();
    const settled = await glob();
    const incoming = await glob();
    settled.owt *= 2;
    settled.oeaten = 10;
    const weight = settled.owt + incoming.owt;
    const nutrition = settled.oeaten + incoming.owt;
    placeCreatedObject(settled, 12, 10);
    await land(incoming);
    assert.equal(settled.owt, weight);
    assert.equal(settled.oeaten, nutrition);
});
void test('a shop that does not sell food gives no credit for an absorbed glob', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop({ shopType: SHOPBASE + 1 });
    const stock = placeCreatedObject(await glob(), 12, 10);
    const incoming = await glob();
    shopkeeper.eshk.debit = 9;
    shopkeeper.eshk.loan = 3;
    shopkeeper.eshk.credit = 4;
    await land(incoming);
    assert.equal(incoming.where, 'gone');
    assert.equal(stock.where, 'floor');
    assert.equal(shopkeeper.eshk.debit, 9);
    assert.equal(shopkeeper.eshk.loan, 3);
    assert.equal(shopkeeper.eshk.credit, 4);
});
void test('a glob starts shrinking at the rounded average of the two prior deadlines', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.moves = 100;
    const settled = placeCreatedObject(await glob({ age: 0 }), 12, 10);
    const incoming = await glob({ age: 0 });
    scheduleObjectTimer(settled, OBJECT_TIMER_KIND.SHRINK_GLOB, 140, game);
    scheduleObjectTimer(incoming, OBJECT_TIMER_KIND.SHRINK_GLOB, 181, game);
    await land(incoming);
    const weight = settled.owt;
    game.moves = 160;
    assert.equal(claimNextDueObjectTimer(game, game.moves), null);
    game.moves = 161;
    const timer = claimNextDueObjectTimer(game, game.moves);
    assert.ok(timer);
    runClaimedGlobTimer(timer, game, game.moves);
    assert.equal(settled.owt, weight - 1);
});
void test('floor-to-floor absorption keeps ownership on the floor until billing is resolved', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const { shopkeeper } = await createStaffedShop();
    const settled = placeCreatedObject(await glob(), 12, 10);
    const incoming = placeCreatedObject(await glob(), 13, 10);
    incoming.owt *= 2;
    await addShopObjectToBill(settled, game, { ininv: false, silent: true });
    const charge = requireBill(settled).entry.price;
    game.u.ux0 = game.u.ux;
    game.u.ux = 16;
    updateHeroRoomMembership(game);
    pushKeys('                                        ');
    await meldNearbyFloorGlobs(incoming);
    // With the hero outside, C has no keeper fallback for two floor globs.
    // The free-object shop-return rule must not cancel this existing debt.
    assert.equal(settled.where, 'gone');
    assert.equal(shopkeeper.eshk.bill.length, 1);
    const [remainingCharge] = shopkeeper.eshk.bill;
    assert.ok(remainingCharge);
    assert.equal(remainingCharge.price, charge);
});
//# sourceMappingURL=glob_absorption.test.js.map