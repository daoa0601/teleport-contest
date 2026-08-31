// attrib.js — Effective hero attributes and exercise state.
// C refs: attrib.c acurr(), acurrstr(), and exercise().

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { GAUNTLETS_OF_POWER } from './object_data.js';
import {
    A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, Upolyd,
} from './const.js';

const STR25 = 125;
const MAX_EXERCISE = 50;

export const ATTRIBUTE_DISPLAY_ORDER = Object.freeze([
    A_STR, A_DEX, A_CON, A_INT, A_WIS, A_CHA,
]);

function wornObject(state, slot) {
    return state?.[slot] || state?.u?.[slot] || null;
}

// Equipment changes the effective value without overwriting the base value.
export function currentAttribute(attribute, state = game) {
    if (attribute === A_STR
        && wornObject(state, 'uarmg')?.otyp === GAUNTLETS_OF_POWER) {
        return STR25;
    }
    return state?.u?.acurr?.a?.[attribute] ?? 10;
}

export function exerciseAttribute(attribute, improving, state = game) {
    const hero = state.u || (state.u = {});
    if (attribute === A_INT || attribute === A_CHA) return;
    if (Upolyd(hero) && attribute !== A_WIS) return;
    if (!Array.isArray(hero._exercise)) hero._exercise = Array(6).fill(0);
    if (Math.abs(hero._exercise[attribute] ?? 0) >= MAX_EXERCISE) return;

    const current = currentAttribute(attribute, state);
    const amount = improving ? (rn2(19) > current ? 1 : 0) : -rn2(2);
    hero._exercise[attribute] += amount;
}
