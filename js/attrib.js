// attrib.js — Effective hero attributes and exercise state.
// C refs: attrib.c acurr(), acurrstr(), and exercise().
import { formatFeltMessage } from './hero_speech.js';
import { game, requirePlayingGame } from './gstate.js';
import { artifactById } from './artifacts.js';
import { plineWithContinuation } from './display.js';
import { loseHeroHp } from './hero_damage.js';
import { encumbranceLabel, encumbranceMessage, nearCapacity } from './weight.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { rn2, rnd } from './rng.js';
import { propertyIsActive } from './properties.js';
import { formMaximumStrength } from './polyself.js';
import { DUNCE_CAP, GAUNTLETS_OF_POWER } from './object_data.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_MAX, A_STR, A_WIS, Upolyd, } from './const.js';
const ATTRIBUTE_INDICES = [0, 1, 2, 3, 4, 5];
const STR25 = 125;
const MAX_EXERCISE = 50;
const PM_AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');
const S_NYMPH = 14;
const ATTRIBUTE_GAIN_WORD = [
    'strong', 'smart', 'wise', 'agile', 'tough', 'charismatic',
];
const ATTRIBUTE_LOSS_WORD = [
    'weak', 'stupid', 'foolish', 'clumsy', 'fragile', 'repulsive',
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
    requireAttributeIndex(attribute);
    const hero = state.u;
    let value = (hero.acurr?.a?.[attribute] ?? 10)
        + (hero.abon?.a?.[attribute] ?? 0) + (hero.atemp?.a?.[attribute] ?? 0);
    if (attribute === A_CHA && (hero.umonnum !== undefined && MONSTER_SYMBOL[hero.umonnum] === S_NYMPH
        || hero.umonnum === PM_AMOROUS_DEMON))
        value = Math.max(18, value);
    const [minimum, maximum] = attributeLimits(attribute, state);
    return Math.max(minimum, Math.min(maximum, value));
}
// C attrib.c:acurrstr(). Convert exceptional Strength to the 3..25 scale.
export function currentStrength(state = game) {
    const strength = currentAttribute(A_STR, state);
    if (strength <= 18)
        return Math.max(strength, 3);
    if (strength <= 121)
        return 19 + Math.trunc(strength / 50);
    return Math.min(strength, 125) - 100;
}
function attributeLimits(attribute, state) {
    if (attribute === A_STR)
        return [wornObject(state, 'uarmg')?.otyp === GAUNTLETS_OF_POWER ? STR25 : 3, STR25];
    if (attribute === A_CON
        && artifactById(wornObject(state, 'uwep')?.oartifact)?.name === 'Ogresmasher')
        return [25, 25];
    if ((attribute === A_INT || attribute === A_WIS)
        && wornObject(state, 'uarmh')?.otyp === DUNCE_CAP)
        return [6, 6];
    return [3, 25];
}
export function attributeIsAtLimit(attribute, state = game) {
    requireAttributeIndex(attribute);
    const value = currentAttribute(attribute, state);
    return attributeLimits(attribute, state).includes(value);
}
export function adjustAttribute(attribute, amount, state = game) {
    requireAttributeIndex(attribute);
    const hero = state.u;
    if (!amount || hero.fixedAbilities
        || propertyIsActive('sustainAbility', state)) {
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
    const raceMaximum = maximumAttribute(attribute, state);
    current[attribute] += amount;
    if (amount > 0 && current[attribute] > maximum[attribute]) {
        maximum[attribute] = current[attribute];
        if (maximum[attribute] > raceMaximum) {
            current[attribute] = raceMaximum;
            maximum[attribute] = raceMaximum;
        }
    }
    else if (amount < 0 && current[attribute] < raceMinimum) {
        const excess = raceMinimum - current[attribute];
        current[attribute] = raceMinimum;
        maximum[attribute] = Math.max(raceMinimum, maximum[attribute] - rn2(excess + 1));
    }
    const newValue = currentAttribute(attribute, state);
    const changed = newValue !== oldValue;
    if (changed) {
        state.context.botl = true;
        if (!Array.isArray(hero._exercise))
            hero._exercise = [0, 0, 0, 0, 0, 0];
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
// C attrib.h:ATTRMAX(). Only polymorphed Strength uses the creature's
// limit; every other attribute keeps the hero's racial limit.
export function maximumAttribute(attribute, state = game) {
    if (attribute === A_STR && Upolyd(state.u)) {
        const species = state.u.umonnum;
        if (species === undefined)
            throw new Error('Polymorphed Strength requires a creature form');
        return formMaximumStrength(species);
    }
    return state.urace?.attrmax[attribute] ?? 18;
}
// C attrib.c:gainstr(). Random gains use base strength even when equipment
// fixes the effective value; adjattrib's conditional message then stays quiet.
export async function gainHeroStrength(object = null, amount = 0, { state = game, giveMessage = true, } = {}) {
    if (!amount) {
        if (!state.u.acurr)
            throw new Error('Strength gain requires initialized hero attributes');
        const strength = state.u.acurr.a[A_STR];
        if (strength < 18)
            amount = rn2(4) ? 1 : rnd(6);
        else if (strength < 103)
            amount = rnd(10); // STR18(85)
        else
            amount = 1;
    }
    const change = adjustAttribute(A_STR, object?.cursed ? -amount : amount, state);
    if (change.changed) {
        if (giveMessage) {
            const message = attributeChangeMessage(A_STR, change, state);
            if (message)
                await plineWithContinuation(message);
        }
        if (state._moveloopStarted)
            await reportHeroEncumbrance(state);
    }
    return change;
}
// C attrib.c:losestr(). Frailty damage can suspend or end the game before
// maximum HP and the remaining base-strength loss are committed.
export async function loseHeroStrength(amount, killer, { state = game, random = rn2, publish = plineWithContinuation, die, deathCause = null, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const minimumStrength = state.urace.attrmin[A_STR];
    const minimumHp = Math.max(hero.ulevel, 1);
    const wasPolymorphed = Upolyd(hero);
    let remainingLoss = amount;
    let reducedStrength = hero.acurr.a[A_STR] - amount;
    let damage = 0;
    while (reducedStrength < minimumStrength) {
        reducedStrength++;
        remainingLoss--;
        damage += 3 + random(4);
    }
    if (damage) {
        if (!killer) {
            killer = 'terminal frailty';
            deathCause = 'killed by terminal frailty';
        }
        if (await loseHeroHp(damage, killer, { state, publish, ...(die ? { die } : {}), deathCause }))
            return true;
        if (Upolyd(hero)) {
            hero.mhmax = Math.max(hero.mhmax - damage, 1);
            hero.mh = Math.min(hero.mh, hero.mhmax);
        }
        else if (!wasPolymorphed && hero.uhpmax > minimumHp) {
            hero.uhpmax = Math.max(hero.uhpmax - damage, minimumHp);
            hero.uhp = Math.min(hero.uhp, hero.uhpmax);
        }
        state.context.botl = true;
    }
    if (remainingLoss > 0 && (Upolyd(hero) || !wasPolymorphed)) {
        const previousCapacity = state._encumbranceLevel ?? nearCapacity(state);
        const change = adjustAttribute(A_STR, -remainingLoss, state);
        if (change.changed && state._moveloopStarted) {
            const capacity = nearCapacity(state);
            state._encumbranceLevel = capacity;
            hero._encumbrance = encumbranceLabel(capacity);
            const message = encumbranceMessage(previousCapacity, capacity);
            if (message)
                await publish(message);
        }
    }
    return false;
}
export function attributeChangeMessage(attribute, result, state = game) {
    requireAttributeIndex(attribute);
    if (!result || result.fixed)
        return null;
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
    return formatFeltMessage(`${emphasis}${word}!`, state);
}
export async function exerciseAttribute(attribute, improving, state = game) {
    if (!accumulateAttributeExercise(attribute, improving, state))
        return;
    if (state.moves > 0 && (attribute === A_STR || attribute === A_CON))
        await reportHeroEncumbrance(state);
}
// Wisdom exercise never calls encumber_msg(). Knowledge and identification
// can therefore use the same accumulation rule without an input boundary.
export function exerciseWisdom(improving = true, state = game) {
    accumulateAttributeExercise(A_WIS, improving, state);
}
function accumulateAttributeExercise(attribute, improving, state) {
    requireAttributeIndex(attribute);
    const hero = state.u;
    if (attribute === A_INT || attribute === A_CHA)
        return false;
    if (Upolyd(hero) && attribute !== A_WIS)
        return false;
    if (!Array.isArray(hero._exercise))
        hero._exercise = [0, 0, 0, 0, 0, 0];
    if (Math.abs(hero._exercise[attribute] ?? 0) < MAX_EXERCISE) {
        const current = currentAttribute(attribute, state);
        const amount = improving ? (rn2(19) > current ? 1 : 0) : -rn2(2);
        hero._exercise[attribute] += amount;
    }
    return true;
}
// C pickup.c:encumber_msg() commits oldcap after its message returns. A
// pager therefore retains the prior load status until the hero dismisses it.
export async function reportHeroEncumbrance(state = game) {
    const previous = state._encumbranceLevel ?? 0;
    const capacity = nearCapacity(state);
    const message = encumbranceMessage(previous, capacity);
    if (message)
        await plineWithContinuation(message);
    if (previous !== capacity)
        state.context.botl = true;
    state._encumbranceLevel = capacity;
    state.u._encumbrance = encumbranceLabel(capacity);
    state._capacityDirty = false;
}
// C attrib.c:exerchk(). Periodic accumulation runs at the caller's earlier
// boundary; this owner settles it once the hero's multi-action has ended.
export async function checkAttributeExercise(sourceTurn, state = game) {
    requirePlayingGame(state);
    if (!Number.isInteger(state._nextAttribCheck))
        state._nextAttribCheck = 600;
    const checkTurn = state._nextAttribCheck;
    if (checkTurn === undefined)
        throw new Error('Attribute exercise check has no scheduled turn');
    if (sourceTurn < checkTurn || exerciseCheckIsDeferred(state))
        return;
    const hero = state.u;
    const exercise = hero._exercise || [];
    for (const attribute of ATTRIBUTE_INDICES) {
        let accumulated = exercise[attribute] ?? 0;
        if (!accumulated)
            continue;
        const direction = Math.sign(accumulated);
        const minimum = state.urace?.attrmin?.[attribute] ?? 3;
        const maximum = Math.min(18, maximumAttribute(attribute, state));
        const base = hero.acurr.a[attribute];
        const withinLimit = direction > 0 ? base < maximum : base > minimum;
        const canExercise = attribute === A_WIS || !Upolyd(hero);
        if (withinLimit && canExercise) {
            const threshold = attribute === A_WIS ? Math.abs(accumulated)
                : Math.trunc(Math.abs(accumulated) * 2 / 3);
            if (rn2(MAX_EXERCISE) <= threshold) {
                const change = adjustAttribute(attribute, direction, state);
                if (change.changed) {
                    accumulated = 0;
                    const message = attributeChangeMessage(attribute, change, state);
                    if (message)
                        await plineWithContinuation(message);
                    if (state._moveloopStarted && (attribute === A_STR || attribute === A_CON))
                        await reportHeroEncumbrance(state);
                    const explanations = EXERCISE_EXPLANATIONS[attribute];
                    if (!explanations)
                        throw new Error(`Attribute ${attribute} cannot accumulate exercise`);
                    const explanation = explanations[direction > 0 ? 0 : 1];
                    await plineWithContinuation(`You ${direction > 0 ? 'must have been' : "haven't been"} ${explanation}.`);
                }
            }
        }
        exercise[attribute] = Math.trunc(Math.abs(accumulated) / 2) * direction;
    }
    state._nextAttribCheck = checkTurn + 800 + rn2(200);
}
function exerciseCheckIsDeferred(state) {
    if ((state.multi ?? 0) !== 0 || state._runState || state._delayedAction
        || (state._helplessTurns ?? 0) > 0)
        return true;
    // Study uses positive multi; eating and lock picking use occupation with
    // multi zero and therefore still allow C's exercise check.
    return state._occupation?.key === 'study-book';
}
const EXERCISE_EXPLANATIONS = {
    [A_STR]: ['exercising diligently', 'exercising properly'],
    [A_WIS]: ['very observant', 'paying attention'],
    [A_DEX]: ['working on your reflexes', 'working on reflexes lately'],
    [A_CON]: ['leading a healthy life-style', 'watching your health'],
};
// C potion.c:peffect_restore_ability(). This restores the base directly,
// bypassing fixed abilities while preserving temporary penalties and exercise.
export function restoreHeroBaseAttributes({ all = false, state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const start = rn2(A_MAX);
    for (let offset = 0; offset < A_MAX; offset++) {
        const attribute = (start + offset) % A_MAX;
        requireAttributeIndex(attribute);
        if (hero.acurr.a[attribute] >= hero.amax.a[attribute])
            continue;
        hero.acurr.a[attribute] = hero.amax.a[attribute];
        state.context.botl = true;
        if (hero._exercise && hero._exercise[attribute] < 0)
            hero._exercise[attribute] = 0;
        if (!all)
            break;
    }
}
function requireAttributeIndex(attribute) {
    if (!Number.isInteger(attribute) || attribute < A_STR || attribute > A_CHA)
        throw new RangeError(`Unknown hero attribute ${attribute}`);
}
//# sourceMappingURL=attrib.js.map