import { rhack } from '../js/cmd.js';
import type { KnownObjectOverrides } from './support/game-objects.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { applyArmorOnEffects, findArmorClass, removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { currentAttribute } from '../js/attrib.js';
import { A_DEX } from '../js/const.js';
import { flushPendingTopline, pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { objectLightRadius } from '../js/light.js';
import {
    AMULET_OF_LIFE_SAVING, CORPSE, ELVEN_CLOAK, GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES,
    GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, LEATHER_ARMOR, LEATHER_GLOVES,
    LONG_SWORD, OBJECT_NAMES, RING_MAIL, SCR_DESTROY_ARMOR,
    SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SMALL_SHIELD,
} from '../js/object_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { propertyIsActive } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { applyArmorScrollEffect } from '../js/scroll_armor_effects.js';
import { unpaidObjectCost } from '../js/shk.js';
import { itemizedShopBill } from '../js/shop_payment.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, addInventoryWeapon, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { readInventoryObject } from './support/commands.js';

function armorEffectInput() {
    const input = resetInputState();
    // A single armor change can include item feedback, billing, petrification,
    // and the six messages of one successful life-saving sequence.
    installPagerInput(input, {
        expected: new RegExp([
            /(?:armor|mail|cloak|shield|scales|gloves|gauntlets).*(?:glow|vibrat|cover|warm|new|harden|bright|rust|rot|vanish)/.source,
            /amulet of life saving.*being worn|cancel that .*pay for it/.source,
            /bare hands|cockatrice|turn to stone|You die|But wait/.source,
            /medallion|feel much better|You owe|cost you/.source,
            /read the scroll|scroll disappears/.source,
        ].join('|')),
        limit: 12,
    });
    return input;
}

async function wornArmor(type: number, properties: KnownObjectOverrides = {}) {
    const armor = await addInventoryObject(type, { spe: 0, ...properties });
    wearHeroArmor(armor);
    await applyArmorOnEffects(armor);
    findArmorClass();
    return armor;
}

void test('enchant armor improves the exposed torso layer and uncurses it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const suit = await wornArmor(RING_MAIL, { spe: 0 });
    const cloak = await wornArmor(ELVEN_CLOAK, { spe: 0, cursed: true });
    const before = game.u.uac;
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR);

    const result = await applyArmorScrollEffect(scroll);

    assert.equal(suit.spe, 0);
    assert.ok(cloak.spe >= 1 && cloak.spe <= 3);
    assert.ok(!cloak.cursed);
    assert.equal(game.u.uac, before - cloak.spe);
    assert.equal(result.known, true);
    assert.equal(result.consumed, false);
    assert.ok(game.inventory.includes(scroll));
});

void test('blessed enchant armor blesses mundane armor and applies its native power range', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await wornArmor(LEATHER_ARMOR, { cursed: true });
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR, { blessed: true });

    await applyArmorScrollEffect(scroll);

    assert.ok(armor.blessed);
    assert.ok(!armor.cursed);
    assert.ok(armor.spe >= 1 && armor.spe <= 4);
});

void test('confused enchant armor repairs and proofs a shield without changing its blessing or enchantment', async () => {
    freshObjectRoom({ hero: { confusionTurns: 10 } });
    requirePlayingGame(game);
    const shield = await wornArmor(SMALL_SHIELD, { spe: 2, cursed: true, oeroded: 2, oeroded2: 1 });
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR, { blessed: true });
    armorEffectInput();

    const result = await applyArmorScrollEffect(scroll);

    assert.equal(shield.spe, 2);
    assert.ok(shield.cursed);
    assert.ok(shield.oerodeproof);
    assert.ok(shield.rknown);
    assert.equal(shield.oeroded, 0);
    assert.equal(shield.oeroded2, 0);
    assert.equal(result.known, false);
});

