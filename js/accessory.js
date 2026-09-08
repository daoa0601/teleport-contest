// Rings and amulets worn by the hero.
// C refs: worn.c:setworn(), do_wear.c:Ring_on(), Ring_off(), Amulet_on(),
// and Amulet_off().

import { A_CHA, A_CON, A_STR, W_AMUL, W_RINGL, W_RINGR } from './const.js';
import { attributeIsAtLimit, currentAttribute } from './attrib.js';
import { findArmorClass } from './armor.js';
import { game } from './gstate.js';
import {
    AMULET_OF_STRANGULATION, OBJECT_CHARGED, OBJECT_NAMES,
    OBJECT_PROPERTY, RIN_PROTECTION,
} from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { heroIsBlind } from './senses.js';
import { objectTypeKnown } from './shk.js';
import {
    grantWornProperty, removeWornProperty,
} from './properties.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import {
    clearHeroStrangulation, heroIsStrangled, startAmuletStrangulation,
} from './hero_strangulation.js';

const ACCESSORY_SLOTS = Object.freeze({
    uleft: { mask: W_RINGL, label: 'left-ring' },
    uright: { mask: W_RINGR, label: 'right-ring' },
    uamul: { mask: W_AMUL, label: 'uamul' },
});

const RING_ATTRIBUTES = new Map([
    [OBJECT_NAMES.indexOf('gain strength'), A_STR],
    [OBJECT_NAMES.indexOf('gain constitution'), A_CON],
    [OBJECT_NAMES.indexOf('adornment'), A_CHA],
]);
const RIN_INCREASE_ACCURACY = OBJECT_NAMES.indexOf('increase accuracy');
const RIN_INCREASE_DAMAGE = OBJECT_NAMES.indexOf('increase damage');

export function wearHeroAccessory(object, slot, state = game) {
    const position = ACCESSORY_SLOTS[slot];
    if (!object || !position) return null;
    releaseWeaponSlots(object, state);
    state[slot] = object;
    if (state.u) state.u[slot] = object;
    object.worn = true;
    object.wornSlot = position.label;
    object.owornmask = (object.owornmask ?? 0) | position.mask;
    const property = OBJECT_PROPERTY[object.otyp];
    if (property) grantWornProperty(property, object, slot, state);
    if (slot !== 'uamul') changeRingBonus(object, 1, state);
    if (object.otyp === AMULET_OF_STRANGULATION) startAmuletStrangulation(state);
    return property || null;
}

export function removeHeroAccessory(object, state = game) {
    const slot = Object.keys(ACCESSORY_SLOTS).find(candidate =>
        state[candidate] === object || state.u?.[candidate] === object);
    if (!slot) return null;
    const position = ACCESSORY_SLOTS[slot];
    state[slot] = null;
    if (state.u) state.u[slot] = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~position.mask;
    const property = OBJECT_PROPERTY[object.otyp];
    if (property) removeWornProperty(property, object, slot, state);
    if (slot !== 'uamul') changeRingBonus(object, -1, state);
    if (object.otyp === AMULET_OF_STRANGULATION && heroIsStrangled(state)) {
        clearHeroStrangulation(state);
    }
    return property || null;
}

function changeRingBonus(ring, direction, state) {
    const attribute = RING_ATTRIBUTES.get(ring.otyp);
    if (attribute !== undefined) {
        const before = currentAttribute(attribute, state);
        state.u.abon ||= { a: Array(6).fill(0) };
        state.u.abon.a[attribute] += direction * ring.spe;
        const observable = before !== currentAttribute(attribute, state);
        if (observable || !attributeIsAtLimit(attribute, state))
            learnRing(ring, observable, state);
    } else if (ring.otyp === RIN_INCREASE_ACCURACY) {
        state.u.uhitinc = (state.u.uhitinc || 0) + direction * ring.spe;
    } else if (ring.otyp === RIN_INCREASE_DAMAGE) {
        state.u.udaminc = (state.u.udaminc || 0) + direction * ring.spe;
    } else if (ring.otyp === RIN_PROTECTION) {
        learnRing(ring, ring.spe !== 0, state);
        if (ring.spe) findArmorClass(state);
    }
}

function learnRing(ring, observable, state) {
    if (observable) {
        if (objectTypeKnown(ring, state)) {
            if (!heroIsBlind(state)) ring.dknown = true;
        } else if (ring.dknown) {
            learnObjectType(ring.otyp, state);
        }
    }
    if (ring.dknown && objectTypeKnown(ring, state) && OBJECT_CHARGED[ring.otyp])
        ring.known = true;
}
