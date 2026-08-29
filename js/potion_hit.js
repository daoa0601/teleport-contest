// potion_hit.js — Shared potion impact, direct effect, and vapor ownership.
// C refs: potion.c bottlename(), potionhit(), potionbreathe().

import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { M_SEEN_SLEEP, STRAT_WAITFORU, TIMEOUT, Upolyd } from './const.js';
import {
    canSeeMonster, canSpotMonster, map_invisible, newsym,
    plineWithContinuation, shieldeff,
} from './display.js';
import { game } from './gstate.js';
import { splitHostileMonster } from './mklev.js';
import {
    OBJECT_DESCRIPTIONS, OBJECT_NAMES, POT_BLINDNESS, POT_BOOZE, POT_CONFUSION,
    POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_FULL_HEALING, POT_GAIN_ABILITY,
    POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY,
    POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION,
    POT_RESTORE_ABILITY, POT_PARALYSIS, POT_SICKNESS, POT_SLEEPING, POT_SPEED,
    POT_WATER, SPEED_BOOTS, TOWEL,
} from './object_data.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL,
    MONSTER_MAGIC_RESISTANCE, MONSTER_MOVE, MONSTER_RESISTS, MONSTER_SOUND,
    monsterTypeName,
} from './monster_data.js';
import { d, rnd, rn2 } from './rng.js';
import {
    heroIsBlind, syncBlindness, syncDeafness,
} from './senses.js';
import { objectTypeKnown } from './shk.js';
import { cansee, couldsee, vision_recalc } from './vision.js';
import {
    heroHasProtectionFromShapeChangers, transformWereMonster,
} from './were.js';

const PM_PESTILENCE = 312;
const PM_ARCHEOLOGIST = 331;
const PM_WIZARD = 343;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
const PM_VLAD_THE_IMPALER = 228;
const M1_BREATHLESS = 0x00000400;
const M1_NOEYES = 0x00001000;
const M1_NOHEAD = 0x00008000;
const M2_PNAME = 0x00080000;
const M2_UNDEAD = 0x00000002;
const M2_WERE = 0x00000004;
const M2_HUMAN = 0x00000008;
const M2_DEMON = 0x00000100;
const M1_SEE_INVIS = 0x01000000;
const MR_SLEEP = 0x04;
const MR_POISON = 0x20;
const MSLOW = 1;
const MFAST = 2;
const AT_HUGS = 7;
const AT_ENGL = 11;
const AD_WRAP = 18;
const AD_STCK = 19;
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
    POT_CONFUSION,
    POT_BOOZE,
    POT_PARALYSIS,
    POT_SLEEPING,
    POT_SPEED,
    POT_BLINDNESS,
    POT_INVISIBILITY,
    POT_WATER,
]);

const ABILITY_POTION_TYPES = new Set([
    POT_GAIN_ABILITY, POT_RESTORE_ABILITY,
]);
const HEALING_POTION_TYPES = new Set([
    POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING,
]);
const CONFUSION_POTION_TYPES = new Set([POT_CONFUSION, POT_BOOZE]);
const HELPLESS_POTION_TYPES = new Set([POT_PARALYSIS, POT_SLEEPING]);

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

// zap.c:resist() uses potion attack level 6 and the target's runtime level.
// NOTELL suppresses shield presentation but the resistance draw still occurs.
function monsterResistsPotion(monster, state = game) {
    const mnum = monster?.mnum;
    let defenseLevel = monster?.m_lev
        ?? MONSTER_LEVEL[mnum] ?? 1;
    if (defenseLevel < 1)
        defenseLevel = mnum >= PM_ARCHEOLOGIST && mnum <= PM_WIZARD
            ? state.u?.ulevel ?? 1 : 1;
    defenseLevel = Math.max(1, Math.min(50, defenseLevel));
    const resistanceRange = 100 + 6 - defenseLevel;
    return rn2(resistanceRange)
        < (MONSTER_MAGIC_RESISTANCE[mnum] ?? 0);
}

