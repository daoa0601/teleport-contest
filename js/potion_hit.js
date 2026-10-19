// potion_hit.js — Shared potion impact, direct effect, and vapor ownership.
// C refs: potion.c bottlename(), potionhit(), potionbreathe().
import { formatFeltMessage } from './hero_speech.js';
import { requirePlayingGame } from './gstate.js';
import { heroIsHallucinating } from './senses.js';
import { heroIsUnaware } from './hero_sleep.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { makeConfused } from './hero_mental_status.js';
import { makeBlinded } from './sight_change.js';
import { makeDeaf } from './hero_hearing.js';
import { nomul } from './command_state.js';
import { heroEyeCount, heroEyeName } from './body_parts.js';
import { makePlural, verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { A_CON, A_DEX, A_WIS, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, M_SEEN_SLEEP, PLNMSG_OBJ_GLOWS, STRAT_WAITFORU, TIMEOUT, Upolyd, } from './const.js';
import { canSeeMonster, canSpotMonster, map_invisible, newsym, displayColorName, plineWithContinuation, shieldeff, } from './display.js';
import { game } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { splitMonster as splitMonsterActor } from './monster_clone.js';
import { tryCallObjectType } from './object_call.js';
import { recordObjectEncounter, recordObjectKnowledge, } from './object_knowledge.js';
import { POT_ACID, POT_BLINDNESS, POT_BOOZE, POT_CONFUSION, POT_ENLIGHTENMENT, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_FULL_HEALING, POT_GAIN_ABILITY, POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_HALLUCINATION, POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION, POT_POLYMORPH, POT_OIL, POT_RESTORE_ABILITY, POT_PARALYSIS, POT_SEE_INVISIBLE, POT_SICKNESS, POT_SLEEPING, POT_SPEED, POT_WATER, TOWEL, } from './object_data.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE, MONSTER_RESISTS, MONSTER_SOUND, MONSTER_SYMBOL, monsterHatesBlessings, monsterIsHuman, monsterIsPlayerMonster, } from './monster_data.js';
import { polymorphMonsterFromMagic } from './monster_polymorph_attack.js';
import { AD_ACID, AD_DISE, AD_PEST, } from './monster_attack_types.js';
import { finishMonsterKilled } from './monster_death.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance, } from './monster_resistance.js';
import { adjustMonsterSpeed, monsterSpeedMessage, } from './monster_speed.js';
import { setMonsterPermanentInvisibility, } from './monster_invisibility.js';
import { monstersObserveHeroResistance } from './monster_perception.js';
import { blessObjectState, curseObjectState, unblessObjectState, uncurseObjectState, } from './object_state.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { d, rnd, rn2, rnl } from './rng.js';
import { heroIsBlind, } from './senses.js';
import { chargeUnpaidObjectAsDebt, objectTypeKnown, } from './shk.js';
import { monsterSaddle } from './steed.js';
import { monsterName } from './monster_name.js';
import { deleteObject } from './object_delete.js';
import { cansee } from './vision.js';
import { applyHeroWaterVaporChange, transformWereMonster, } from './were.js';
import { heroHasProtectionFromShapeChangers, } from './polyself.js';
import { heroFormSticks } from './hero_species.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { putMonsterToSleep } from './monster_sleep.js';
import { objectAction, objectCombatName, definiteObjectAction } from './objnam.js';
const PM_PESTILENCE = 312;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const M1_BREATHLESS = 0x00000400;
const M1_NOEYES = 0x00001000;
const M1_NOHEAD = 0x00008000;
const M2_WERE = 0x00000004;
const MR_SLEEP = 0x04;
const S_MIMIC = 13;
export const INERT_MONSTER_POTION_TYPES = new Set([
    POT_GAIN_LEVEL,
    POT_ENLIGHTENMENT,
    POT_SEE_INVISIBLE,
    POT_GAIN_ENERGY,
    POT_LEVITATION,
    POT_FRUIT_JUICE,
    POT_HALLUCINATION,
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
    POT_ACID,
    POT_OIL,
    POT_POLYMORPH,
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
// potion.c:bottlename() is shared by hero- and monster-thrown impacts.  The
// selector callback lets source-turn planners retain their own RNG ledger.
export function randomBottleName(state = game, select = rn2) {
    const names = heroIsHallucinating(state)
        ? HALLUCINATED_BOTTLE_NAMES : ORDINARY_BOTTLE_NAMES;
    const name = names[select(names.length)];
    if (name === undefined)
        throw new Error('Bottle name selection was outside its range.');
    return name;
}
export function potionImpactObjectName(potion, state = game) {
    return objectCombatName(potion, { state, includeCorpseSpecies: false });
}
function sentenceSubject(monster) {
    const subject = monsterName(monster);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}`;
}
function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
function potionHitsSaddle(monster, potion) {
    const saddle = monsterSaddle(monster);
    if (!saddle)
        return null;
    if (rn2(10) === 0)
        return saddle;
    if (potion.otyp !== POT_WATER)
        return null;
    // Keep potion.c's short-circuit order. Neutral water still consumes both
    // luck rolls before it reaches the final one-in-three chance.
    if (rnl(10) > 7 && potion.cursed)
        return saddle;
    if (rnl(10) < 4 && potion.blessed)
        return saddle;
    return rn2(3) === 0 ? saddle : null;
}
function saddleOwnerPhrase(monster, state) {
    const phrase = possessive(monsterName(monster, { state, suppressIt: true, suppressSaddle: true }));
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
}
async function applyPotionToSaddle({ state, monster, saddle, potion, targetVisible, targetSpotted, publish, }) {
    const seen = !heroIsBlind(state) && targetVisible && targetSpotted;
    const owner = saddleOwnerPhrase(monster, state);
    const glowingSaddle = potion.otyp === POT_WATER
        ? `${owner} ${objectAction(saddle, 'glow', state)}` : '';
    let change = null;
    if (potion.otyp === POT_WATER && potion.blessed) {
        if (saddle.cursed) {
            change = { apply: () => uncurseObjectState(saddle), color: 'amber', aura: false };
        }
        else if (!saddle.blessed) {
            change = { apply: () => blessObjectState(saddle), color: 'light blue', aura: true };
        }
    }
    else if (potion.otyp === POT_WATER && potion.cursed) {
        if (saddle.blessed) {
            change = { apply: () => unblessObjectState(saddle), color: 'brown', aura: false };
        }
        else if (!saddle.cursed) {
            change = { apply: () => curseObjectState(saddle), color: 'black', aura: true };
        }
    }
    if (!change) {
        if (seen)
            await publish(`${owner} ${objectAction(saddle, 'get', state)} wet.`);
        return;
    }
    if (seen) {
        const color = displayColorName(change.color, state);
        const glow = change.aura ? `with ${withIndefiniteArticle(color)} aura` : color;
        await publish(`${glowingSaddle} ${glow}.`);
        state._lastPlineKind = PLNMSG_OBJ_GLOWS;
        saddle.bknown = !heroIsHallucinating(state);
    }
    else if (!potion.bknown || !potion.dknown) {
        saddle.bknown = false;
    }
    change.apply();
}
function healingCuresBlindness(potion) {
    if (potion.otyp === POT_FULL_HEALING)
        return true;
    if (potion.otyp === POT_EXTRA_HEALING)
        return !potion.cursed;
    return potion.otyp === POT_HEALING && !!potion.blessed;
}
function healHeroOnePoint(state) {
    const hero = state.u;
    if (Upolyd(hero) && hero.mh < hero.mhmax) {
        hero.mh++;
        state.context.botl = true;
    }
    if (hero.uhp < hero.uhpmax) {
        hero.uhp++;
        state.context.botl = true;
    }
}
function restoreBaseAttributes(state, potion) {
    const base = state.u?.acurr?.a;
    const maximum = state.u?.amax?.a;
    const start = rn2(6);
    if (!Array.isArray(base) || !Array.isArray(maximum))
        return start;
    for (let offset = 0; offset < 6; offset++) {
        const index = (start + offset) % 6;
        if ((base[index] ?? 0) < (maximum[index] ?? 0)) {
            const current = base[index];
            if (current === undefined)
                throw new Error(`Missing hero attribute ${index}`);
            base[index] = current + 1;
            state.context.botl = true;
            if (!potion.blessed)
                break;
        }
    }
    return start;
}
export function heroPotionVaporProfile(state) {
    const mnum = Number.isInteger(state.u?.umonnum)
        ? state.u.umonnum
        : Number.isInteger(state.u?.umonster) ? state.u.umonster : null;
    const flags = typeof mnum === 'number' && Number.isInteger(mnum) ? MONSTER_FLAGS1[mnum] ?? 0 : 0;
    const breathless = !!(flags & M1_BREATHLESS);
    const hasEyes = !(flags & M1_NOEYES);
    return { breathless, hasEyes, canReceive: !breathless || hasEyes };
}
function heroHasVaporShield(state) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return eyewear?.otyp === TOWEL && (eyewear.spe ?? 0) > 0;
}
function sicknessCannotHarmMonster(monster) {
    return monsterHasPoisonResistance(monster)
        || MONSTER_ATTACKS[monster?.mnum]?.some(attack => attack[1] === AD_DISE || attack[1] === AD_PEST);
}
// zap.c:resist() uses potion attack level 6 and the target's runtime level.
// NOTELL suppresses shield presentation but the resistance draw still occurs.
function monsterResistsPotion(monster, state = game) {
    const mnum = monster?.mnum;
    let defenseLevel = monster?.m_lev
        ?? MONSTER_LEVEL[mnum] ?? 1;
    if (defenseLevel < 1)
        defenseLevel = monsterIsPlayerMonster(mnum)
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
        || !!monster?.defendedSleep;
}
async function installPotionHelplessness(state, duration, reason) {
    // nomul() keeps a longer involuntary delay. The caller still replaces
    // its reason and recovery message, even when nomul() returns early.
    nomul(-duration, state);
    state._helplessReason = reason;
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
}
function heroIsFast(state) {
    return !!(state.u?.fast || state.u?.veryFast
        || state.u?.veryFastFromArmor
        || (state.u?.veryFastTurns ?? 0) > 0);
}
function heroSeesInvisible(state) {
    const hero = state.u;
    return !!(hero.seeInvisible
        || (hero.seeInvisibleTurns ?? 0) > 0);
}
function monsterIsWere(monster) {
    return !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_WERE);
}
function waterEffectSubject(monster, targetSpotted) {
    return targetSpotted ? sentenceSubject(monster) : 'It';
}
// potion.c:potionhit() shares this exact pain/wake transaction between holy
// water and acid.  Silence selects writhing and suppresses wake_nearto(); an
// audible species wakes the level-scaled radius before any damage die.
async function publishPotionPainAndWakeRadius({ monster, targetSpotted, wakeNearby, effectName, publish = plineWithContinuation, }) {
    const silent = (MONSTER_SOUND[monster.mnum] ?? 0) === 0;
    await publish(`${waterEffectSubject(monster, targetSpotted)} ${silent ? 'writhes' : 'shrieks'} in pain!`);
    if (!silent) {
        if (!wakeNearby)
            throw new Error(`${effectName} wake-radius owner unavailable`);
        await wakeNearby(monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 10);
    }
}
function wereTransformationNoun(monster) {
    if (!monsterIsHuman(monster?.mnum))
        return 'human';
    if (monster.mnum === 261)
        return 'rat';
    if (monster.mnum === 262)
        return 'jackal';
    return 'wolf';
}
function monsterSurvivedPotion(monster) {
    return !monster.dead && (monster.mhp ?? 0) > 0;
}
async function finishPotionVaporKnowledge(state, potion, identifiesType) {
    if (potion.dknown === false)
        return null;
    if (identifiesType) {
        if (!objectTypeKnown(potion, state)) {
            // makeknown()->discover_object(..., credit_hero=TRUE)
            await exerciseAttribute(A_WIS, true, state);
            recordObjectKnowledge(potion.otyp, state);
            recordObjectEncounter(potion.otyp, state);
        }
        return { identified: true, prompted: false };
    }
    return await tryCallObjectType(potion, state);
}
function cursedVaporEyeMessage(state) {
    const eye = heroEyeName(state);
    const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
    return `Your ${eyes} ${verbForSubject(eyes, 'sting')}!`;
}
// potionbreathe() is shared by monster contact and nearby floor breakage.
// Its final knowledge transaction either identifies an unambiguous effect or
// asks for a type-wide call name before the caller frees the potion identity.
// Potions without a vapor effect still reach that naming opportunity.
export async function applySupportedPotionVapor(options) {
    const potion = options.potion;
    const inUse = potion.in_use;
    potion.in_use = true;
    let effect;
    try {
        effect = await applyPotionVaporEffect(options);
    }
    finally {
        if (inUse === undefined)
            delete potion.in_use;
        else
            potion.in_use = inUse;
    }
    if (!effect.received)
        return effect;
    const typeCall = await finishPotionVaporKnowledge(options.state ?? game, potion, effect.identifiesType ?? false);
    return { ...effect, typeCall };
}
async function applyPotionVaporEffect({ state = game, potion, publish = plineWithContinuation, monsterCanSeeHero = null, }) {
    requirePlayingGame(state);
    const profile = heroPotionVaporProfile(state);
    if (!profile.canReceive)
        return { received: false };
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
    let identifiesType = false;
    if (ABILITY_POTION_TYPES.has(potion.otyp)) {
        if (potion.cursed) {
            await publish(profile.breathless
                ? cursedVaporEyeMessage(state)
                : 'Ulch!  That potion smells terrible!');
        }
        else {
            abilityStart = restoreBaseAttributes(state, potion);
        }
    }
    else if (HEALING_POTION_TYPES.has(potion.otyp)) {
        const points = potion.otyp === POT_FULL_HEALING ? 3
            : potion.otyp === POT_EXTRA_HEALING ? 2 : 1;
        for (let point = 0; point < points; point++)
            healHeroOnePoint(state);
        if (healingCuresBlindness(potion)) {
            await makeBlinded(0, { state, talk: !state.u.ucreamed, publish });
            await makeDeaf(0, { state, publish });
        }
        await exerciseAttribute(A_CON, true, state);
    }
    else if (potion.otyp === POT_SICKNESS
        && state.urole?.key !== 'healer') {
        const hero = state.u;
        if (Upolyd(hero))
            hero.mh = (hero.mh ?? 0) <= 5 ? 1 : hero.mh - 5;
        else
            hero.uhp = (hero.uhp ?? 0) <= 5 ? 1 : hero.uhp - 5;
        state.context.botl = true;
        await exerciseAttribute(A_CON, false, state);
    }
    else if (potion.otyp === POT_HALLUCINATION) {
        await publish('You have a momentary vision.');
    }
    else if (CONFUSION_POTION_TYPES.has(potion.otyp)) {
        const hero = state.u;
        if ((hero.confusionTurns ?? 0) <= 0)
            await publish(formatFeltMessage('somewhat dizzy.', state));
        confusionDuration = rnd(5);
        await makeConfused((hero.confusionTurns ?? 0) + confusionDuration, {
            state, talk: false, publish,
        });
    }
    else if (HELPLESS_POTION_TYPES.has(potion.otyp)) {
        identifiesType = true;
        const freeAction = heroHasFreeAction(state);
        const sleepResistance = !!state.u.sleepResistance;
        const protectedFromEffect = freeAction
            || (potion.otyp === POT_SLEEPING && sleepResistance);
        if (protectedFromEffect) {
            resisted = true;
            await publish(potion.otyp === POT_PARALYSIS
                ? 'You stiffen momentarily.' : 'You yawn.');
            if (potion.otyp === POT_SLEEPING) {
                monstersObserveHeroResistance(M_SEEN_SLEEP, state, monsterCanSeeHero);
            }
        }
        else {
            await publish(potion.otyp === POT_PARALYSIS
                ? 'Something seems to be holding you.'
                : formatFeltMessage('rather tired.', state));
            helplessDuration = rnd(5);
            await installPotionHelplessness(state, helplessDuration, potion.otyp === POT_PARALYSIS
                ? 'frozen by a potion'
                : 'sleeping off a magical draught');
        }
    }
    else if (potion.otyp === POT_SPEED) {
        const hero = state.u;
        if (!heroIsFast(state))
            await publish('Your knees seem more flexible now.');
        speedDuration = rnd(5);
        hero.veryFastTurns = Math.min(TIMEOUT, Math.max(0, hero.veryFastTurns ?? 0) + speedDuration);
        hero.veryFast = true;
        await exerciseAttribute(A_DEX, true, state);
    }
    else if (potion.otyp === POT_BLINDNESS) {
        const hero = state.u;
        const wasBlind = heroIsBlind(state);
        const unaware = heroIsUnaware(state);
        identifiesType = !wasBlind && !unaware;
        if (!wasBlind && !unaware)
            await publish('It suddenly gets dark.');
        blindnessDuration = rnd(5);
        await makeBlinded((hero.blindTurns ?? 0) + blindnessDuration, {
            state, talk: false, publish,
        });
        const blindNow = heroIsBlind(state);
        sightToggled = wasBlind !== blindNow;
        if (!blindNow && !unaware)
            await publish('Your vision clears.');
    }
    else if (potion.otyp === POT_INVISIBILITY) {
        if (!heroIsBlind(state) && !heroIsInvisible(state)) {
            identifiesType = true;
            invisibilityGlimpse = heroSeesInvisible(state)
                ? 'transparent' : 'unseen';
            await publish(invisibilityGlimpse === 'transparent'
                ? 'For an instant you could see right through yourself!'
                : "For an instant you couldn't see yourself!");
        }
    }
    else if (potion.otyp === POT_WATER) {
        waterEffect = await applyHeroWaterVaporChange({
            state, potion, publish,
        });
    }
    else if ([POT_ACID, POT_POLYMORPH].includes(potion.otyp)) {
        await exerciseAttribute(A_CON, false, state);
    }
    else if (potion.otyp === POT_OIL) {
        // potionbreathe() has no oil case.
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
        identifiesType,
    };
}
async function applySupportedDirectEffect({ state, monster, potion, targetVisible, targetSpotted, wakeMonster: wakeAttackedTarget, publish, showShield, spotMonster, repaintMonster, rememberInvisible, wakeNearby, splitMonster, transformWere, finishKill, heroCaused, }) {
    // Most effects inherit potionhit's your_fault flag. Invisibility has
    // its own anger rule; polymorph delegates its contact to bhitm().
    const wakeMonster = heroCaused || potion.otyp === POT_INVISIBILITY || potion.otyp === POT_POLYMORPH
        ? wakeAttackedTarget : (target) => { target.msleeping = 0; };
    if (potion.otyp === POT_POLYMORPH) {
        const result = await polymorphMonsterFromMagic(monster, {
            state,
            targetSpotted,
            wakeMonster,
            publish,
            showShield,
            finishDeath: finishKill,
        });
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            ...result,
        };
    }
    if (potion.otyp === POT_OIL) {
        let explosionDamage = 0;
        if (potion.lamplit) {
            const explosion = await explodeLitOilPotion(potion, monster.mx, monster.my, {
                state,
                // explode() attributes damage by the active turn.
                heroCaused: !state.context.mon_moving,
                publish,
            });
            if (explosion.heroDied)
                return { heroDied: true };
            explosionDamage = explosion.damage;
        }
        const killed = !monsterSurvivedPotion(monster);
        if (!killed && (await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            explosionDamage,
            killed,
        };
    }
    if (potion.otyp === POT_ACID) {
        const acidResistant = monsterHasAcidResistance(monster);
        const resisted = !acidResistant
            && monsterResistsPotion(monster, state);
        let acidDamage = 0;
        let killed = false;
        if (!acidResistant && !resisted) {
            await publishPotionPainAndWakeRadius({
                monster,
                targetSpotted,
                wakeNearby,
                effectName: 'acid',
                publish,
            });
            acidDamage = d(potion.cursed ? 2 : 1, potion.blessed ? 4 : 8);
            monster.mhp -= acidDamage;
            killed = monster.mhp <= 0;
            if (killed && heroCaused) {
                if (!finishKill)
                    throw new Error('acid fatality owner unavailable');
                const death = await finishKill(monster);
                if (death.heroDied)
                    return { heroDied: true };
                killed = death.killed;
            }
            else if (killed) {
                // C monkilled(mon, "", AD_ACID) when the hero did not throw it.
                const death = await finishMonsterKilled(monster, state, {
                    damageType: AD_ACID, publish,
                });
                if (death.heroDied)
                    return { heroDied: true };
                killed = !death.survived;
            }
        }
        if (!killed && (await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            acidResistant,
            resisted,
            acidDamage,
            killed,
        };
    }
    if (potion.otyp === POT_WATER) {
        const affectedByHoliness = monsterHatesBlessings(monster)
            || monsterIsWere(monster);
        let angered = heroCaused;
        let waterDamage = 0;
        let waterHealing = 0;
        let transformedWere = false;
        let splitClone = null;
        let killed = false;
        if (affectedByHoliness) {
            if (potion.blessed) {
                await publishPotionPainAndWakeRadius({
                    monster,
                    targetSpotted,
                    wakeNearby,
                    effectName: 'water',
                    publish,
                });
                waterDamage = d(2, 6);
                monster.mhp -= waterDamage;
                killed = monster.mhp <= 0;
                if (killed) {
                    if (!finishKill)
                        throw new Error('water fatality owner unavailable');
                    const death = await finishKill(monster);
                    if (death.heroDied)
                        return { heroDied: true };
                    killed = death.killed;
                }
                else if (monsterIsWere(monster)
                    && !monsterIsHuman(monster?.mnum)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroIsHallucinating(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${wereTransformationNoun(monster)}.`);
                    }
                    transformedWere = !!(await transformWere(monster, state));
                }
            }
            else if (potion.cursed) {
                angered = false;
                if (targetSpotted)
                    await publish(`${sentenceSubject(monster)} looks healthier.`);
                waterHealing = d(2, 6);
                monster.mhp = Math.min(monster.mhpmax ?? monster.mhp, monster.mhp + waterHealing);
                if (monsterIsWere(monster) && monsterIsHuman(monster?.mnum)
                    && !heroHasProtectionFromShapeChangers(state)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroIsHallucinating(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${wereTransformationNoun(monster)}.`);
                    }
                    transformedWere = !!(await transformWere(monster, state));
                }
            }
        }
        else if (monster.mnum === PM_GREMLIN) {
            angered = false;
            if (!splitMonster)
                throw new Error('water gremlin-split owner unavailable');
            splitClone = await splitMonster(monster, state);
        }
        else if (monster.mnum === PM_IRON_GOLEM) {
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} rusts.`);
            waterDamage = d(1, 6);
            monster.mhp -= waterDamage;
            killed = monster.mhp <= 0;
            if (killed) {
                if (!finishKill)
                    throw new Error('water fatality owner unavailable');
                const death = await finishKill(monster);
                if (death.heroDied)
                    return { heroDied: true };
                killed = death.killed;
            }
        }
        if (!killed) {
            if (angered) {
                if ((await wakeMonster?.(monster))?.heroDied)
                    return { heroDied: true };
            }
            else
                monster.msleeping = 0;
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
        const invisibility = setMonsterPermanentInvisibility(monster, !cursedPotion);
        if (!monster.invis_blkd && invisibility.changed) {
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
        }
        else if (sawIt && cursedPotion) {
            invisibilityMessage = `${sentenceSubject(monster)} briefly seems `
                + 'to be transparent.';
            await publish(invisibilityMessage);
        }
        else if (!sawIt && spottedAfter) {
            invisibilityMessage = `${sentenceSubject(monster)} appears!`;
            await publish(invisibilityMessage);
        }
        if (angered) {
            if ((await wakeMonster?.(monster))?.heroDied)
                return { heroDied: true };
        }
        else
            monster.msleeping = 0;
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
        if (!!monster.mcanmove) {
            duration = rnd(25);
            monster.mcanmove = 0;
            monster.mfrozen = Math.min(duration, 127);
            monster.meating = 0;
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
            paralyzed = true;
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            paralyzed,
            duration,
        };
    }
    if (potion.otyp === POT_SLEEPING) {
        const duration = rnd(12);
        const appearance = M_AP_TYPE(monster);
        if (!monster.msleeping && !monster.mfrozen && MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            && (appearance === M_AP_FURNITURE || appearance === M_AP_OBJECT))
            revealMonsterAppearance(monster);
        const inherentOrDefended = monsterHasSleepDefense(monster);
        const resisted = inherentOrDefended
            || monsterResistsPotion(monster, state);
        let slept = false;
        if (resisted) {
            await showShield?.(monster);
        }
        else if (putMonsterToSleep(monster, duration)) {
            slept = true;
            await publish(`${sentenceSubject(monster)} falls asleep.`);
            if (monster === state.u?.ustuck && !state.u?.uswallow
                && !heroFormSticks(state)) {
                await publish(`${possessive(sentenceSubject(monster))} grip relaxes.`);
                // C potionhit() calls slept_monst(), which uses unstuck().
                await releaseHeroFromMonster(monster, { state, publish });
            }
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            resisted,
            slept,
            duration,
        };
    }
    if (potion.otyp === POT_SPEED) {
        const speed = adjustMonsterSpeed(monster, 1);
        const speedMessage = targetSpotted
            ? monsterSpeedMessage(speed, sentenceSubject(monster))
            : null;
        if (speedMessage)
            await publish(speedMessage);
        monster.msleeping = 0;
        return {
            angered: false,
            healed: 0,
            curedBlindness: false,
            oldSpeed: speed.oldSpeed,
            speed: speed.speed,
            speedChanged: speed.changed,
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
            monster.mblinded = Math.min(127, before + blindnessDuration);
            monster.mcansee = 0;
            blinded = true;
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
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
        if (!resisted)
            monster.mconf = 1;
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            resisted,
            confused: !resisted,
        };
    }
    if (potion.otyp === POT_SICKNESS && monster.mnum !== PM_PESTILENCE) {
        const oldHp = monster.mhp;
        if (sicknessCannotHarmMonster(monster)) {
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} looks unharmed.`);
        }
        else if (monster.mhp > 2) {
            monster.mhp = Math.trunc(monster.mhp / 2);
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} looks rather ill.`);
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: monster.mhp - oldHp,
            curedBlindness: false,
        };
    }
    const healsMonster = HEALING_MONSTER_POTION_TYPES.has(potion.otyp)
        || (potion.otyp === POT_SICKNESS
            && monster.mnum === PM_PESTILENCE);
    if (!healsMonster) {
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return { angered: heroCaused, healed: 0, curedBlindness: false };
    }
    // Healing potions invert against Pestilence; gain/restore ability do not.
    if (monster.mnum === PM_PESTILENCE
        && HEALING_POTION_TYPES.has(potion.otyp)) {
        const oldHp = monster.mhp;
        if (monster.mhp > 2) {
            monster.mhp = Math.trunc(monster.mhp / 2);
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} looks rather ill.`);
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: monster.mhp - oldHp,
            curedBlindness: false,
        };
    }
    const oldHp = monster.mhp;
    if (monster.mhp < monster.mhpmax) {
        monster.mhp = monster.mhpmax;
        if (targetSpotted)
            await publish(`${sentenceSubject(monster)} looks sound and hale again.`);
    }
    let curedBlindness = false;
    if (healingCuresBlindness(potion) && !monster.mcansee) {
        monster.mcansee = 1;
        monster.mblinded = 0;
        curedBlindness = true;
        if (targetSpotted
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
export async function hitMonsterWithSupportedPotion({ state = game, monster, potion, wakeMonster = null, publish = plineWithContinuation, targetVisible = cansee(monster?.mx, monster?.my), targetSpotted = canSeeMonster(monster), spotMonster = target => canSpotMonster(target), repaintMonster = target => newsym(target.mx, target.my), rememberInvisible = target => map_invisible(target.mx, target.my), wakeNearby = null, splitMonster = target => splitMonsterActor(target, state, { publish }), transformWere = target => transformWereMonster(target, state), finishKill = null, showShield = target => shieldeff(target.mx, target.my, state), heroCaused = true, resolveVapor = false, distance = 0, target = { x: monster.mx, y: monster.my }, }) {
    if (!monster || !potion
        || !SUPPORTED_MONSTER_POTION_TYPES.has(potion.otyp))
        return null;
    const bottleName = randomBottleName(state);
    const saddle = potionHitsSaddle(monster, potion);
    const hasHead = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOHEAD);
    let crashMessage = 'Crash!';
    if (targetVisible) {
        const name = monsterName(monster, { state });
        const onHead = target.x === monster.mx && target.y === monster.my;
        const impactTarget = saddle
            ? `${possessive(monsterName(monster, { state, suppressIt: true, suppressSaddle: true }))} saddle`
            : hasHead ? `${possessive(name)} ${onHead ? 'head' : 'body'}` : name;
        crashMessage = `The ${bottleName} crashes on ${impactTarget} and breaks into shards.`;
    }
    await publish(crashMessage);
    const impactRoll = rn2(5);
    const impactDamage = !saddle && impactRoll !== 0 && monster.mhp > 1
        ? 1 : 0;
    if (impactDamage)
        monster.mhp--;
    let evaporationMessage = null;
    if (targetVisible && potion.otyp !== POT_OIL && !saddle) {
        evaporationMessage = `${definiteObjectAction(potion, 'evaporate', state)}.`;
        await publish(evaporationMessage);
    }
    if (saddle) {
        await applyPotionToSaddle({
            state, monster, saddle, potion,
            targetVisible, targetSpotted, publish,
        });
    }
    const directEffect = saddle ? null : await applySupportedDirectEffect({
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
        heroCaused,
    });
    if (directEffect?.heroDied)
        return {
            heroDied: true, bottleName, crashMessage, evaporationMessage,
            impactDamage, directEffect,
        };
    let breathedVapor = false;
    let vaporEffect = null;
    if (resolveVapor) {
        breathedVapor = distance === 0;
        if (!breathedVapor && distance > 0 && distance < 3) {
            breathedVapor = rn2(Math.trunc((1 + currentAttribute(A_DEX, state)) / 2)) === 0;
        }
        if (breathedVapor) {
            vaporEffect = await applySupportedPotionVapor({
                state, potion, publish,
            });
            breathedVapor = vaporEffect.received;
        }
    }
    let typeCall = vaporEffect?.typeCall || null;
    if (!breathedVapor && targetVisible)
        typeCall = await tryCallObjectType(potion, state);
    await chargeUnpaidObjectAsDebt(potion, state, publish);
    await deleteObject(potion, state);
    return {
        bottleName,
        crashMessage,
        evaporationMessage,
        impactDamage,
        directEffect,
        breathedVapor,
        vaporEffect,
        typeCall,
    };
}
//# sourceMappingURL=potion_hit.js.map