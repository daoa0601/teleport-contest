// potion_hit.js — Shared potion impact, direct effect, and vapor ownership.
// C refs: potion.c bottlename(), potionhit(), potionbreathe().

import { currentAttribute, exerciseAttribute } from './attrib.js';
import { Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    OBJECT_DESCRIPTIONS, OBJECT_NAMES, POT_EXTRA_HEALING, POT_FRUIT_JUICE,
    POT_FULL_HEALING, POT_GAIN_ABILITY, POT_GAIN_ENERGY, POT_GAIN_LEVEL,
    POT_HEALING, POT_LEVITATION, POT_MONSTER_DETECTION,
    POT_OBJECT_DETECTION, POT_RESTORE_ABILITY, POT_SICKNESS, TOWEL,
} from './object_data.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_RESISTS,
    monsterTypeName,
} from './monster_data.js';
import { rn2 } from './rng.js';
import { syncBlindness, syncDeafness } from './senses.js';
import { objectTypeKnown } from './shk.js';
import { cansee } from './vision.js';

const PM_PESTILENCE = 312;
const M1_BREATHLESS = 0x00000400;
const M1_NOEYES = 0x00001000;
const M1_NOHEAD = 0x00008000;
const M2_PNAME = 0x00080000;
const MR_POISON = 0x20;
const AD_DISE = 33;
const AD_PEST = 38;

export const INERT_MONSTER_POTION_TYPES = new Set([
    POT_GAIN_LEVEL,
    POT_GAIN_ENERGY,
    POT_LEVITATION,
    POT_FRUIT_JUICE,
    POT_MONSTER_DETECTION,
    POT_OBJECT_DETECTION,
]);

export const HEALING_MONSTER_POTION_TYPES = new Set([
    POT_GAIN_ABILITY,
    POT_RESTORE_ABILITY,
    POT_HEALING,
    POT_EXTRA_HEALING,
    POT_FULL_HEALING,
]);

export const SUPPORTED_MONSTER_POTION_TYPES = new Set([
    ...INERT_MONSTER_POTION_TYPES,
    ...HEALING_MONSTER_POTION_TYPES,
    POT_SICKNESS,
]);

