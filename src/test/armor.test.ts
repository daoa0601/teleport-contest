import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyArmorOnEffects,
    armorBaseBonus,
    armorBonus,
    armorOnIdentifiesType,
    findArmorClass,
    heroIsDisplaced,
    removeArmorProperties,
    wearHeroArmor,
} from '../js/armor.js';
import { currentAttribute } from '../js/attrib.js';
import { A_STR } from '../js/const.js';
import { formatStrength } from '../js/display.js';
import { weightCapacity } from '../js/weight.js';
import {
    AMULET_OF_GUARDING,
    CLOAK_OF_DISPLACEMENT,
    CLOAK_OF_MAGIC_RESISTANCE,
    GAUNTLETS_OF_POWER,
    LEATHER_GLOVES,
    RING_MAIL,
    RIN_PROTECTION,
    ROBE,
    RED_DRAGON_SCALE_MAIL,
    SMALL_SHIELD,
} from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addInventoryObject, uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('ARM_BONUS uses complete source a_ac metadata, enchantment, and erosion', () => {
    assert.equal(armorBaseBonus(CLOAK_OF_MAGIC_RESISTANCE), 1);
    assert.equal(armorBaseBonus(RING_MAIL), 3);
    assert.equal(armorBaseBonus(ROBE), 2);
    assert.equal(armorBonus({ otyp: RING_MAIL, spe: 1 }), 4);
    assert.equal(armorBonus({ otyp: RING_MAIL, spe: 1, oeroded: 2 }), 2);
    assert.equal(armorBonus({ otyp: ROBE, enchantment: -1, oeroded: 8 }), -1);
});

void test('find_ac rebuilds all equipment and protection sources from live state', async () => {
    freshObjectRoom({ hero: { ublessed: 2, uspellprot: 1 } });
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(RING_MAIL, { spe: 1 }));
    wearHeroArmor(await addInventoryObject(ROBE, { spe: 0 }));
    wearHeroArmor(await addInventoryObject(SMALL_SHIELD, { spe: 0 }));
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES, { spe: 0 }));
    await wearHeroAccessory(await addInventoryObject(RIN_PROTECTION, { spe: 2 }), 'uleft');
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_GUARDING), 'uamul');
    grantIntrinsicProperty('protection', 'outside');

    assert.equal(findArmorClass(), -5);
    assert.equal(game.u.uac, -5);
});

void test('removing the Wizard cloak recomputes AC from 9 to 10', async () => {
    freshObjectRoom({ hero: { uac: 9 } });
    requirePlayingGame(game);
    const state = game;
    state.uarmc = await uninitializedObject(CLOAK_OF_MAGIC_RESISTANCE, { spe: 0 });

    assert.equal(findArmorClass(state), 9);
    state.uarmc = null;
    assert.equal(findArmorClass(state), 10);
});

void test('gauntlets of power project Strength 25 without mutating the base', async () => {
    freshObjectRoom({ hero: { acurr: { a: [9, 10, 10, 10, 10, 10] } } });
    requirePlayingGame(game);
    const state = game;
    state.uarmg = await uninitializedObject(GAUNTLETS_OF_POWER);

    assert.equal(currentAttribute(A_STR, state), 125);
    assert.equal(formatStrength(currentAttribute(A_STR, state)), '25');
    assert.equal(state.u.acurr.a[A_STR], 9);
    assert.equal(weightCapacity(state), 925);
    state.uarmg = null;
    assert.equal(currentAttribute(A_STR, state), 9);
    assert.equal(state.u.acurr.a[A_STR], 9);
});

void test('cloak displacement property precedes observable Cloak_on feedback', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const state = game;
    const cloak = await uninitializedObject(CLOAK_OF_DISPLACEMENT, {
        _displacementWasActive: false,
    });
    state.u.uarmc = state.uarmc = cloak;
    state.blind = false;
    state.invisible = false;

    assert.equal(heroIsDisplaced(state), true);
    const messages = await applyArmorOnEffects(cloak, state);
    assert.deepEqual(messages, [
        'You feel that monsters have difficulty pinpointing your location.',
    ]);
    assert.equal(armorOnIdentifiesType(cloak, messages), true);
});

void test('taking off dragon armor removes only the armor resistance', async () => {
    freshObjectRoom({ hero: { _propertySources: {} } });
    requirePlayingGame(game);
    const state = game;
    const armor = await uninitializedObject(RED_DRAGON_SCALE_MAIL, { worn: true });
    state.uarm = armor;
    grantIntrinsicProperty('fireResistance', 'race', state);

    await applyArmorOnEffects(armor, state);
    assert.equal(state.u.fireResistanceFromArmor, true);

    await removeArmorProperties(armor, state);
    assert.equal(state.u.fireResistance, true);
    assert.equal(state.u.fireResistanceFromArmor, false);
});