void test('blind confused enchant armor repairs damage without learning proofing', async () => {
    freshObjectRoom({ hero: { confusionTurns: 10, blindTurns: 20 } });
    requirePlayingGame(game);
    const armor = await wornArmor(RING_MAIL, { oeroded: 2, rknown: true });
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR);
    armorEffectInput();

    await applyArmorScrollEffect(scroll);

    assert.ok(armor.oerodeproof);
    assert.ok(!armor.rknown);
    assert.equal(armor.oeroded, 0);
    assert.match(game._pending_message, /feels as good as new/);
});

void test('cursed confused enchant armor removes proofing while retaining damage', async () => {
    freshObjectRoom({ hero: { confusionTurns: 10 } });
    requirePlayingGame(game);
    const armor = await wornArmor(RING_MAIL, { oerodeproof: true, oeroded: 1 });
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR, { cursed: true });

    await applyArmorScrollEffect(scroll);

    assert.ok(!armor.oerodeproof);
    assert.equal(armor.oeroded, 1);
    assert.equal(armor.spe, 0);
    assert.match(game._pending_message, /mottled black glow/);
});

void test('enchantment hardens dragon scales into mail while preserving their worn resistance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const scales = await wornArmor(GRAY_DRAGON_SCALES, { spe: 2, cursed: true });
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR, { blessed: true });

    const result = await applyArmorScrollEffect(scroll);

    assert.equal(scales.otyp, GRAY_DRAGON_SCALE_MAIL);
    assert.equal(scales.spe, 3);
    assert.ok(scales.blessed);
    assert.ok(scales.known);
    assert.equal(game.uarm, scales);
    assert.ok(propertyIsActive('antimagic'));
    assert.equal(game.u.uac, -2);
    assert.equal(result.known, false);
});

void test('gold scales remain lit as enchantment hardens them and increases their light radius', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const scales = await wornArmor(GOLD_DRAGON_SCALES);
    const radius = objectLightRadius(scales);
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR, { blessed: true });
    armorEffectInput();

    await applyArmorScrollEffect(scroll);

    assert.equal(scales.otyp, GOLD_DRAGON_SCALE_MAIL);
    assert.ok(scales.lamplit);
    assert.equal(objectLightRadius(scales), radius + 2);
    assert.match(game._pending_message, /shine[s]? much brighter/);
});

void test('enchanting dexterity gauntlets updates effective Dexterity and removal ends the bonus', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const gloves = await wornArmor(OBJECT_NAMES.indexOf('gauntlets of dexterity'), { spe: 1 });
    const base = game.u.acurr.a[A_DEX];
    assert.equal(currentAttribute(A_DEX), base + 1);
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR);

    await applyArmorScrollEffect(scroll);

    assert.equal(currentAttribute(A_DEX), base + gloves.spe);
    await removeHeroArmor(gloves);
    assert.equal(currentAttribute(A_DEX), base);
});

void test('over-enchantment can dissolve mundane armor while elven armor remains safe at +4', async () => {
    let dissolved = 0;
    let survived = 0;
    for (let seed = 1; seed <= 18; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        const armor = await wornArmor(RING_MAIL, { spe: 4 });
        const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR);
        initRng(BigInt(seed));
        armorEffectInput();

        await applyArmorScrollEffect(scroll);

        if (armor.where === 'gone') {
            dissolved++;
            assert.equal(game.uarm, null);
            assert.equal(game.u.uac, 10);
        } else survived++;
    }
    requirePlayingGame(game);
    assert.ok(dissolved > 0);
    assert.ok(survived > 0);
    freshObjectRoom();
    requirePlayingGame(game);
    const cloak = await wornArmor(ELVEN_CLOAK, { spe: 4 });
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR);
    armorEffectInput();
    await applyArmorScrollEffect(scroll);
    assert.equal(game.uarmc, cloak);
    assert.ok(cloak.spe >= 5);
});