function monsterHasSleepDefense(monster) {
    const resistanceBits = (MONSTER_RESISTS[monster?.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
    return !!(resistanceBits & MR_SLEEP)
        || !!monster?.sleepResistance
        || !!monster?.sleep_resistance
        || !!monster?.defendedSleep;
}

function heroFormSticks(state) {
    const mnum = Number.isInteger(state.u?.umonnum)
        ? state.u.umonnum
        : Number.isInteger(state.u?.umonster) ? state.u.umonster : null;
    if (!Number.isInteger(mnum)) return false;
    const attacks = MONSTER_ATTACKS[mnum] || [];
    const hasEngulf = attacks.some(attack => attack[0] === AT_ENGL);
    return attacks.some(attack => attack[1] === AD_STCK
        || (attack[1] === AD_WRAP && !hasEngulf)
        || attack[0] === AT_HUGS);
}

function defaultMonsterCanSeeHero(monster, state) {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0) return false;
    if (state.underwater || state.u?.uinwater) return false;
    const heroInvisible = !!(state.u?.invisible || state.u?.invis
        || (state.u?.invisibleTurns ?? 0) > 0);
    if (heroInvisible
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS)) {
        return false;
    }
    return couldsee(monster.mx, monster.my);
}

function teachVisibleMonstersSleepResistance(
    state, monsterCanSeeHero = monster => defaultMonsterCanSeeHero(monster, state),
) {
    if (state.u?.uswallow) return 0;
    let taught = 0;
    for (const monster of state.level?.monsters || []) {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
            || !monsterCanSeeHero(monster)) continue;
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            | M_SEEN_SLEEP;
        taught++;
    }
    return taught;
}

function installPotionHelplessness(state, duration, reason) {
    state._helplessTurns = duration;
    state._helplessReason = reason;
    state._helplessDoneMessage = 'You can move again.';
    exerciseAttribute(1, false, state);
}

function monsterWearsSpeedBoots(monster) {
    return (monster?.minvent || monster?.inventory || []).some(object =>
        object?.otyp === SPEED_BOOTS && (object.owornmask ?? 0) !== 0);
}

function monsterNaturalSpeed(monster) {
    return Number.isFinite(monster?.mmove)
        ? monster.mmove : MONSTER_MOVE[monster?.mnum] ?? 0;
}

function heroIsFast(state) {
    return !!(state.u?.fast || state.u?.veryFast
        || state.u?.veryFastFromArmor
        || (state.u?.veryFastTurns ?? 0) > 0);
}

function heroIsUnaware(state) {
    return !!(state.unaware || state.u?.unaware
        || state._helplessReason === 'unconscious from rotten food'
        || state._helplessReason === 'sleeping off a magical draught');
}

function heroIsInvisible(state) {
    const hero = state.u || {};
    const active = !!(hero.invisible || hero.invis
        || (hero.invisibleTurns ?? 0) > 0);
    const blocked = !!(hero.invisibilityBlocked || hero.invisBlocked
        || hero.invis_blkd);
    return active && !blocked;
}

function heroSeesInvisible(state) {
    const hero = state.u || {};
    return !!(hero.seeInvisible || hero.see_invisible
        || (hero.seeInvisibleTurns ?? 0) > 0);
}

function monsterIsVampireShifter(monster) {
    return [PM_VAMPIRE, PM_VAMPIRE_LEADER, PM_VLAD_THE_IMPALER]
        .includes(monster?.cham);
}

function monsterHatesBlessings(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return !!(flags & (M2_UNDEAD | M2_DEMON))
        || monsterIsVampireShifter(monster);
}

function monsterIsWere(monster) {
    return !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_WERE);
}

function monsterIsHuman(monster) {
    return !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_HUMAN);
}

function heroBlocksShapeChange(state) {
    return heroHasProtectionFromShapeChangers(state);
}

