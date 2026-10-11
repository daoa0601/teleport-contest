import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { DAGGER } from '../js/object_data.js';
import {
    chargeDestroyedShopContent, settleDestroyedShopCharges, stolenValue,
} from '../js/shop_loss.js';
import { SACK } from '../js/object_data.js';
import { shopObjectUnitCost } from '../js/shk.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';

const SHOP = { left: 9, right: 13, top: 9, bottom: 11 };

function collector() {
    const messages: string[] = [];
    return { messages, publish: (text: string) => { messages.push(text); } };
}

async function lossShop({ shoptype }: { shoptype?: number } = {}) {
    freshObjectRoom({ ...SHOP, role: 'caveman' });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({
        ...SHOP, keeperX: 12, keeperY: 10, doorX: 9, doorY: 10,
        ...(shoptype === undefined ? {} : { shopType: shoptype }),
    });
    shopkeeper.gold = 1000;
    return { shopkeeper };
}

void test('an unbilled shop item charges its buy value as silent debt', async () => {
    const { shopkeeper } = await lossShop();
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10);
    const log = collector();
    const value = await stolenValue(dagger, 10, 10, true,
        { silent: true, publish: log.publish });
    assert.equal(value,
        shopObjectUnitCost(dagger, shopkeeper));
    assert.equal(shopkeeper.eshk.debit, value);
    assert.deepEqual(log.messages, []);
});

void test('an on-bill item is charged at its bill amount and leaves the bill', async () => {
    const { shopkeeper } = await lossShop();
    requirePlayingGame(game);
    const potion = await floorObject(DAGGER, 10, 10);
    potion.unpaid = true; // billed state is a fixture concern, not creation
    shopkeeper.eshk.bill = [
        { bo_id: potion.o_id, bquan: 1, useup: false, price: 40 },
    ];
    shopkeeper.eshk.billct = 1;
    const value = await stolenValue(potion, 10, 10, true,
        { silent: true, publish: collector().publish });
    assert.equal(value, 40);
    assert.equal(shopkeeper.eshk.debit, 40);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(potion.unpaid, false);
});

void test('shop credit absorbs part of a silent loss before debt', async () => {
    const { shopkeeper } = await lossShop();
    requirePlayingGame(game);
    shopkeeper.eshk.credit = 3;
    const dagger = await floorObject(DAGGER, 10, 10);
    const fullValue = shopObjectUnitCost(dagger, shopkeeper);
    assert.ok(fullValue > 3, 'fixture expects partial coverage');
    const log = collector();
    await stolenValue(dagger, 10, 10, true,
        { silent: true, publish: log.publish });
    assert.equal(shopkeeper.eshk.credit, 0);
    assert.equal(shopkeeper.eshk.debit, fullValue - 3);
    assert.ok(log.messages.some(message =>
        /price is .*covered by your credit/.test(message)));
});

void test('an angry keeper under a peaceful call books robbed without pursuit', async () => {
    const { shopkeeper } = await lossShop();
    requirePlayingGame(game);
    shopkeeper.mpeaceful = 0;
    const dagger = await floorObject(DAGGER, 10, 10);
    const log = collector();
    const value = await stolenValue(dagger, 10, 10, true,
        { silent: true, publish: log.publish });
    assert.equal(shopkeeper.eshk.robbed, value);
    assert.equal(shopkeeper.eshk.debit ?? 0, 0);
    assert.equal(shopkeeper.eshk.following ?? 0, 0);
    assert.ok(!log.messages.some(message => /thief/i.test(message)));
});

void test('a non-peaceful silent call still pursues and angers the guards', async () => {
    const { shopkeeper } = await lossShop();
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10);
    const log = collector();
    const value = await stolenValue(dagger, 10, 10, false,
        { silent: true, publish: log.publish });
    assert.equal(shopkeeper.eshk.robbed, value);
    assert.equal(shopkeeper.eshk.following, 1);
    assert.ok(!log.messages.some(message => /thief/i.test(message)));
});

void test('dropped own contents charge nothing while kicked contents do', async () => {
    const dropped = await lossShop();
    requirePlayingGame(game);
    const ownContent = await floorObject(DAGGER, 10, 10);
    const droppedLoss = await chargeDestroyedShopContent(
        ownContent, 10, 10, true);
    assert.equal(droppedLoss, 0);
    assert.equal(dropped.shopkeeper.eshk.debit ?? 0, 0);

    const kicked = await lossShop();
    requirePlayingGame(game);
    const content = await floorObject(DAGGER, 10, 10);
    const kickedLoss = await chargeDestroyedShopContent(
        content, 10, 10, false);
    assert.equal(kickedLoss,
        shopObjectUnitCost(content, kicked.shopkeeper));
    assert.equal(kicked.shopkeeper.eshk.debit, kickedLoss);
});

