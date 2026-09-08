import test from 'node:test';
import assert from 'node:assert/strict';

import { removeHeroAccessory, wearHeroAccessory } from '../js/accessory.js';
import { findArmorClass } from '../js/armor.js';
import { currentAttribute } from '../js/attrib.js';
import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { artifactByName } from '../js/artifacts.js';
import { A_STR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { beginObjectBurn } from '../js/light.js';
import {
    BELL_OF_OPENING, CAN_OF_GREASE, CRYSTAL_BALL, MAGIC_FLUTE,
    MAGIC_MARKER, OBJECT_NAMES, OIL_LAMP, RIN_PROTECTION,
    WAN_FIRE, WAN_WISHING,
} from '../js/object_data.js';
import { chooseObjectToCharge, rechargeObject } from '../js/recharge.js';
import { weightCapacity } from '../js/weight.js';
import { unpaidObjectCost } from '../js/shk.js';
import { pickupAtHero } from '../js/pickup.js';
import { addInventoryObject, artifactObject, floorObject } from './support/game-objects.js';
import { readInventoryObject, invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

const SCR_CHARGING = OBJECT_NAMES.indexOf('charging');
const RIN_GAIN_STRENGTH = OBJECT_NAMES.indexOf('gain strength');

test('reading a blessed charging scroll restores a cancelled directional wand', async () => {
    freshObjectRoom({ gameplaySeed: 71 });
    const scroll = addInventoryObject(SCR_CHARGING, { blessed: true });
    const wand = addInventoryObject(WAN_FIRE, { spe: -1 });

    await readInventoryObject(scroll, wand.invlet);

    assert.ok(wand.spe >= 4 && wand.spe <= 8, `wand has ${wand.spe} charges`);
    assert.equal(wand.recharged, 1);
    assert.equal(scroll.where, 'gone');
    assert.equal(game.context.move, 1);
});

test('cancelling the charging choice still consumes and identifies the scroll', async () => {
    freshObjectRoom();
    const scroll = addInventoryObject(SCR_CHARGING, { typeKnown: false });
    const wand = addInventoryObject(WAN_FIRE, { spe: 0 });

    await readInventoryObject(scroll, '\x1b');

    assert.equal(game.inventory.includes(scroll), false);
    assert.ok(game._knownObjectTypes.has(SCR_CHARGING));
    assert.equal(wand.spe, 0);
    assert.equal(wand.recharged, 0);
    assert.equal(game.context.move, 1);
});

test('a confused charging scroll restores energy instead of charging an item', async () => {
    freshObjectRoom({ hero: { confusionTurns: 4, uen: 0, uenmax: 100 } });
    const scroll = addInventoryObject(SCR_CHARGING);

    await readInventoryObject(scroll, '\x1b');

    assert.equal(game.u.uen, 100);
    assert.equal(game.u.uenmax, 100);
    assert.equal(scroll.where, 'gone');
});

test('a confused blessed charging scroll can increase maximum energy', async () => {
    freshObjectRoom({ hero: { confusionTurns: 4, uen: 20, uenmax: 20 } });
    const scroll = addInventoryObject(SCR_CHARGING, { blessed: true });

    await readInventoryObject(scroll, '\x1b');

    assert.ok(game.u.uenmax >= 26 && game.u.uenmax <= 44);
    assert.equal(game.u.uen, game.u.uenmax);
});

test('a confused cursed charging scroll empties energy without reducing its maximum', async () => {
    freshObjectRoom({ hero: { confusionTurns: 4, uen: 20, uenmax: 20 } });
    const scroll = addInventoryObject(SCR_CHARGING, { cursed: true });

    await readInventoryObject(scroll, '\x1b');

    assert.equal(game.u.uen, 0);
    assert.equal(game.u.uenmax, 20);
});

test('a magic marker cannot be refilled a second time', async () => {
    freshObjectRoom();
    const marker = addInventoryObject(MAGIC_MARKER, { spe: 0 });
    await rechargeObject(marker, 1);
    assert.equal(marker.spe, 50);
    marker.spe = 2;
    pushKeys('\x1b');

    await rechargeObject(marker, 1);

    assert.equal(marker.spe, 2);
    assert.equal(marker.recharged, 1);
    assert.match(game._pending_message, /permanently dried out/);
});

test('cursed charging drains an ordinary wand but not a blessed one', async () => {
    freshObjectRoom();
    const plain = addInventoryObject(WAN_FIRE, { spe: 5 });
    const blessed = addInventoryObject(WAN_FIRE, { spe: 5, blessed: true });
    pushKeys('\x1b');

    await rechargeObject(plain, -1);
    await rechargeObject(blessed, -1);

    assert.equal(plain.spe, 0);
    assert.equal(blessed.spe, 5);
    assert.equal(blessed.recharged, 1);
});

test('blind charging describes a vibration without revealing an unseen wand', async () => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    const wand = addInventoryObject(WAN_FIRE, {
        observed: false, dknown: false, typeKnown: false, known: false, spe: 0,
    });

    await rechargeObject(wand, 1);

    assert.match(game._pending_message, /^Your wand vibrates (briefly|for a moment)\.$/);
});

test('a second recharge destroys a wishing wand and hurts its user', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const wand = addInventoryObject(WAN_WISHING, { spe: 0, recharged: 1 });
    pushKeys('\x1b');

    await rechargeObject(wand, 1);

    assert.equal(wand.where, 'gone');
    assert.equal(game.inventory.includes(wand), false);
    assert.ok(game.u.uhp >= 76 && game.u.uhp <= 98);
});