function monsterHasTransformEquipment(monster) {
    if ((monster?.misc_worn_check ?? 0) !== 0
        || monster?.weapon || monster?.wieldedWeapon) return true;
    return (monster?.minvent || monster?.inventory || []).some(object =>
        (object?.owornmask ?? 0) !== 0 || object?.worn || object?.wielded);
}

function waterWouldTransformWere(state, potion, monster) {
    if (potion?.otyp !== POT_WATER || !monsterIsWere(monster)) return false;
    if (potion.blessed) return !monsterIsHuman(monster);
    return !!potion.cursed && monsterIsHuman(monster)
        && !heroBlocksShapeChange(state);
}

// Includes the one-point bottle chip which precedes potionhit()'s water die.
// A bottle chip alone cannot kill because C only applies it above one HP, so
// non-damaging water identities return zero rather than one.
export function maximumSupportedPotionFatalDamage(potion, monster) {
    if (potion?.otyp !== POT_WATER) return 0;
    if (monsterHatesBlessings(monster) || monsterIsWere(monster)) {
        return potion.blessed ? 13 : 0;
    }
    if (monster?.mnum === PM_IRON_GOLEM) return 7;
    return 0;
}

// Production callers ask this before splitobj()/freeinv() or throw RNG.  The
// deterministic new_were() core is live, but mon_break_armor() and
// possibly_unwield() are not.
export function supportedPotionTargetGap({ state = game, potion, monster }) {
    if (waterWouldTransformWere(state, potion, monster)
        && monsterHasTransformEquipment(monster)) {
        return 'water-were-equipment';
    }
    return null;
}

function waterEffectSubject(monster, targetSpotted) {
    return targetSpotted ? sentenceSubject(monster) : 'It';
}

function wereTransformationNoun(monster) {
    if (!monsterIsHuman(monster)) return 'human';
    if (monster.mnum === 261) return 'rat';
    if (monster.mnum === 262) return 'jackal';
    return 'wolf';
}

