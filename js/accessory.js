// Rings and amulets worn by the hero.
// C refs: worn.c:setworn(), do_wear.c:Ring_on(), Ring_off(), Amulet_on(),
// and Amulet_off().

import { W_AMUL, W_RINGL, W_RINGR } from './const.js';
import { game } from './gstate.js';
import { OBJECT_PROPERTY } from './object_data.js';
import {
    grantWornProperty, removeWornProperty,
} from './properties.js';
import { releaseWeaponSlots } from './weapon_slots.js';

const ACCESSORY_SLOTS = Object.freeze({
    uleft: { mask: W_RINGL, label: 'left-ring' },
    uright: { mask: W_RINGR, label: 'right-ring' },
    uamul: { mask: W_AMUL, label: 'uamul' },
});

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
    return property || null;
}