test('charging a worn protection ring changes armor class without removing the ring', async () => {
    freshObjectRoom();
    const ring = addInventoryObject(RIN_PROTECTION, { spe: 0 });
    wearHeroAccessory(ring, 'uleft');
    const armorClass = findArmorClass();

    await rechargeObject(ring, 0);

    assert.equal(ring.spe, 1);
    assert.equal(game.u.uac, armorClass - 1);
    assert.equal(game.uleft, ring);
    assert.match(inventoryItemDescription(ring), /\+1 ring of protection/);
});

test('charging a worn strength ring updates its bonus without changing innate strength', async () => {
    freshObjectRoom();
    const ring = addInventoryObject(RIN_GAIN_STRENGTH, { spe: 0 });
    wearHeroAccessory(ring, 'uright');
    const strength = currentAttribute(A_STR);

    await rechargeObject(ring, 0);

    assert.equal(currentAttribute(A_STR), strength + 1);
    assert.equal(game.u.acurr.a[A_STR], strength);
    assert.equal(game.uright, ring);
});

test('a constitution ring increases carrying capacity only while worn', () => {
    freshObjectRoom();
    const ring = addInventoryObject(OBJECT_NAMES.indexOf('gain constitution'), { spe: 2 });
    const capacity = weightCapacity(game);

    wearHeroAccessory(ring, 'uleft');
    assert.equal(weightCapacity(game), capacity + 50);

    removeHeroAccessory(ring);
    assert.equal(weightCapacity(game), capacity);
});

test('charging suggestions do not reveal an unidentified magical instrument', async () => {
    freshObjectRoom();
    const flute = addInventoryObject(MAGIC_FLUTE, { typeKnown: false, known: false });
    const wand = addInventoryObject(WAN_FIRE);
    const input = resetInputState();
    const selection = chooseObjectToCharge();
    await input.waitUntilBlocked();
    try {
        assert.match(game._pending_message, new RegExp(`\\[${wand.invlet} or`));
        assert.ok(!game._pending_message.includes(`[${flute.invlet}`));
    } finally {
        input.feed(flute.invlet);
        assert.equal(await selection, flute);
    }
});

test('an exploding worn ring loses its effect before dealing damage', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const ring = addInventoryObject(RIN_GAIN_STRENGTH, { spe: -5 });
    wearHeroAccessory(ring, 'uleft');
    const strength = currentAttribute(A_STR);
    pushKeys('\x1b');

    await rechargeObject(ring, 1);

    assert.equal(game.uleft, null);
    assert.equal(currentAttribute(A_STR), strength + 5);
    assert.equal(ring.where, 'gone');
    assert.ok(game.u.uhp < 100);
});