// potionbreathe() is shared by monster contact and nearby floor breakage.
// Naming is bounded by callers: dknown-but-unknown identities never enter
// this owner because trycall() would start an interactive continuation.
export async function applySupportedPotionVapor({
    state = game,
    potion,
    publish = plineWithContinuation,
    monsterCanSeeHero,
    recalculateVision,
}) {
    if (!SUPPORTED_MONSTER_POTION_TYPES.has(potion?.otyp)) return null;

    const profile = heroVaporProfile(state);
    if (!profile.canReceive) return { received: false };
    if (heroHasVaporShield(state)) {
        await publish('Some vapor passes harmlessly around you.');
        return { received: true, shielded: true };
    }

    let abilityStart = null;
    let confusionDuration = null;
    let helplessDuration = null;
    let speedDuration = null;
    let blindnessDuration = null;
    let invisibilityGlimpse = null;
    let waterEffect = null;
    let sightToggled = false;
    let resisted = false;
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
    } else if (CONFUSION_POTION_TYPES.has(potion.otyp)) {
        const hero = state.u || (state.u = {});
        if ((hero.confusionTurns ?? 0) <= 0)
            await publish('You feel somewhat dizzy.');
        confusionDuration = rnd(5);
        hero.confusionTurns = Math.min(
            TIMEOUT,
            Math.max(0, hero.confusionTurns ?? 0) + confusionDuration,
        );
    } else if (HELPLESS_POTION_TYPES.has(potion.otyp)) {
        const freeAction = heroHasFreeAction(state);
        const sleepResistance = !!(state.u?.sleepResistance
            || state.u?.sleep_resistance);
        const protectedFromEffect = freeAction
            || (potion.otyp === POT_SLEEPING && sleepResistance);
        if (protectedFromEffect) {
            resisted = true;
            await publish(potion.otyp === POT_PARALYSIS
                ? 'You stiffen momentarily.' : 'You yawn.');
            if (potion.otyp === POT_SLEEPING) {
                teachVisibleMonstersSleepResistance(
                    state, monsterCanSeeHero,
                );
            }
        } else {
            await publish(potion.otyp === POT_PARALYSIS
                ? 'Something seems to be holding you.'
                : 'You feel rather tired.');
            helplessDuration = rnd(5);
            installPotionHelplessness(
                state,
                helplessDuration,
                potion.otyp === POT_PARALYSIS
                    ? 'frozen by a potion'
                    : 'sleeping off a magical draught',
            );
        }
    } else if (potion.otyp === POT_SPEED) {
        const hero = state.u || (state.u = {});
        if (!heroIsFast(state))
            await publish('Your knees seem more flexible now.');
        speedDuration = rnd(5);
        hero.veryFastTurns = Math.min(
            TIMEOUT,
            Math.max(0, hero.veryFastTurns ?? 0) + speedDuration,
        );
        hero.veryFast = true;
        exerciseAttribute(1, true, state);
    } else if (potion.otyp === POT_BLINDNESS) {
        const hero = state.u || (state.u = {});
        const wasBlind = heroIsBlind(state);
        const unaware = heroIsUnaware(state);
        if (!wasBlind && !unaware)
            await publish('It suddenly gets dark.');
        blindnessDuration = rnd(5);
        hero.blindTurns = Math.min(
            TIMEOUT,
            Math.max(0, hero.blindTurns ?? 0) + blindnessDuration,
        );
        const blindNow = syncBlindness(state);
        sightToggled = wasBlind !== blindNow;
        if (sightToggled) {
            state.vision_full_recalc = 1;
            if (recalculateVision) recalculateVision();
            else if (state === game && state.level?.at) vision_recalc(0);
        }
        if (!blindNow && !unaware)
            await publish('Your vision clears.');
    } else if (potion.otyp === POT_INVISIBILITY) {
        if (!heroIsBlind(state) && !heroIsInvisible(state)) {
            invisibilityGlimpse = heroSeesInvisible(state)
                ? 'transparent' : 'unseen';
            await publish(invisibilityGlimpse === 'transparent'
                ? 'For an instant you could see right through yourself!'
                : "For an instant you couldn't see yourself!");
        }
    } else if (potion.otyp === POT_WATER) {
        // potionbreathe() has no water case.  Admission and possible naming
        // still occur in the caller, but hero state and gameplay RNG do not.
        waterEffect = null;
    }
    return {
        received: true,
        abilityStart,
        confusionDuration,
        helplessDuration,
        speedDuration,
        blindnessDuration,
        invisibilityGlimpse,
        waterEffect,
        sightToggled,
        resisted,
    };
}