void test('destroy armor erodes worn armor through grease', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await wornArmor(RING_MAIL, { greased: true });
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR);
    armorEffectInput();

    const result = await applyArmorScrollEffect(scroll);

    assert.ok(armor.oeroded !== undefined && armor.oeroded !== null, 'Expected armor.oeroded to be initialized');
    assert.ok(armor.oeroded > 0 || armor.where === 'gone');
    assert.ok(armor.greased);
    assert.ok(result.known);
    assert.equal(result.consumed, false);
});

void test('ordinary destroy armor cannot erode proofed armor and consumes the source as a strange feeling', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await wornArmor(RING_MAIL, { oerodeproof: true, oeroded: 1 });
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR);

    const result = await applyArmorScrollEffect(scroll);

    assert.equal(armor.oeroded, 1);
    assert.equal(game.uarm, armor);
    assert.equal(scroll.where, 'gone');
    assert.ok(result.consumed);
    assert.equal(result.known, false);
});

void test('failed armor magic consumes one scroll in its own strange-feeling branch', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR, { quan: 3 });

    const result = await applyArmorScrollEffect(scroll);

    assert.equal(scroll.quan, 2);
    assert.ok(game.inventory.includes(scroll));
    assert.ok(result.consumed);
    assert.equal(result.known, false);
    assert.equal(game._pending_message, 'Your skin glows then fades.');
});

void test('confused destroy armor toggles proofing without repairing or enchanting armor', async () => {
    for (const cursed of [false, true]) {
        freshObjectRoom({ hero: { confusionTurns: 10 } });
        requirePlayingGame(game);
        const armor = await wornArmor(RING_MAIL, { spe: 2, oeroded: 1, oerodeproof: !cursed });
        const scroll = await addInventoryObject(SCR_DESTROY_ARMOR, { cursed });

        const result = await applyArmorScrollEffect(scroll);

        assert.equal(armor.oerodeproof, cursed);
        assert.equal(armor.oeroded, 1);
        assert.equal(armor.spe, 2);
        assert.equal(result.known, false);
    }
});

void test('cursed destroy armor disenchants cursed armor down to -7 and adds stun', async () => {
    for (const spe of [-6, -7]) {
        freshObjectRoom({ hero: { stunnedTurns: 3 } });
        requirePlayingGame(game);
        const armor = await wornArmor(RING_MAIL, { cursed: true, spe });
        const scroll = await addInventoryObject(SCR_DESTROY_ARMOR, { cursed: true });
        armorEffectInput();

        const result = await applyArmorScrollEffect(scroll);

        assert.equal(armor.spe, -7);
        assert.ok(game.u.stunnedTurns !== undefined && game.u.stunnedTurns !== null, 'Expected game.u.stunnedTurns to be initialized');
        assert.ok(game.u.stunnedTurns >= 13 && game.u.stunnedTurns <= 22);
        assert.equal(game.uarm, armor);
        assert.equal(result.known, false);
    }
    requirePlayingGame(game);
});

void test('blessed destroy armor can select a suit covered by a cloak', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const suit = await wornArmor(RING_MAIL);
    const cloak = await wornArmor(ELVEN_CLOAK);
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR, { blessed: true });
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    game._knownObjectTypes.add(SCR_DESTROY_ARMOR);
    const input = resetInputState();

    const result = await answerPrompts(applyArmorScrollEffect(scroll), input, [
        { prompt: /What do you want to destroy\?/, keys: suit.invlet },
    ]);

    assert.equal(suit.where, 'gone');
    assert.equal(game.uarm, null);
    assert.equal(game.uarmc, cloak);
    assert.ok(result.known);
});

void test('cancelling blessed armor selection still disintegrates the originally chosen armor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const suit = await wornArmor(RING_MAIL);
    const cloak = await wornArmor(ELVEN_CLOAK);
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR, { blessed: true });
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    game._knownObjectTypes.add(SCR_DESTROY_ARMOR);
    const input = resetInputState();

    const result = await answerPrompts(applyArmorScrollEffect(scroll), input, [
        { prompt: /What do you want to destroy\?/, keys: '\x1b' },
    ]);

    assert.equal(cloak.where, 'gone');
    assert.equal(game.uarm, suit);
    assert.ok(result.known);
});

