// attrib.js — Effective hero attributes and exercise state.
// C refs: attrib.c acurr(), acurrstr(), and exercise().

import { game } from './gstate.js';
import { artifactById } from './artifacts.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { rn2 } from './rng.js';
import { DUNCE_CAP, GAUNTLETS_OF_POWER } from './object_data.js';
import {
    A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, Upolyd,
} from './const.js';

const STR25 = 125;
const MAX_EXERCISE = 50;
const PM_AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');
const S_NYMPH = 14;

const ATTRIBUTE_GAIN_WORD = [
    'stronger', 'smarter', 'wiser', 'more agile', 'tougher', 'more charismatic',
];
const ATTRIBUTE_LOSS_WORD = [
    'weaker', 'stupid', 'foolish', 'clumsy', 'fragile', 'repulsive',
];
const ATTRIBUTE_NAME = [
    'strength', 'intelligence', 'wisdom', 'dexterity', 'constitution',
    'charisma',
];

export const ATTRIBUTE_DISPLAY_ORDER = Object.freeze([
    A_STR, A_DEX, A_CON, A_INT, A_WIS, A_CHA,
]);

function wornObject(state, slot) {
    return state?.[slot] || state?.u?.[slot] || null;
}

// Equipment changes the effective value without overwriting the base value.
export function currentAttribute(attribute, state = game) {
    const hero = state.u;
    let value = (hero.acurr?.a?.[attribute] ?? 10)
        + (hero.abon?.a?.[attribute] ?? 0) + (hero.atemp?.a?.[attribute] ?? 0);
    if (attribute === A_CHA && (MONSTER_SYMBOL[hero.umonnum] === S_NYMPH
        || hero.umonnum === PM_AMOROUS_DEMON)) value = Math.max(18, value);
    const [minimum, maximum] = attributeLimits(attribute, state);
    return Math.max(minimum, Math.min(maximum, value));
}

function attributeLimits(attribute, state) {
    if (attribute === A_STR)
        return [wornObject(state, 'uarmg')?.otyp === GAUNTLETS_OF_POWER ? STR25 : 3, STR25];
    if (attribute === A_CON
        && artifactById(wornObject(state, 'uwep')?.oartifact)?.name === 'Ogresmasher')
        return [25, 25];
    if ((attribute === A_INT || attribute === A_WIS)
        && wornObject(state, 'uarmh')?.otyp === DUNCE_CAP) return [6, 6];
    return [3, 25];
}

export function attributeIsAtLimit(attribute, state = game) {
    const value = currentAttribute(attribute, state);
    return attributeLimits(attribute, state).includes(value);
}

export function adjustAttribute(attribute, amount, state = game) {
    const hero = state.u || (state.u = {});
    if (!amount || hero.fixedAbilities || hero.fixed_abil) {
        return { changed: false, amount, fixed: true };
    }
    const helmet = wornObject(state, 'uarmh');
    if ((attribute === A_INT || attribute === A_WIS)
        && helmet?.otyp === DUNCE_CAP) {
        return { changed: false, amount, blockedByDunceCap: true };
    }

    const current = hero.acurr?.a;
    const maximum = hero.amax?.a;
    if (!Array.isArray(current) || !Array.isArray(maximum))
        return { changed: false, amount };

    const oldValue = currentAttribute(attribute, state);
    const oldBase = current[attribute];
    const oldMaximum = maximum[attribute];
    const raceMinimum = state.urace?.attrmin?.[attribute] ?? 3;
    const raceMaximum = state.urace?.attrmax?.[attribute] ?? 18;

    current[attribute] += amount;
    if (amount > 0 && current[attribute] > maximum[attribute]) {
        maximum[attribute] = current[attribute];
        if (maximum[attribute] > raceMaximum) {
            current[attribute] = raceMaximum;
            maximum[attribute] = raceMaximum;
        }
    } else if (amount < 0 && current[attribute] < raceMinimum) {
        const excess = raceMinimum - current[attribute];
        current[attribute] = raceMinimum;
        maximum[attribute] = Math.max(
            raceMinimum, maximum[attribute] - rn2(excess + 1),
        );
    }

    const newValue = currentAttribute(attribute, state);
    const changed = newValue !== oldValue;
    if (changed) {
        if (!Array.isArray(hero._exercise)) hero._exercise = Array(6).fill(0);
        hero._exercise[attribute] = 0;
    }
    return {
        changed,
        amount,
        oldValue,
        newValue,
        baseChanged: current[attribute] !== oldBase,
        maximumChanged: maximum[attribute] !== oldMaximum,
    };
}

export function attributeChangeMessage(attribute, result) {
    if (!result || result.fixed) return null;
    if (result.blockedByDunceCap)
        return 'Your cap constricts briefly, then relaxes again.';
    const word = result.amount > 0
        ? ATTRIBUTE_GAIN_WORD[attribute] : ATTRIBUTE_LOSS_WORD[attribute];
    if (!result.changed) {
        if (result.baseChanged || result.maximumChanged) {
            const direction = result.amount > 0 ? 'improved' : 'declined';
            return `Your innate ${ATTRIBUTE_NAME[attribute]} has ${direction}.`;
        }
        return `You're already as ${word} as you can get.`;
    }
    const emphasis = Math.abs(result.amount) > 1 ? 'very ' : '';
    return `You feel ${emphasis}${word}!`;
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