async function applySupportedDirectEffect({
    state, monster, potion, targetVisible, targetSpotted, wakeMonster,
    publish, showShield, spotMonster, repaintMonster, rememberInvisible,
    wakeNearby, splitMonster, transformWere, finishKill,
}) {
    if (potion.otyp === POT_WATER) {
        const affectedByHoliness = monsterHatesBlessings(monster)
            || monsterIsWere(monster);
        let angered = true;
        let waterDamage = 0;
        let waterHealing = 0;
        let transformedWere = false;
        let splitClone = null;
        let killed = false;

        if (affectedByHoliness) {
            if (potion.blessed) {
                const silent = (MONSTER_SOUND[monster.mnum] ?? 0) === 0;
                await publish(`${waterEffectSubject(monster, targetSpotted)} ${
                    silent ? 'writhes' : 'shrieks'
                } in pain!`);
                if (!silent) {
                    if (!wakeNearby)
                        throw new Error('water wake-radius owner unavailable');
                    await wakeNearby(
                        monster.mx,
                        monster.my,
                        (MONSTER_LEVEL[monster.mnum] ?? 0) * 10,
                    );
                }
                waterDamage = d(2, 6);
                monster.mhp -= waterDamage;
                killed = monster.mhp <= 0;
                if (killed) {
                    if (!finishKill)
                        throw new Error('water fatality owner unavailable');
                    await finishKill(monster);
                } else if (monsterIsWere(monster)
                    && !monsterIsHuman(monster)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroHallucinates(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${
                            wereTransformationNoun(monster)
                        }.`);
                    }
                    transformedWere = !!(await transformWere(monster, state));
                }
            } else if (potion.cursed) {
                angered = false;
                if (targetSpotted)
                    await publish(`${sentenceSubject(monster)} looks healthier.`);
                waterHealing = d(2, 6);
                monster.mhp = Math.min(
                    monster.mhpmax ?? monster.mhp,
                    monster.mhp + waterHealing,
                );
                if (monsterIsWere(monster) && monsterIsHuman(monster)
                    && !heroBlocksShapeChange(state)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroHallucinates(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${
                            wereTransformationNoun(monster)
                        }.`);
                    }
                    transformedWere = !!(await transformWere(monster, state));
                }
            }
        } else if (monster.mnum === PM_GREMLIN) {
            angered = false;
            if (!splitMonster)
                throw new Error('water gremlin-split owner unavailable');
            splitClone = await splitMonster(monster, state);
            if (splitClone && targetSpotted)
                await publish(`${sentenceSubject(monster)} multiplies!`);
        } else if (monster.mnum === PM_IRON_GOLEM) {
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} rusts.`);
            waterDamage = d(1, 6);
            monster.mhp -= waterDamage;
            killed = monster.mhp <= 0;
            if (killed) {
                if (!finishKill)
                    throw new Error('water fatality owner unavailable');
                await finishKill(monster);
            }
        }

        if (!killed) {
            if (angered) await wakeMonster?.(monster);
            else monster.msleeping = 0;
        }
        return {
            angered,
            healed: waterHealing,
            curedBlindness: false,
            waterDamage,
            waterHealing,
            transformedWere,
            splitClone,
            killed,
        };
    }

    if (potion.otyp === POT_INVISIBILITY) {
        const sawIt = !!spotMonster(monster);
        const cursedPotion = !!potion.cursed;
        const angered = !!monster.minvis && cursedPotion;

        monster.perminvis = cursedPotion ? 0 : 1;
        if (!monster.invis_blkd) {
            monster.minvis = monster.perminvis;
            await repaintMonster(monster);
        }

        const spottedAfter = !!spotMonster(monster);
        let invisibilityMessage = null;
        let rememberedInvisible = false;
        if (sawIt && !spottedAfter) {
            if (targetVisible) {
                await rememberInvisible(monster);
                rememberedInvisible = true;
            }
        } else if (sawIt && cursedPotion) {
            invisibilityMessage = `${sentenceSubject(monster)} briefly seems `
                + 'to be transparent.';
            await publish(invisibilityMessage);
        } else if (!sawIt && spottedAfter) {
            invisibilityMessage = `${sentenceSubject(monster)} appears!`;
            await publish(invisibilityMessage);
        }

        if (angered) await wakeMonster?.(monster);
        else monster.msleeping = 0;
        return {
            angered,
            healed: 0,
            curedBlindness: false,
            sawIt,
            spottedAfter,
            rememberedInvisible,
            invisibilityMessage,
        };
    }

    if (potion.otyp === POT_PARALYSIS) {
        let paralyzed = false;
        let duration = 0;
        if (monster.mcanmove !== 0) {
            duration = rnd(25);
            monster.mcanmove = 0;
            monster.mfrozen = Math.min(duration, 127);
            monster.meating = 0;
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
            paralyzed = true;
        }
        await wakeMonster?.(monster);
        return {
            angered: true,
            healed: 0,
            curedBlindness: false,
            paralyzed,
            duration,
        };
    }

    if (potion.otyp === POT_SLEEPING) {
        const duration = rnd(12);
        const inherentOrDefended = monsterHasSleepDefense(monster);
        const resisted = inherentOrDefended
            || monsterResistsPotion(monster, state);
        let slept = false;
        if (resisted) {
            await showShield?.(monster);
        } else if (monster.mcanmove !== 0) {
            monster.mcanmove = 0;
            monster.mfrozen = Math.min(
                duration + (monster.mfrozen ?? 0), 127,
            );
            monster.meating = 0;
            slept = true;
            await publish(targetVisible
                ? `${sentenceSubject(monster)} falls asleep.`
                : 'It falls asleep.');
            if (monster === state.u?.ustuck && !state.u?.uswallow
                && !heroFormSticks(state)) {
                await publish(`${possessive(sentenceSubject(monster))} grip relaxes.`);
                state.u.ustuck = null;
            }
        }
        await wakeMonster?.(monster);
        return {
            angered: true,
            healed: 0,
            curedBlindness: false,
            resisted,
            slept,
            duration,
        };
    }

    if (potion.otyp === POT_SPEED) {
        const oldSpeed = monster.mspeed ?? 0;
        monster.permspeed = monster.permspeed === MSLOW ? 0 : MFAST;
        monster.mspeed = monsterWearsSpeedBoots(monster)
            ? MFAST : monster.permspeed;
        const speedChanged = monster.mspeed !== oldSpeed;
        let speedMessage = null;
        if (targetSpotted && speedChanged && monsterNaturalSpeed(monster) !== 0
            && !(monster.mfrozen ?? 0) && !monster.msleeping) {
            const much = monster.mspeed + oldSpeed === MFAST + MSLOW
                ? 'much ' : '';
            speedMessage = `${sentenceSubject(monster)} is suddenly moving `
                + `${much}faster.`;
            await publish(speedMessage);
        }
        monster.msleeping = 0;
        return {
            angered: false,
            healed: 0,
            curedBlindness: false,
            oldSpeed,
            speed: monster.mspeed,
            speedChanged,
            speedMessage,
        };
    }

    if (potion.otyp === POT_BLINDNESS) {
        const hasEyes = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES);
        const permanentlyBlind = (monster.mcansee === 0
            || monster.mcansee === false) && !(monster.mblinded ?? 0);
        const before = monster.mblinded ?? 0;
        let resisted = false;
        let blinded = false;
        let blindnessDuration = 0;
        if (hasEyes && !permanentlyBlind) {
            const firstDuration = rn2(32);
            const secondDuration = rn2(32);
            resisted = monsterResistsPotion(monster, state);
            blindnessDuration = 64 + firstDuration
                + (resisted ? 0 : secondDuration);
            monster.mblinded = Math.min(
                127, before + blindnessDuration,
            );
            monster.mcansee = 0;
            blinded = true;
        }
        await wakeMonster?.(monster);
        return {
            angered: true,
            healed: 0,
            curedBlindness: false,
            resisted,
            blinded,
            blindnessDuration,
            blindnessAdded: (monster.mblinded ?? before) - before,
        };
    }

    if (CONFUSION_POTION_TYPES.has(potion.otyp)) {
        const resisted = monsterResistsPotion(monster, state);
        if (!resisted) monster.mconf = 1;
        await wakeMonster?.(monster);
        return {
            angered: true,
            healed: 0,
            curedBlindness: false,
            resisted,
            confused: !resisted,
        };
    }

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
    targetSpotted = canSeeMonster(monster, monster?.mx, monster?.my),
    spotMonster = target => canSpotMonster(target, target?.mx, target?.my),
    repaintMonster = target => newsym(target.mx, target.my),
    rememberInvisible = target => map_invisible(target.mx, target.my),
    wakeNearby,
    splitMonster = target => splitHostileMonster(target, state),
    transformWere = target => transformWereMonster(target, state),
    finishKill,
    showShield = target => shieldeff(target.mx, target.my, state),
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
        state, monster, potion, targetVisible, targetSpotted, wakeMonster,
        publish,
        showShield,
        spotMonster,
        repaintMonster,
        rememberInvisible,
        wakeNearby,
        splitMonster,
        transformWere,
        finishKill,
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