const ABILITY_POTION_TYPES = new Set([
    POT_GAIN_ABILITY, POT_RESTORE_ABILITY,
]);
const HEALING_POTION_TYPES = new Set([
    POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING,
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
    if (monster?.name) return monster.name;
    const typeName = monsterTypeName(monster?.mnum, !!monster?.female);
    return ((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_PNAME)
        ? typeName : `the ${typeName}`;
}

function sentenceSubject(monster) {
    const subject = monsterImpactName(monster);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}`;
}

function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

export function destroyPotionIdentity(potion) {
    potion.where = 'gone';
    potion.ox = potion.oy = 0;
    potion.ocarry = null;
    potion.timed = 0;
    potion.objectTimers = [];
    delete potion.carrierMid;
}

function healingCuresBlindness(potion) {
    if (potion.otyp === POT_FULL_HEALING) return true;
    if (potion.otyp === POT_EXTRA_HEALING) return !potion.cursed;
    return potion.otyp === POT_HEALING && !!potion.blessed;
}

function healHeroOnePoint(state) {
    const hero = state.u || (state.u = {});
    if (Upolyd(hero) && (hero.mh ?? 0) < (hero.mhmax ?? 0)) hero.mh++;
    if ((hero.uhp ?? 0) < (hero.uhpmax ?? 0)) hero.uhp++;
}

function restoreBaseAttributes(state, potion) {
    const base = state.u?.acurr?.a;
    const maximum = state.u?.amax?.a;
    const start = rn2(6);
    if (!Array.isArray(base) || !Array.isArray(maximum)) return start;
    for (let offset = 0; offset < 6; offset++) {
        const index = (start + offset) % 6;
        if ((base[index] ?? 0) < (maximum[index] ?? 0)) {
            base[index]++;
            if (!potion.blessed) break;
        }
    }
    return start;
}

function heroVaporProfile(state) {
    const mnum = Number.isInteger(state.u?.umonnum)
        ? state.u.umonnum
        : Number.isInteger(state.u?.umonster) ? state.u.umonster : null;
    const flags = Number.isInteger(mnum) ? MONSTER_FLAGS1[mnum] ?? 0 : 0;
    const breathless = !!(flags & M1_BREATHLESS);
    const hasEyes = !(flags & M1_NOEYES);
    return { breathless, hasEyes, canReceive: !breathless || hasEyes };
}

function heroHasVaporShield(state) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return eyewear?.otyp === TOWEL && (eyewear.spe ?? 0) > 0;
}

function sicknessCannotHarmMonster(monster) {
    const resistanceBits = (MONSTER_RESISTS[monster?.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
    return !!(resistanceBits & MR_POISON)
        || !!monster?.poisonResistance
        || MONSTER_ATTACKS[monster?.mnum]?.some(attack =>
            attack[1] === AD_DISE || attack[1] === AD_PEST);
}

// potionbreathe() is shared by monster contact and nearby floor breakage.
// Naming is bounded by callers: dknown-but-unknown identities never enter
// this owner because trycall() would start an interactive continuation.
export async function applySupportedPotionVapor({
    state = game,
    potion,
    publish = plineWithContinuation,
}) {
    if (!SUPPORTED_MONSTER_POTION_TYPES.has(potion?.otyp)) return null;

    const profile = heroVaporProfile(state);
    if (!profile.canReceive) return { received: false };
    if (heroHasVaporShield(state)) {
        await publish('Some vapor passes harmlessly around you.');
        return { received: true, shielded: true };
    }

    let abilityStart = null;
    if (ABILITY_POTION_TYPES.has(potion.otyp)) {
        if (potion.cursed) {
            await publish(profile.breathless
                ? 'Your eyes sting!'
                : 'Ulch!  That potion smells terrible!');
        } else {
            abilityStart = restoreBaseAttributes(state, potion);
        }
    } else if (HEALING_POTION_TYPES.has(potion.otyp)) {
        const points = potion.otyp === POT_FULL_HEALING ? 3
            : potion.otyp === POT_EXTRA_HEALING ? 2 : 1;
        for (let point = 0; point < points; point++) healHeroOnePoint(state);
        if (healingCuresBlindness(potion)) {
            state.u.blindTurns = 0;
            state.u.deafTurns = 0;
            syncBlindness(state);
            syncDeafness(state);
        }
        exerciseAttribute(2, true, state);
    } else if (potion.otyp === POT_SICKNESS
        && state.urole?.key !== 'healer') {
        const hero = state.u || (state.u = {});
        if (Upolyd(hero)) hero.mh = (hero.mh ?? 0) <= 5 ? 1 : hero.mh - 5;
        else hero.uhp = (hero.uhp ?? 0) <= 5 ? 1 : hero.uhp - 5;
        exerciseAttribute(2, false, state);
    }
    return { received: true, abilityStart };
}

async function applySupportedDirectEffect({
    monster, potion, targetVisible, wakeMonster, publish,
}) {
    if (potion.otyp === POT_SICKNESS && monster.mnum !== PM_PESTILENCE) {
        const oldHp = monster.mhp;
        if (sicknessCannotHarmMonster(monster)) {
            if (targetVisible)
                await publish(`${sentenceSubject(monster)} looks unharmed.`);
        } else if (monster.mhp > 2) {
            monster.mhp = Math.trunc(monster.mhp / 2);
            if (targetVisible)
                await publish(`${sentenceSubject(monster)} looks rather ill.`);
        }
        await wakeMonster?.(monster);
        return {
            angered: true,
            healed: monster.mhp - oldHp,
            curedBlindness: false,
        };
    }

    const healsMonster = HEALING_MONSTER_POTION_TYPES.has(potion.otyp)
        || (potion.otyp === POT_SICKNESS
            && monster.mnum === PM_PESTILENCE);
    if (!healsMonster) {
        await wakeMonster?.(monster);
        return { angered: true, healed: 0, curedBlindness: false };
    }

    // Healing potions invert against Pestilence; gain/restore ability do not.
    if (monster.mnum === PM_PESTILENCE
        && HEALING_POTION_TYPES.has(potion.otyp)) {
        const oldHp = monster.mhp;
        if (monster.mhp > 2) {
            monster.mhp = Math.trunc(monster.mhp / 2);
            if (targetVisible)
                await publish(`${sentenceSubject(monster)} looks rather ill.`);
        }
        await wakeMonster?.(monster);
        return {
            angered: true,
            healed: monster.mhp - oldHp,
            curedBlindness: false,
        };
    }

    const oldHp = monster.mhp;
    if (monster.mhp < monster.mhpmax) {
        monster.mhp = monster.mhpmax;
        if (targetVisible)
            await publish(`${sentenceSubject(monster)} looks sound and hale again.`);
    }

    let curedBlindness = false;
    if (healingCuresBlindness(potion) && !monster.mcansee) {
        monster.mcansee = 1;
        monster.mblinded = 0;
        curedBlindness = true;
        if (targetVisible
            && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)) {
            await publish(`${sentenceSubject(monster)} can see again.`);
        }
    }
    monster.msleeping = 0;
    return {
        angered: false,
        healed: monster.mhp - oldHp,
        curedBlindness,
    };
}

export async function hitMonsterWithSupportedPotion({
    state = game,
    monster,
    potion,
    wakeMonster,
    publish = plineWithContinuation,
    targetVisible = cansee(monster?.mx, monster?.my),
    resolveVapor = false,
    distance = 0,
}) {
    if (!monster || !potion
        || !SUPPORTED_MONSTER_POTION_TYPES.has(potion.otyp)) return null;

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

    const directEffect = await applySupportedDirectEffect({
        monster, potion, targetVisible, wakeMonster, publish,
    });
    let breathedVapor = false;
    let vaporEffect = null;
    if (resolveVapor) {
        breathedVapor = distance === 0;
        if (!breathedVapor && distance > 0 && distance < 3) {
            breathedVapor = rn2(
                Math.trunc((1 + currentAttribute(1, state)) / 2),
            ) === 0;
        }
        if (breathedVapor) {
            vaporEffect = await applySupportedPotionVapor({
                state, potion, publish,
            });
            breathedVapor = vaporEffect?.received !== false;
        }
    }
    destroyPotionIdentity(potion);
    return {
        bottleName,
        crashMessage,
        evaporationMessage,
        impactDamage,
        directEffect,
        breathedVapor,
        vaporEffect,
    };
}

// Retain the narrow API for direct inert witnesses while all production
// callers use the complete supported-family owner.
export async function hitMonsterWithInertPotion(options) {
    if (!INERT_MONSTER_POTION_TYPES.has(options?.potion?.otyp)) return null;
    return hitMonsterWithSupportedPotion(options);
}