void test('blessed destroy armor disintegrates its sole cursed armor instead of eroding it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await wornArmor(RING_MAIL, { cursed: true });
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR, { blessed: true });

    const result = await applyArmorScrollEffect(scroll);

    assert.equal(armor.where, 'gone');
    assert.ok(result.known);
});

void test('losing gloves to destroy armor resolves petrification and life saving before completing destruction', async () => {
    freshObjectRoom({ hero: { glibTurns: 8, glib: true } });
    requirePlayingGame(game);
    const gloves = await wornArmor(LEATHER_GLOVES);
    const corpse = await addInventoryObject(CORPSE, { corpsenm: 10 });
    await setPrimaryWeapon(corpse);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR, { cursed: true });
    armorEffectInput();

    const result = await applyArmorScrollEffect(scroll);

    assert.ok(!result.heroDied);
    assert.equal(game.u.umortality, 1);
    assert.equal(amulet.where, 'gone');
    assert.equal(gloves.where, 'gone');
    assert.equal(game.uarmg, null);
    assert.equal(game.uwep, null);
    assert.ok(game.inventory.includes(corpse));
    assert.equal(game.u.glibTurns, 0);
});

void test('destroying armor interrupts an unfinished dressing action', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await addInventoryObject(RING_MAIL);
    assert.ok(armor.invlet);
    pushKeys(armor.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(game._delayedAction?.kind, 'wear');
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR, { cursed: true });

    await applyArmorScrollEffect(scroll);

    assert.equal(armor.where, 'gone');
    assert.equal(game._delayedAction, null);
    assert.equal(game.multi, 0);
});

void test('destroy armor charges the original price of eroded unpaid armor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const armor = await floorObject(RING_MAIL, 10, 10, { spe: 0 });
    pushKeys(' ');
    await pickupAtHero();
    const pickupInput = resetInputState();
    await answerPrompts(flushPendingTopline(), pickupInput, [
        { prompt: /ring mail \(unpaid, \d+ zorkmids\)/, keys: ' ' },
    ]);
    wearHeroArmor(armor);
    const price = unpaidObjectCost(armor);
    const scroll = await addInventoryObject(SCR_DESTROY_ARMOR);
    armorEffectInput();

    await applyArmorScrollEffect(scroll);

    assert.ok(price > 0);
    assert.ok(!armor.unpaid);
    assert.equal(itemizedShopBill(shopkeeper).reduce((sum, item) => sum + item.price, 0), price);
});

void test('armor mutation waits until the previous visible message has been acknowledged', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await wornArmor(RING_MAIL);
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR);
    const input = resetInputState();
    await pline('A very long previous message fills the visible line before the armor glows.');
    const effect = applyArmorScrollEffect(scroll);
    await input.waitUntilBlocked();
    try {
        assert.equal(armor.spe, 0);
        assert.ok(game.inventory.includes(scroll));
    } finally {
        await answerPrompts(effect, input, [
            { prompt: /A very long previous message.*before the armor glows\./, keys: ' ' },
        ]);
    }
    assert.ok(armor.spe > 0);
});

void test('armor dispatcher uses the existing enchant weapon owner', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const sword = await addInventoryWeapon(LONG_SWORD);
    await setPrimaryWeapon(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    const result = await applyArmorScrollEffect(scroll);

    assert.equal(sword.spe, 1);
    assert.equal(result.known, false);
    assert.equal(result.consumed, false);
});

void test('reading enchant armor discovers the scroll and consumes one quantity through the ordinary command', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await wornArmor(RING_MAIL);
    const scroll = await addInventoryObject(SCR_ENCHANT_ARMOR, { quan: 2, typeKnown: false });

    armorEffectInput();
    await readInventoryObject(scroll);

    assert.ok(armor.spe > 0);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.ok(game._knownObjectTypes?.has(SCR_ENCHANT_ARMOR));
    assert.equal(scroll.quan, 1);
    assert.equal(game.context.move, 1);
});