void test('an insider settles as debt, an outsider causes damage and anger', async () => {
    const inside = await lossShop();
    requirePlayingGame(game);
    const insiderLoss = await chargeDestroyedShopContent(
        await floorObject(DAGGER, 10, 10), 10, 10, false);
    const log = collector();
    const settled = await settleDestroyedShopCharges({
        loss: insiderLoss, x: 10, y: 10, publish: log.publish,
    });
    assert.equal(settled.settled, true);
    assert.ok(log.messages.some(message =>
        /You owe .* for objects destroyed/.test(message)));
    assert.equal(inside.shopkeeper.mpeaceful, 1);

    const outside = await lossShop();
    requirePlayingGame(game);
    game.level.requireAt(5, 5).typ = ROOM;
    game.level.requireAt(5, 5).roomno = 0;
    game.u.ux = 5;
    game.u.uy = 5;
    const outsiderLog = collector();
    const outsider = await settleDestroyedShopCharges({
        loss: 20, x: 10, y: 10, publish: outsiderLog.publish,
    });
    assert.equal(outsider.settled, true);
    assert.ok(outsiderLog.messages.some(message =>
        /You caused 20 zorkmids worth of damage!/.test(message)));
    assert.equal(outside.shopkeeper.mpeaceful, 0);
    assert.equal(outside.shopkeeper.eshk.following, 1);
});

void test('a doorway hero is an outsider: damage and anger, no debt line', async () => {
    const { shopkeeper } = await lossShop();
    requirePlayingGame(game);
    // The doorway carries the shop room number but the boundary edge flag.
    const doorway = game.level.requireAt(9, 10);
    doorway.roomno = shopkeeper.eshk.shoproom;
    doorway.edge = true;
    game.u.ux = 9;
    game.u.uy = 10;
    const log = collector();
    const settled = await settleDestroyedShopCharges({
        loss: 20, x: 10, y: 10, publish: log.publish,
    });
    assert.equal(settled.settled, true);
    assert.ok(log.messages.some(message =>
        /You caused 20 zorkmids worth of damage!/.test(message)));
    assert.equal(shopkeeper.mpeaceful, 0);
});

void test('a FREE no_charge container prices contents from the hero square', async () => {
    const { shopkeeper } = await lossShop();
    requirePlayingGame(game);
    const sack = await floorObject(SACK, 10, 10, { no_charge: true });
    sack.where = 'free'; // floorObject stamps floor; free is the C case
    const blade = await knownObject(DAGGER, { dknown: true, unpaid: true });
    blade.where = 'contained';
    blade.container = sack;
    sack.contents = [blade];
    // Hero at 10,10 with the keeper home at 12,10: not the free spot, so
    // the payable-contents test prices the blade, the shop claims the
    // sack, and the no_charge marking survives (C in-inventory containers
    // only add unpaid contents, which this one is).
    const away = await stolenValue(sack, 10, 10, true,
        { silent: true, publish: collector().publish });
    assert.ok(away > 0);
    assert.equal(sack.no_charge, true);

    const home = await lossShop();
    requirePlayingGame(game);
    const sackHome = await floorObject(SACK, 10, 10, { no_charge: true });
    sackHome.where = 'free';
    const bladeHome = await knownObject(DAGGER, { dknown: true, unpaid: true });
    bladeHome.where = 'contained';
    bladeHome.container = sackHome;
    sackHome.contents = [bladeHome];
    game.u.ux = home.shopkeeper.eshk.shk.x;
    game.u.uy = home.shopkeeper.eshk.shk.y;
    // On the free spot the contents price as zero, the sack stops being
    // billable, and the reset path clears its no_charge marking.
    const onSpot = await stolenValue(sackHome, 10, 10, true,
        { silent: true, publish: collector().publish });
    assert.ok(onSpot > 0); // the sack itself is charged after the reset
    assert.equal(sackHome.no_charge, false);
});

void test('nothing settles outside a costly spot', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const log = collector();
    const settled = await settleDestroyedShopCharges({
        loss: 20, x: 10, y: 10, publish: log.publish,
    });
    assert.deepEqual(settled, { loss: 20, settled: false });
    assert.equal(0, await chargeDestroyedShopContent(
        await knownObject(DAGGER), 10, 10, false));
});
