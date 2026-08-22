import test from 'node:test';
import assert from 'node:assert/strict';

import {
    OBJECT_ARMOR_BONUS, applyArmorOnEffects, armorBaseBonus, armorBonus,
    armorOnIdentifiesType, findArmorClass, heroIsDisplaced,
} from '../js/armor.js';
import { currentAttribute } from '../js/attrib.js';
import { formatStrength } from '../js/display.js';
import { weightCapacity } from '../js/weight.js';
import {
    AMULET_OF_GUARDING, CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE,
    GAUNTLETS_OF_POWER, LEATHER_GLOVES, RING_MAIL, RIN_PROTECTION, ROBE,
    SMALL_SHIELD,
} from '../js/object_data.js';

test('ARM_BONUS uses complete source a_ac metadata, enchantment, and erosion', () => {
    assert.equal(OBJECT_ARMOR_BONUS.length, 84);
    assert.equal(armorBaseBonus(CLOAK_OF_MAGIC_RESISTANCE), 1);
    assert.equal(armorBaseBonus(RING_MAIL), 3);
    assert.equal(armorBaseBonus(ROBE), 2);
    assert.equal(armorBonus({ otyp: RING_MAIL, spe: 1 }), 4);
    assert.equal(armorBonus({ otyp: RING_MAIL, spe: 1, oeroded: 2 }), 2);
    assert.equal(armorBonus({ otyp: ROBE, enchantment: -1, erosion: 8 }), -1);
});

test('find_ac rebuilds all equipment and protection sources from live state', () => {
    const state = {
        u: {
            baseArmorClass: 10,
            intrinsicProtection: true,
            ublessed: 2,
            uspellprot: 1,
        },
        uarm: { otyp: RING_MAIL, spe: 1 },
        uarmc: { otyp: ROBE, spe: 0 },
        uarms: { otyp: SMALL_SHIELD, spe: 0 },
        uarmg: { otyp: LEATHER_GLOVES, spe: 0 },
        uleft: { otyp: RIN_PROTECTION, spe: 2 },
        uamul: { otyp: AMULET_OF_GUARDING, spe: 0 },
    };

    assert.equal(findArmorClass(state), -5);
    assert.equal(state.u.uac, -5);
});

test('removing the Wizard cloak recomputes AC from 9 to 10', () => {
    const cloak = { otyp: CLOAK_OF_MAGIC_RESISTANCE, spe: 0 };
    const state = { u: { uac: 9 }, uarmc: cloak };

    assert.equal(findArmorClass(state), 9);
    state.uarmc = null;
    assert.equal(findArmorClass(state), 10);
});

test('gauntlets of power project Strength 25 without mutating the base', () => {
    const gauntlets = { otyp: GAUNTLETS_OF_POWER };
    const state = {
        u: { acurr: { a: [9, 10, 10, 10, 10, 10] } },
        uarmg: gauntlets,
        inventory: [],
    };

    assert.equal(currentAttribute(0, state), 125);
    assert.equal(formatStrength(currentAttribute(0, state)), '25');
    assert.equal(state.u.acurr.a[0], 9);
    assert.equal(weightCapacity(state), 925);
    state.uarmg = null;
    assert.equal(currentAttribute(0, state), 9);
    assert.equal(state.u.acurr.a[0], 9);
});

test('cloak displacement property precedes observable Cloak_on feedback', () => {
    const cloak = {
        otyp: CLOAK_OF_DISPLACEMENT,
        _displacementWasActive: false,
    };
    const state = {
        u: { uarmc: cloak },
        uarmc: cloak,
        blind: false,
        invisible: false,
    };

    assert.equal(heroIsDisplaced(state), true);
    const messages = applyArmorOnEffects(cloak, state);
    assert.deepEqual(messages, [
        'You feel that monsters have difficulty pinpointing your location.',
    ]);
    assert.equal(armorOnIdentifiesType(cloak, messages), true);
});
