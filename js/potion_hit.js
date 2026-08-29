// potion_hit.js — Shared potion impact naming and the inert monster branch.
// C refs: potion.c bottlename(), potionhit(), potionbreathe().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    OBJECT_DESCRIPTIONS, OBJECT_NAMES, POT_FRUIT_JUICE, POT_GAIN_ENERGY,
    POT_GAIN_LEVEL, POT_LEVITATION, POT_MONSTER_DETECTION,
    POT_OBJECT_DETECTION,
} from './object_data.js';
import {
    MONSTER_FLAGS1, monsterTypeName,
} from './monster_data.js';
import { rn2 } from './rng.js';
import { objectTypeKnown } from './shk.js';
import { cansee } from './vision.js';

const M1_NOHEAD = 0x00008000;

export const INERT_MONSTER_POTION_TYPES = new Set([
    POT_GAIN_LEVEL,
    POT_GAIN_ENERGY,
    POT_LEVITATION,
    POT_FRUIT_JUICE,
    POT_MONSTER_DETECTION,
    POT_OBJECT_DETECTION,
]);

const ORDINARY_BOTTLE_NAMES = [
    'bottle', 'phial', 'flagon', 'carafe', 'flask', 'jar', 'vial',
];

const HALLUCINATED_BOTTLE_NAMES = [
    'jug', 'pitcher', 'barrel', 'tin', 'bag', 'box', 'glass', 'beaker',
    'tumbler', 'vase', 'flowerpot', 'pan', 'thingy', 'mug', 'teacup',
    'teapot', 'keg', 'bucket', 'thermos', 'amphora', 'wineskin', 'parcel',
    'bowl', 'ampoule',
];

function heroHallucinates(state) {
    return !!(state?.u?.hallucinating
        || (state?.u?.hallucinationTurns ?? 0) > 0);
}

// potion.c:bottlename() is shared by hero- and monster-thrown impacts.  The
// selector callback lets source-turn planners retain their own RNG ledger.
export function randomBottleName(
    state = game, select = range => rn2(range),
) {
    const names = heroHallucinates(state)
        ? HALLUCINATED_BOTTLE_NAMES : ORDINARY_BOTTLE_NAMES;
    return names[select(names.length)];
}

export function potionImpactObjectName(potion, state = game) {
    const trueName = OBJECT_NAMES[potion?.otyp] || potion?.name || 'potion';
    const appearance = state?.objectDescriptions?.[potion?.otyp]
        ?? OBJECT_DESCRIPTIONS[potion?.otyp];
    let noun;
    if (objectTypeKnown(potion, state)) noun = `potion of ${trueName}`;
    else if (potion?.dknown === false) noun = 'potion';
    else noun = `${appearance || 'unknown'} potion`;
    const individualName = potion?.oextra?.oname || potion?.oname;
    return individualName ? `${noun} named ${individualName}` : noun;
}

function monsterImpactName(monster) {
    return monster?.name
        || `the ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function destroyPotionIdentity(potion) {
    potion.where = 'gone';
    potion.ox = potion.oy = 0;
    potion.ocarry = null;
    potion.timed = 0;
    potion.objectTimers = [];
    delete potion.carrierMid;
}

// The six types in INERT_MONSTER_POTION_TYPES deliberately have no entry in
// either potionhit(monster)'s effect switch or potionbreathe()'s vapor switch.
// Their complete source transaction still owns bottle presentation, optional
// one-HP impact attrition, wake/anger, discovery policy, and object deletion.
export async function hitMonsterWithInertPotion({
    state = game,
    monster,
    potion,
    wakeMonster,
    publish = plineWithContinuation,
    targetVisible = cansee(monster?.mx, monster?.my),
}) {
    if (!monster || !potion
        || !INERT_MONSTER_POTION_TYPES.has(potion.otyp)) return null;

    const bottleName = randomBottleName(state);
    const monsterName = monsterImpactName(monster);
    const hasHead = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOHEAD);
    const impactTarget = hasHead
        ? `${possessive(monsterName)} head` : monsterName;
    const crashMessage = targetVisible
        ? `The ${bottleName} crashes on ${impactTarget} and breaks into shards.`
        : 'Crash!';
    await publish(crashMessage);

    const impactRoll = rn2(5);
    const impactDamage = impactRoll !== 0 && monster.mhp > 1 ? 1 : 0;
    if (impactDamage) monster.mhp--;

    let evaporationMessage = null;
    if (targetVisible) {
        evaporationMessage = `The ${potionImpactObjectName(
            potion, state,
        )} evaporates.`;
        await publish(evaporationMessage);
    }

    // For this source family the direct and vapor effect switches are both
    // empty.  dknown+unknown identities are rejected by the caller because
    // trycall() owns an interactive naming continuation not represented here.
    await wakeMonster?.(monster);
    destroyPotionIdentity(potion);
    return {
        bottleName,
        crashMessage,
        evaporationMessage,
        impactDamage,
    };
}
