// attrib.js — Effective hero attributes and exercise state.
// C refs: attrib.c acurr(), acurrstr(), and exercise().

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { GAUNTLETS_OF_POWER } from './object_data.js';

const A_STR = 0;
const STR25 = 125;

function wornObject(state, slot) {
    return state?.[slot] || state?.u?.[slot] || null;
}

// Base attributes remain stored in u.acurr.  Equipment overrides belong in
// this projection so taking an item off immediately reveals the prior value.
export function currentAttribute(index, state = game) {
    if (index === A_STR
        && wornObject(state, 'uarmg')?.otyp === GAUNTLETS_OF_POWER) {
        return STR25;
    }
    return state?.u?.acurr?.a?.[index] ?? 10;
}

export function exerciseAttribute(index, improving, state = game) {
    const hero = state.u || (state.u = {});
    const current = currentAttribute(index, state);
    const amount = improving ? (rn2(19) > current ? 1 : 0) : -rn2(2);
    if (!Array.isArray(hero._exercise)) hero._exercise = Array(6).fill(0);
    hero._exercise[index] += amount;
}
