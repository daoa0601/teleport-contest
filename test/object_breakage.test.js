import test from 'node:test';
import assert from 'node:assert/strict';
import { breakFloorObject, objectBreaksOnImpact, } from '../js/object_breakage.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { carriedShopBill } from '../js/shk.js';
import { beginObjectBurn } from '../js/light.js';
import { OBJECT_NAMES, POT_HEALING, POT_OIL, POT_WATER, WORTHLESS_PIECE_OF_RED_GLASS, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
void test('ordinary potions break unless their impact resistance succeeds', async () => {
    initRng(1n);
    const potion = await knownObject(POT_WATER, { initialize: false });
    assert.equal(objectBreaksOnImpact(potion, () => 1), true);
    assert.equal(objectBreaksOnImpact(potion, () => 0), false);
});
void test('glass armor resists most impacts but glass gems do not shatter', async () => {
    initRng(1n);
    const crystalPlateMail = await knownObject(OBJECT_NAMES.indexOf('crystal plate mail'), { initialize: false });
    const glassGem = await knownObject(WORTHLESS_PIECE_OF_RED_GLASS, { initialize: false });
    assert.equal(objectBreaksOnImpact(crystalPlateMail, () => 89), false);
    assert.equal(objectBreaksOnImpact(crystalPlateMail, () => 90), true);
    assert.equal(objectBreaksOnImpact(glassGem, () => 99), false);
});
void test('crystal armor cracks three times before the next impact destroys it', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const armor = await floorObject(OBJECT_NAMES.indexOf('crystal plate mail'), 11, 10);
    const options = {
        publish: async () => { },
        random: () => 90,
    };
    for (let impact = 0; impact < 3; impact++)
        await breakFloorObject(armor, options);
    assert.equal(armor.where, 'floor');
    assert.equal(armor.oeroded, 3);
    await breakFloorObject(armor, options);
    assert.equal(armor.where, 'gone');
});
void test('a burning oil potion explodes when it shatters on the floor', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const potion = await floorObject(POT_OIL, game.u.ux, game.u.uy, {
        age: 200,
    });
    beginObjectBurn(potion);
    await breakFloorObject(potion, {
        publish: async () => { },
        random: () => 1,
        rollDice: () => 8,
    });
    assert.ok(game.u.uhp < 100);
    assert.equal(potion.where, 'gone');
    assert.equal(potion.lamplit, false);
});
void test('a free potion breaks and gives vapor at its explicit impact square', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.uhp = 10;
    game.u.uhpmax = 30;
    const potion = await knownObject(POT_HEALING, { ox: 50, oy: 18 });
    const messages = [];
    await breakFloorObject(potion, {
        x: game.u.ux, y: game.u.uy, fromInventory: true,
        random: () => 99, publish: text => messages.push(text),
    });
    assert.ok(game.u.uhp > 10);
    assert.equal(potion.where, 'gone');
    assert.ok(messages.some(text => /shatters/.test(text)));
});
void test('a blind hero hears a dropped potion shatter without seeing its description', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.blindTurns = 20;
    const potion = await knownObject(POT_WATER, { ox: 50, oy: 18 });
    const messages = [];
    await breakFloorObject(potion, {
        x: game.u.ux, y: game.u.uy, fromInventory: true,
        random: () => 99, publish: text => messages.push(text),
    });
    assert.equal(potion.where, 'gone');
    assert.ok(messages.some(text => /hear.*shatter/.test(text)));
    assert.ok(!messages.some(text => /^The .*shatters/.test(text)));
});
void test('breaking unpaid goods outside every shop retains a used-up bill rather than debt', async () => {
    freshGameplayRoom({ right: 18 });
    requirePlayingGame(game);
    const potion = await knownObject(POT_HEALING, { unpaid: true });
    const entry = { bo_id: potion.o_id, bquan: 1, price: 30, useup: false };
    const { shopkeeper } = await createStaffedShop({
        left: 12, right: 16, keeperX: 14, keeperY: 10, bill: [entry],
    });
    await breakFloorObject(potion, {
        x: game.u.ux, y: game.u.uy, fromInventory: true,
        random: () => 99, publish: () => { },
    });
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(entry.useup, true);
    assert.ok(carriedShopBill(shopkeeper).some(item => item.object === potion));
    assert.equal(potion.where, 'onbill');
    assert.equal(potion.unpaid, false);
});
void test('breaking an unpaid carried potion in the shop converts its recorded price to debt', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const potion = await knownObject(POT_HEALING, { unpaid: true });
    const entry = { bo_id: potion.o_id, bquan: 1, price: 30, useup: false };
    const { shopkeeper } = await createStaffedShop({
        keeperX: 12, keeperY: 10, bill: [entry],
    });
    await breakFloorObject(potion, {
        x: game.u.ux, y: game.u.uy, fromInventory: true,
        random: () => 99, publish: () => { },
    });
    assert.equal(shopkeeper.eshk.debit, 30);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(potion.where, 'gone');
    assert.equal(potion.no_charge, true);
});
void test('shattered unpaid crystal armor remains on the used-up bill even inside its shop', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const armor = await knownObject(OBJECT_NAMES.indexOf('crystal plate mail'), {
        unpaid: true, oeroded: 3,
    });
    const entry = { bo_id: armor.o_id, bquan: 1, price: 800, useup: false };
    const { shopkeeper } = await createStaffedShop({
        keeperX: 12, keeperY: 10, bill: [entry],
    });
    await breakFloorObject(armor, {
        x: game.u.ux, y: game.u.uy, fromInventory: true,
        random: () => 90, publish: () => { },
    });
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(entry.useup, true);
    assert.equal(armor.where, 'onbill');
    assert.ok(!armor.no_charge);
});
//# sourceMappingURL=object_breakage.test.js.map