test('charging changes a crystal ball\'s blessing and can remove its curse', async () => {
    freshObjectRoom();
    const ball = addInventoryObject(CRYSTAL_BALL, { spe: 3, blessed: true });
    pushKeys('\x1b');
    await rechargeObject(ball, -1);
    assert.equal(ball.cursed, true);
    assert.equal(ball.spe, 0);

    await rechargeObject(ball, 0);
    assert.equal(ball.cursed, false);
    assert.ok(ball.spe >= 1 && ball.spe <= 2);

    await rechargeObject(ball, 1);
    assert.equal(ball.blessed, true);
    assert.equal(ball.spe, 7);
});

test('refilling a lamp restores fuel, and cursed charging extinguishes it', async () => {
    freshObjectRoom();
    const lamp = addInventoryObject(OIL_LAMP, { spe: 0, age: 0 });
    pushKeys('\x1b');
    await rechargeObject(lamp, 1);
    assert.equal(lamp.age, 1500);
    assert.equal(lamp.spe, 1);
    beginObjectBurn(lamp);

    await rechargeObject(lamp, -1);

    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.spe, 0);
    assert.equal(lamp.timed, 0);
});

test('repeated instrument charging respects its charge and counter limits', async () => {
    freshObjectRoom();
    const flute = addInventoryObject(MAGIC_FLUTE, { spe: 19, recharged: 7 });

    await rechargeObject(flute, 1);

    assert.equal(flute.spe, 20);
    assert.equal(flute.recharged, 7);
});

test('grease and the invocation bell stop at their own charge limits', async () => {
    freshObjectRoom();
    const grease = addInventoryObject(CAN_OF_GREASE, { spe: 49 });
    const bell = addInventoryObject(BELL_OF_OPENING, { spe: 5 });
    pushKeys('\x1b');

    await rechargeObject(grease, 1);
    await rechargeObject(bell, 1);

    assert.equal(grease.spe, 50);
    assert.equal(bell.spe, 5);
});

test('invoking the Card charges an item and starts its cooldown', async () => {
    freshObjectRoom({ role: 'tourist' });
    const card = artifactObject('The Platinum Yendorian Express Card', {
        invlet: 'a', where: 'inventory', blessed: true,
    });
    game.inventory.push(card);
    const ball = addInventoryObject(CRYSTAL_BALL, { spe: 0 });

    await invokeInventoryObject(card, ball.invlet);

    assert.equal(ball.spe, 7);
    assert.equal(ball.blessed, true);
    assert.ok(card.age > game.moves);
    assert.equal(game.context.move, 1);
});

test('cancelling the Card\'s charging choice does not start its cooldown', async () => {
    freshObjectRoom({ role: 'tourist' });
    const card = artifactObject('The Platinum Yendorian Express Card', {
        invlet: 'a', where: 'inventory',
    });
    game.inventory.push(card);

    await invokeInventoryObject(card, '\x1b');

    assert.equal(card.age, 0);
    assert.equal(game.context.move, 0);
});

test('the Card\'s blessing does not improve charging for another role', async () => {
    freshObjectRoom({ role: 'wizard' });
    const card = artifactObject('The Platinum Yendorian Express Card', { blessed: true });
    const ball = addInventoryObject(CRYSTAL_BALL, { spe: 0 });
    pushKeys(ball.invlet);

    await invokeArtifactPower(card, artifactByName('The Platinum Yendorian Express Card'));

    assert.ok(ball.spe >= 1 && ball.spe <= 2);
    assert.equal(ball.blessed, false);
});

test('destroying an unpaid wand preserves the amount owed to the shop', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const { shopkeeper } = await createStaffedShop();
    const wand = floorObject(WAN_WISHING, 10, 10, { spe: 0, recharged: 1 });
    pushKeys('\x1b');
    await pickupAtHero();
    const debt = unpaidObjectCost(wand);

    await rechargeObject(wand, 1);

    assert.equal(game.inventory.includes(wand), false);
    assert.equal(wand.where, 'onbill');
    const bill = shopkeeper.eshk.bill.find(entry => entry.bo_id === wand.o_id);
    assert.equal(bill.useup, true);
    assert.equal(bill.price * bill.bquan, debt);
});
