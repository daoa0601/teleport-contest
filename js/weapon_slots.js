// Hero weapon and quiver slot changes.
// C refs: wield.c setuwep(), setuswapwep(), setuqwep(), uwepgone().

import {
    W_QUIVER, W_SWAPWEP, W_WEAPONS, W_WEP,
} from './const.js';
import { game } from './gstate.js';
import { artifactEmitsLight } from './artifacts.js';
import { endObjectBurn } from './light.js';
import {
    HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_SUBTYPE, TIN_OPENER,
} from './object_data.js';

export function isWeldedPrimary(object, state = game) {
    if (object !== (state.uwep || state.u?.uwep) || !object?.cursed)
        return false;
    const weaponTool = object.oclass === 6
        && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0;
    return object.oclass === 2 || weaponTool
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(object.otyp);
}

function slotObject(slot, state) {
    return state[slot] || state.u?.[slot] || null;
}

function clearSlot(slot, mask, flag, state) {
    const object = slotObject(slot, state);
    state[slot] = null;
    if (state.u) state.u[slot] = null;
    if (!object) return null;
    if (slot === 'uwep' && artifactEmitsLight(object) && object.lamplit)
        endObjectBurn(object, state);
    object[flag] = false;
    object.owornmask = (object.owornmask ?? 0) & ~mask;
    return object;
}

function installSlot(object, slot, mask, flag, state) {
    state[slot] = object;
    if (state.u) state.u[slot] = object;
    object.wielded = flag === 'wielded';
    object.alternate = flag === 'alternate';
    object.ready = flag === 'ready';
    object.owornmask = (object.owornmask ?? 0) | mask;
}

function replaceSlot(object, slot, mask, flag, state) {
    const oldObject = slotObject(slot, state);
    if (oldObject !== object) clearSlot(slot, mask, flag, state);
    if (!object) return oldObject;
    if (oldObject !== object) releaseWeaponSlots(object, state);
    installSlot(object, slot, mask, flag, state);
    return oldObject;
}

export function setPrimaryWeapon(object, state = game) {
    return replaceSlot(object, 'uwep', W_WEP, 'wielded', state);
}

export function setSecondaryWeapon(object, state = game) {
    return replaceSlot(
        object, 'uswapwep', W_SWAPWEP, 'alternate', state,
    );
}

export function setQuiverObject(object, state = game) {
    return replaceSlot(object, 'uquiver', W_QUIVER, 'ready', state);
}

export function releaseWeaponSlots(object, state = game) {
    if (!object) return;
    const primary = state.uwep === object || state.u?.uwep === object;
    const secondary = state.uswapwep === object
        || state.u?.uswapwep === object;

    if (primary && artifactEmitsLight(object) && object.lamplit)
        endObjectBurn(object, state);

    if (state.uwep === object) state.uwep = null;
    if (state.u?.uwep === object) state.u.uwep = null;
    if (state.uswapwep === object) state.uswapwep = null;
    if (state.u?.uswapwep === object) state.u.uswapwep = null;
    if (state.uquiver === object) state.uquiver = null;
    if (state.u?.uquiver === object) state.u.uquiver = null;

    if (primary) state._unweapon = true;
    if ((primary || secondary) && state.u) state.u.twoweap = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEAPONS;
}
