// potion.js — the potion.c owner: the make_* status setters (make_confused(),
// make_stunned(), make_sick(), make_slimed(), make_stoned(), make_blinded(),
// toggle_blindness(), make_hallucinated(), make_deaf(), make_glib()), the
// drink transaction (drink_ok(), dodrink(), dopotion()), the quaff effect
// switch (peffects() and its peffect_* helpers, healup(), speed_up()), bottle
// occupants (ghost_from_bottle(), djinni_from_bottle(), mongrantswish(),
// split_mon()), thrown-potion impact and vapor (bottlename(), H2Opotion_dip(),
// impact_arti_light(), potionhit(), potionbreathe()), and dipping and mixing
// (dodip(), dip_into(), potion_dip(), mixtype(), hold_potion(), poof(),
// dip_potion_explosion(), strange_feeling()).  The hero's own potion impact
// (potionhit(mon == &youmonst)) in hero_potion_hit.ts; spell reuse of the
// effect switch in spell_potion_effects.ts; the dothrow.c throwit() flight in
// dothrow.ts; inaccessible_equipment()'s covering test in
// equipment_selection.ts.

import { artifactWarningFeedback, wieldedArtifactWarns } from './artifacts.js';
import { armorSlotFor, heroHasFreeAction, objectIsHardHelmet, coveringEquipment, reportCoveredEquipment, fingersOrGloves } from './do_wear.js';
import { setBallAndChainFelt } from './ball.js';
import { adjustAttribute, attributeChangeMessage, currentAttribute, exerciseAttribute, requireAttributeIndex } from './attrib.js';
import { heroEyeCount, heroEyeName, heroFaceName, heroFootName, heroHandName, heroHasEyes, heroHeadName, heroLegName } from './body_parts.js';
import { commandResultCancelled, commandResultFailed, setMulti, travelStairs } from './cmd.js';
import { applyHeroLocationEffects, loseHeroHp, nearCapacity, nomul } from './hack.js';
import { A_CON, A_DEX, A_INT, A_MAX, A_STR, A_WIS, BOLT_LIM, COLNO, CQ_CANNED, EXPL_FIERY, FOUNTAIN, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_SUGGEST, G_GONE, IS_SINK, Is_airlevel, Is_waterlevel, KILLED_BY, KILLED_BY_AN, MM_NOMSG, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, M_SEEN_SLEEP, NO_KILLER_PREFIX, PLNMSG_OBJ_GLOWS, POLY_CONTROLLED, POLY_LOW_CTRL, POLY_NOFLAGS, ROWNO, SICK_ALL, SICK_NONVOMITABLE, SICK_VOMITABLE, SINK, STRAT_WAITFORU, TIMEOUT, Upolyd, WEAK } from './const.js';
import { impossible } from './diagnostics.js';
import type { PropertyObject, WornPropertySlot } from './property_types.js';
import { dipFountain, dipSink, drinkFountain, drinkSink, washHands } from './fountain.js';
import type { DipTarget } from './fountain.js';
import { canSeeMonster, canSpotMonster, map_invisible, newsym, see_monsters, see_objects, see_traps, shieldeff, show_glyph_cell, swallowed, unmap_invisible } from './display.js';
import { displayColorName, displayLiquidName, monsterName, randomDisplayMonsterName } from './do_name.js';
import type { ObjectCallResult } from './do_name.js';
import { tameMonster } from './dog.js';
import { canHeroRiseUp, levelAtDepth, levelHasCeiling } from './dungeon.js';
import { reportHeroEncumbrance } from './pickup.js';
import { addExperience, gainExperienceLevel, randomExperience } from './exper.js';
import { explode } from './explosion.js';
import { fireDamageObject, waterDamageObject, erodeObject, objectIsVulnerableToErosion, captureLevitationState, floatHeroUp } from './trap.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { heroCanReachFloor } from './engrave.js';
import { useUpFloorObject } from './floor_consumption.js';
import { fruitName } from './fruit.js';
import type { GameState, PlayingGameState } from './game_state.js';
import { LL_CONDUCT, recordGameLogEvent } from './gamelog.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { depth, dist2, ledgerNo, possessiveName } from './hacklib.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';

import { removeWornHeroItem } from './hero_equipment.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { hurtleHero } from './dothrow.js';
import { burnAwayHeroSlime, dropHeroSliming, putHeroToSleep } from './timeout.js';
import { freeInventoryObject, learnUnseenInventory, useUpInventoryStack } from './hero_inventory.js';
import { hasInternalInvisibility, heroIsInvisible, invisibilityIsBlocked, syncHeroInvisibility } from './hero_invisibility.js';

import type { Hero } from './hero_types.js';
import type { FinishHeroMonsterDeath } from './hero_monster_death.js';
import { reportHeroThrownMiss } from './dothrow.js';
import { grantHeroSeeInvisible } from './hero_seeing.js';
import { heroIsUnaware } from './senses.js';
import { heroFormSticks, heroSpecies, heroHasProtectionFromShapeChangers, heroIsPolymorphed, heroIsUnchanging, polymorphHero } from './polyself.js';
import { formatFeltMessage } from './hero_speech.js';
import { heroIsStrangled } from './do_wear.js';
import { heroCanBeSlimed, updateHeroHunger, updateMealMimicry, fixHeroPetrification } from './eat.js';
import { cmdq_peek } from './cmd.js';
import { doEnlightenmentEffect } from './zap.js';
import { showEnlightenment } from './insight.js';

import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { chooseInventoryObject, getobj } from './inventory_prompt.js';
import type { InventoryClassification } from './inventory_prompt.js';
import { gotoLevel } from './level_change.js';
import { floatingAbove } from './levitation_commands.js';
import { pickupBurden } from './pickup.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';
import { detectMonsters, detectObjects } from './detect.js';
import { cloneMonster, setMonsterMalign } from './makemon.js';
import type { CloneOptions } from './makemon.js';
import type { MapLocation, Position, Stairway } from './map_types.js';
import { putMonsterToSleep } from './mhitm.js';
import { cloneHeroMonsterForm, makemonNear } from './mklev.js';
import { mkobj, blessObjectState, curseObject, curseObjectState, deallocateObject, mksobj, unblessObjectState, uncurseObjectState, unlinkObject, objectQuantity, splitObjectStack } from './mkobj.js';
import { finishMonsterKilled, removeMonsterFromGame, removeWishGrantingMonster, revealMonsterAppearance, wakeMonstersNearWithMessages } from './mon.js';
import type { MonsterFormChange, MonsterSelfTouchResult } from './mon.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance, monstersForgetHeroResistance, monstersObserveHeroResistance } from './mondata.js';
import { AD_ACID, AD_DISE, AD_PEST } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SOUND, MONSTER_SYMBOL, monsterHasEyes, monsterHatesBlessings, monsterIsHuman, monsterIsPlayerMonster } from './monster_data.js';
import type { Monster } from './monster_types.js';
import { tryCallObjectType, healHeroLegs } from './do.js';
import { objectDescription, makePlural, verbForSubject, withIndefiniteArticle, definiteName, definiteObjectAction, objectAction, objectCombatName, objectName, objectNameIsPlural, objectQuestion, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectName } from './objnam.js';
import { hitFloorWithObject, staggerVerb } from './dothrow.js';
import { learnObjectType, observeObject, recordObjectEncounter, recordObjectKnowledge } from './o_init.js';
import { ALCHEMY_SMOCK, CORPSE, LENSES, MAGIC_LAMP, MUMMY_WRAPPING, OBJECT_DESCRIPTIONS, OBJECT_INITIAL_KNOWN, OBJECT_MAGIC, OBJECT_NAMES, OIL_LAMP, POT_ACID, POT_BLINDNESS, POT_BOOZE, POT_CONFUSION, POT_ENLIGHTENMENT, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_FULL_HEALING, POT_GAIN_ABILITY, POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_HALLUCINATION, POT_HEALING, POT_INVISIBILITY, POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION, POT_OIL, POT_PARALYSIS, POT_POLYMORPH, POT_RESTORE_ABILITY, POT_SEE_INVISIBLE, POT_SICKNESS, POT_SLEEPING, POT_SPEED, POT_WATER, SPE_DETECT_MONSTERS, SPE_DETECT_TREASURE, SPE_HASTE_SELF, SPE_INVISIBILITY, SPE_LEVITATION, SPE_RESTORE_ABILITY, TOWEL, UNICORN_HORN } from './object_data.js';
import { isLauncherAmmunition, isPermanentlyPoisonedObject, isPoisonableObject, isWeaponTool } from './object_properties.js';
import type { GameObject } from './object_types.js';
import type { ScrollEffectOptions, ScrollEffectResult } from './read.js';
import { plineWithContinuation, plineWithContinuation as pline } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { poisonAttributeMessage } from './poison.js';
import { grantIntrinsicProperty, grantWornProperty, hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasPermanentIntrinsicProperty, hasWornProperty, propertyIsActive, propertyIsBlocked, propertyTimeout, refreshMovementProperties, refreshProperty, removeWornProperty, revokeIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { promptYesNo } from './query.js';
import { d, rn1, rn2, rnd, rnl } from './rng.js';
import { blindfolded, blindnessBlocked, heroDetectsMonsters, heroIsBlind, heroIsBlinded, heroIsDeaf, heroIsHallucinating, heroWouldBeBlindWithTimeout, permanentBlind, setHeroBlindnessTurns, syncDeafness } from './senses.js';
import { chargeAlteredUnpaidObject, chargeUnpaidObjectAsDebt, chargeUnpaidUsage, objectOwnershipPrefix, objectTypeKnown, updateUnpaidObjectPrice, deleteObject } from './shk.js';
import { heroIsFlaming } from './polyself.js';
import { monsterAtPosition, monsterSaddle } from './steed.js';
import { heroIsPetrifying } from './stoning.js';
import { ceilingName, surfaceName, waterbodyName } from './terrain_name.js';
import { isPoolAt } from './dbridge.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { offerThrownFood } from './thrown_food.js';
import { detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, prepareHeroThrownTarget } from './thrown_object.js';

import type { ProjectileFlightCapture } from './thrown_object.js';

import { tossObjectUp } from './dothrow.js';
import { flushPendingTopline } from './tty_topline.js';
import { dropCursedSecondaryWeapon } from './wield.js';
import { cansee, vision_recalc } from './vision.js';
import { applyHeroWaterVaporChange, applyHeroWereChange, purifyHeroLycanthropy, revertHeroWereForm, setHeroLycanthropy, transformWereMonster } from './were.js';
import { makeWish } from './zap.js';

import { aggravateMonsters } from './wizard.js';
import { redrawMonsterWormSegments } from './worm.js';
import { adjustMonsterSpeed, monsterSpeedMessage, setMonsterPermanentInvisibility } from './worn.js';
import { polymorphMonsterFromMagic, obj_unpolyable, objectResistsDestruction, poly_obj } from './zap.js';

export interface PotionEffectOptions {
    state?: GameState;
}

export interface PartialPotionEffectResult {
    handled: boolean;
    unknown: number;
    nothing: boolean;
    heroDied: boolean;
}

export interface PotionEffectResult {
    // peffects returns 1 when detection bypasses ordinary discovery.
    result: -1 | 0 | 1;
    unknown: number;
    nothing: boolean;
    heroDied: boolean;
}

// ---- make_confused() through make_deaf() (C potion.c:89-459) ----

interface MentalStatusOptions {
    state?: GameState;
    talk?: boolean;
    publish?: MessagePublisher;
}

interface HallucinationOptions extends MentalStatusOptions {
    resistanceSource?: { object: PropertyObject; slot: WornPropertySlot } | null;
}

// C potion.c:make_confused().
export async function makeConfused(turns: number, {
    state = game, talk = true, publish = plineWithContinuation,
}: MentalStatusOptions = {}) {
    const old = state.u.confusionTurns ?? 0;
    if (!turns && state.u.confusionTurns && talk && !heroIsUnaware(state)) {
        await publish(formatFeltMessage(`less ${heroIsHallucinating(state) ? 'trippy' : 'confused'} now.`, state));
    }
    if (!!turns !== !!old) state.context.botl = true;
    setPropertyTimeout('confusion', turns, state);
}

// C potion.c:make_stunned().
export async function makeStunned(turns: number, {
    state = game, talk = true, publish = plineWithContinuation,
}: MentalStatusOptions = {}) {
    const old = propertyIsActive('stunned', state);
    if (talk && !heroIsUnaware(state)) {
        if (!turns && old) {
            await publish(formatFeltMessage(`${heroIsHallucinating(state) ? 'less wobbly' : 'a bit steadier'} now.`, state));
        } else if (turns && !old) {
            await publish(state.u.usteed ? 'You wobble in the saddle.'
                : `You ${staggerVerb(heroSpecies(state)).replace(/s$/, '')}...`);
        }
    }
    if (!!turns !== old) state.context.botl = true;
    state.u.stunnedTurns = Math.max(0, Math.min(0x00ffffff, Math.trunc(turns)));
    refreshProperty('stunned', state);
}

interface SicknessOptions {
    state?: GameState;
    turns: number;
    cause?: string;
    type?: number;
    talk?: boolean;
    publish?: MessagePublisher;
}

// C potion.c:make_sick().
// The onset line can page before the sickness timeout or cause changes.
export async function startHeroSickness({
    state = game,
    turns,
    cause = 'illness',
    type = SICK_VOMITABLE,
    talk = true,
    publish = plineWithContinuation,
}: SicknessOptions) {
    const hero = state.u;
    if (hero.sicknessResistance) return { started: false, newlySick: false };
    const oldTurns = hero.sickTurns ?? 0;
    const newlySick = !oldTurns;
    if (newlySick) {
        await publish(formatFeltMessage('deathly sick.', state));
    } else if (talk) {
        const severity = turns <= oldTurns / 2 ? 'much' : 'even';
        await publish(formatFeltMessage(`${severity} worse.`, state));
    }
    hero.sickTurns = Math.min(TIMEOUT, Math.max(0, Math.trunc(turns)));
    hero.sick = hero.sickTurns > 0;
    hero.sickType = (hero.sickType ?? 0) | type;
    state.context.botl = true;
    await exerciseAttribute(A_CON, false, state);
    hero.sickCause = cause;
    return { started: hero.sick, newlySick };
}

export function heroIsSick(state = game) {
    return !!state.u?.sick || (state.u?.sickTurns ?? 0) > 0;
}

export function cureHeroSickness(state = game, type = SICK_ALL) {
    const hero = state.u;
    const currentType = hero.sickType ?? 0;
    if (!heroIsSick(state) || !(currentType & type)) return false;

    hero.sickType = currentType & ~type;
    state.context.botl = true;
    if (hero.sickType) {
        hero.sick = true;
        hero.sickTurns = Math.max(1, (hero.sickTurns ?? 1) * 2);
    } else {
        hero.sick = false;
        hero.sickTurns = 0;
        delete hero.sickCause;
    }
    return true;
}

// Native make_sick(0, ..., talk, type): the type mask changes before the
// cure message; the timeout and delayed cause remain until that line returns.
export async function cureHeroSicknessWithMessages(state = game, type = SICK_ALL, publish: MessagePublisher = plineWithContinuation) {
    const hero = state.u;
    const currentType = hero.sickType ?? 0;
    if (!heroIsSick(state) || !(currentType & type)) return false;
    hero.sickType = currentType & ~type;
    await publish(formatFeltMessage(hero.sickType ? 'somewhat better.' : 'cured.  What a relief!', state));
    if (hero.sickType) {
        hero.sickTurns = Math.min(TIMEOUT, (hero.sickTurns ?? 0) * 2);
        state.context.botl = true;
        await exerciseAttribute(A_CON, false, state);
    } else {
        hero.sick = false;
        hero.sickTurns = 0;
        state.context.botl = true;
        delete hero.sickCause;
    }
    return true;
}

// C potion.c:make_slimed(). This directly sets the timeout; the caller
// separately decides whether a body admits infection and records its killer.
export async function setHeroSlimingTimeout(turns: number, {
    state = game, message = null, publish = plineWithContinuation,
}: { state?: GameState; message?: string | null; publish?: MessagePublisher } = {}): Promise<void> {
    requireLiveGame(state);
    if (!Number.isFinite(turns)) throw new RangeError('Sliming timeout must be finite.');
    const requested = Math.trunc(turns);
    const hero = state.u;
    const old = hero.slimedTurns ?? 0;
    hero.slimedTurns = Math.max(0, Math.min(TIMEOUT, requested));
    hero.slimed = hero.slimedTurns > 0;
    if ((requested !== 0) !== (old !== 0)) {
        state.context.botl = true;
        if (message !== null) await publish(message);
    }
    // The fake late-countdown appearance and cause survive the cure message.
    if (!hero.slimedTurns) clearHeroSliming(state);
}
export function heroIsSliming(state: GameState = game): boolean {
    return (state.u?.slimedTurns ?? 0) > 0 || !!state.u?.slimed;
}

// Starting the sliming countdown.
// C end.c:delayed_killer(): the slime death defers its killer string until
// the timeout fires; dropHeroSliming() in timeout.ts deallocates it.
export function startHeroSliming({
    state = game,
    turns = 10,
    killer = '',
}: { state?: GameState; turns?: number; killer?: string } = {}): boolean {
    const hero = state.u;
    if (!heroCanBeSlimed(state)) return false;
    hero.slimedTurns = turns;
    hero.slimed = turns > 0;
    if (hero.slimed) state.context.botl = true;
    hero.slimeKiller = killer;
    return hero.slimed;
}

export function clearHeroSliming(state: GameState = game): boolean {
    const wasSliming = heroIsSliming(state);
    if (wasSliming) state.context.botl = true;
    dropHeroSliming(state.u);
    return wasSliming;
}

export function resetHeroSlimingCountdown(state: GameState = game, turns = 10): boolean {
    if (!heroIsSliming(state)) return false;
    state.u.slimedTurns = turns;
    state.u.slimed = true;
    return true;
}

export function heroIsVomiting(state = game) {
    return !!state.u?.vomiting || (state.u?.vomitingTurns ?? 0) > 0;
}

export function startHeroVomiting({ state = game, turns }: { state?: GameState; turns?: number } = {}) {
    const hero = state.u;
    hero.vomitingTurns = Math.max(0, turns ?? 0);
    hero.vomiting = hero.vomitingTurns > 0;
    state.context.botl = true;
    return hero.vomiting;
}

export function cureHeroVomiting(state = game) {
    const hero = state.u;
    const cured = heroIsVomiting(state);
    hero.vomiting = false;
    hero.vomitingTurns = 0;
    state.context.botl = true;
    return cured;
}

export type PetrificationKillerFormat =
    | typeof KILLED_BY_AN | typeof KILLED_BY | typeof NO_KILLER_PREFIX;

interface PetrificationTimeoutOptions {
    state?: GameState;
    message?: string | null;
    killer?: string | null;
    killerFormat?: PetrificationKillerFormat;
    publish?: MessagePublisher;
}

// C potion.c:make_stoned(). Admission belongs to the attack or command;
// replacing an active timeout must retain its original delayed killer.
export async function setHeroPetrificationTimeout(turns: number, {
    state = game, message = null, killer = null,
    killerFormat = KILLED_BY_AN, publish = plineWithContinuation,
}: PetrificationTimeoutOptions = {}): Promise<void> {
    requireLiveGame(state);
    if (!Number.isFinite(turns)) throw new RangeError('Petrification timeout must be finite.');
    const requested = Math.trunc(turns);
    const hero = state.u;
    const old = hero.stonedTurns ?? 0;
    hero.stonedTurns = Math.max(0, Math.min(TIMEOUT, requested));
    hero.stoned = hero.stonedTurns > 0;
    if ((requested !== 0) !== (old !== 0)) {
        state.context.botl = true;
        if (message !== null) await publish(message);
    }
    // Native killer bookkeeping follows the transition message's input pause.
    if (!hero.stonedTurns) {
        delete hero.stoneKiller;
        delete hero.stoneKillerFormat;
    } else if (!old) {
        hero.stoneKiller = killer ?? '';
        hero.stoneKillerFormat = killerFormat;
    }
}

// C potion.c:make_blinded(). The probe must not change live sight or its caches.
export async function makeBlinded(turns: number, {
    state = game, talk = true, publish = plineWithContinuation,
}: { state?: GameState; talk?: boolean; publish?: MessagePublisher } = {}) {
    requireLiveGame(state);
    const old = state.u.blindTurns ?? 0;
    const couldSee = !heroIsBlind(state);
    const canSee = !heroWouldBeBlindWithTimeout(state, turns ? 1 : 0);
    const speaking = talk && !heroIsUnaware(state);
    const hallucinating = heroIsHallucinating(state);

    if (canSee && !couldSee) {
        if (speaking) await publish(hallucinating
            ? 'Far out!  Everything is all cosmic again!'
            : 'You can see again.');
    } else if (old && !turns && speaking) {
        await publish(maskedBlindnessMessage(true, state));
    }

    if (couldSee && !canSee) {
        if (speaking) await publish(hallucinating
            ? 'Oh, bummer!  Everything is dark!  Help!'
            : 'A cloud of darkness falls upon you.');
        if (state.uball || state.u.uball)
            await setBallAndChainFelt(false, state);
    } else if (!old && turns && speaking) {
        await publish(maskedBlindnessMessage(false, state));
    }

    setHeroBlindnessTurns(turns, state);
    if (couldSee !== canSee) await toggleBlindness(state);
}

function maskedBlindnessMessage(clearing: boolean, state: GameState) {
    const hallucinating = heroIsHallucinating(state);
    if (!heroHasEyes(state) || permanentBlind(state)) {
        return `You have a ${hallucinating ? 'normal' : 'strange'} feeling `
            + 'for a moment, then it passes.';
    }
    if (blindfolded(state)) {
        const eye = heroEyeName(state);
        const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
        return `Your ${eyes} momentarily ${
            verbForSubject(eyes, clearing ? 'itch' : 'twitch')}.`;
    }
    return `Your vision seems to ${clearing ? 'brighten' : 'dim'} `
        + `for a moment but is ${hallucinating
            ? clearing ? 'sadder' : 'happier' : 'normal'} now.`;
}

// C potion.c:toggle_blindness(). Call only after effective sight has changed.
export async function toggleBlindness(state = game) {
    requireLiveGame(state);
    const stinging = wieldedArtifactWarns(state);
    state.context.botl = true;
    state.vision_full_recalc = 1;
    await vision_recalc(0);
    if (propertyIsActive('telepathy', state)
        || propertyIsActive('infravision', state) || stinging) {
        await see_monsters();
    }
    if (stinging) await artifactWarningFeedback(-1);
    if (!heroIsBlind(state)) await learnUnseenInventory(state);
}

// C potion.c:make_hallucinated().
// A resistance source changes EHalluc_resistance, not the intrinsic timeout.
// Native reports a change whenever a nonzero timeout accompanies that mask
// operation, even if another source still masks the effect.
export async function makeHallucinated(turns: number, {
    state = game, talk = true, publish = plineWithContinuation,
    resistanceSource = null,
}: HallucinationOptions = {}) {
    requireLiveGame(state);
    const hero = state.u;
    const old = hero.hallucinationTurns ?? 0;
    const speaking = talk && !heroIsUnaware(state);
    const verb = heroIsBlind(state) ? 'feels' : 'looks';
    let changed;
    if (resistanceSource) {
        changed = !!old;
        const { object, slot } = resistanceSource;
        if (turns)
            removeWornProperty('hallucinationResistance', object, slot, state);
        else
            grantWornProperty('hallucinationResistance', object, slot, state);
    } else {
        const extrinsic = hasWornProperty('hallucinationResistance', state)
            || hasCarriedProperty('hallucinationResistance', null, state)
            || hasInvokedProperty('hallucinationResistance', state);
        changed = !extrinsic && (!!old !== !!turns);
        hero.hallucinationTurns = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
        if (!changed && !hero.hallucinationTurns && old && speaking) {
            if (!heroHasEyes(state)) {
                const feeling = heroIsHallucinating(state) ? 'normal' : 'strange';
                await publish(`You have a ${feeling} feeling for a moment, then it passes.`);
            } else if (heroIsBlind(state)) {
                const eye = heroEyeName(state);
                const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
                await publish(`Your ${eyes} momentarily ${verbForSubject(eyes, 'itch')}.`);
            } else {
                await publish('Your vision seems to flatten for a moment but is normal now.');
            }
        }
    }
    if (changed) {
        if (!heroIsHallucinating(state)) await updateMealMimicry(state);
        if (hero.uswallow) await swallowed(false);
        else {
            await see_monsters();
            await see_objects();
            await see_traps();
        }
        // The pinned TTY port has no persistent inventory window to refresh.
        state.context.botl = true;
        if (speaking) await publish(turns
            ? `Oh wow!  Everything ${verb} so cosmic!`
            : `Everything ${verb} SO boring now.`);
    }
    return changed;
}

// Native potion.c:make_deaf(). Commit the timeout before publishing its change.
export async function makeDeaf(turns: number, {
    state = game, talk = true, publish = plineWithContinuation,
}: { state?: GameState; talk?: boolean; publish?: MessagePublisher } = {}) {
    requireLiveGame(state);
    const old = state.u.deafTurns || 0;
    state.u.deafTurns = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
    syncDeafness(state);
    if (!!old !== !!state.u.deafTurns) {
        state.context.botl = true;
        if (talk && !heroIsUnaware(state))
            await publish(old && !heroIsDeaf(state)
                ? 'You can hear again.' : 'You are unable to hear anything.');
    }
}

// ---- ghost_from_bottle() and the dopotion() occupant check (C potion.c:481, 617-644) ----

const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_DJINNI = MONSTER_NAME.indexOf('djinni');

// C potion.c:ghost_from_bottle().
async function releaseGhost(state: PlayingGameState) {
    const monster = await makemonNear(PM_GHOST, state.u.ux, state.u.uy, MM_NOMSG);
    if (!monster) {
        await pline('This bottle turns out to be empty.');
        return;
    }
    if (heroIsBlind(state)) {
        await pline('As you open the bottle, something emerges.');
        return;
    }
    const name = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'ghost';
    await pline(`As you open the bottle, an enormous ${name} emerges!`);
    if (state.flags.verbose) await pline('You are frightened to death, and unable to move.');
    nomul(-3, state);
    state._helplessReason = 'being frightened to death';
    state._helplessDoneMessage = 'You regain your composure.';
}

export async function releasePotionOccupant(source: GameObject, { state = game }: PotionEffectOptions = {}): Promise<{ released: boolean; heroDied: boolean }> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const appearance = state.objectDescriptions?.[source.otyp]
        ?? OBJECT_DESCRIPTIONS[source.otyp];
    const species = appearance === 'milky' ? PM_GHOST
        : appearance === 'smoky' ? PM_DJINNI : null;
    if (species === null || ((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
        || rn2(13 + 2 * (state.mvitals?.[species]?.born ?? 0)))
        return { released: false, heroDied: false };

    if (species === PM_GHOST) await releaseGhost(state);
    else await releaseDjinni(source, state);
    return { released: true, heroDied: !!state.program_state?.gameover };
}

// ---- drink_ok()/dodrink()/dopotion() (C potion.c:505-645) ----

export interface QuaffResult {
    spentTime: boolean;
    heroDied: boolean;
    object: GameObject | null;
    cancelled: boolean;
}

// C potion.c:drink_ok().
// C potion.c:dodrink().
export async function quaff({ state = game }: PotionEffectOptions = {}): Promise<QuaffResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (heroIsStrangled(state)) {
        await pline("If you can't breathe air, how can you drink liquid?");
        return outcome(false, state);
    }
    const hero = state.u;
    const location = state.level.at(hero.ux, hero.uy);
    if (!location) throw new Error('Drinking requires the hero to stand on the map.');
    let declinedSource = false;
    if (!state.iflags.menu_requested) {
        if (heroCanReachFloor(state) && [FOUNTAIN, SINK].includes(location.typ)) {
            const fountain = location.typ === FOUNTAIN;
            if (await promptYesNo(`Drink from the ${fountain ? 'fountain' : 'sink'}?`, 'n') === 'y') {
                if (fountain) await drinkFountain(location);
                else await drinkSink({ state });
                return outcome(true, state);
            }
            declinedSource = true;
        }
        if ((hero.uinwater || state.underwater) && !hero.uswallow) {
            if (await promptYesNo('Drink the water around you?', 'n') === 'y') {
                await pline('Do you know what lives in this water?');
                return outcome(true, state);
            }
            declinedSource = true;
        }
    }
    // drink_ok() reports a declined floor source as GETOBJ_EXCLUDE_NONINVENT.
    let source = await chooseInventoryObject('drink', object =>
        object.oclass === 8 ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE,
    { hands: declinedSource ? GETOBJ_EXCLUDE_NONINVENT : GETOBJ_EXCLUDE });
    if (!source) return { ...outcome(false, state), cancelled: true };
    if (source.owornmask) {
        if (objectQuantity(source) > 1) {
            const original = source;
            source = splitObjectStack(original, 1, state);
            if (!source) throw new Error('The selected potion stack could not release one bottle.');
        } else await removeWornHeroItem(source, state);
    }
    source.in_use = true;
    const occupant = await releasePotionOccupant(source, { state });
    if (occupant.released) {
        if (!occupant.heroDied) await consumePotion(source, state);
        return outcome(true, state, source);
    }
    return drinkPotion(source, { state });
}

// C potion.c:dopotion(). Effects are shared with spells and digestion.
// consume:false is native eatspecial's extra useup boundary: digestion owns
// its final carried/floor consumption, while dopotion still owns discovery.
export async function drinkPotion(source: GameObject, { state = game, consume = true }: PotionEffectOptions & { consume?: boolean } = {}): Promise<QuaffResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    source.in_use = true;
    const effect = await applyPotionEffect(source, { state });
    if (effect.heroDied) return outcome(true, state, source);
    if (effect.result > 0) {
        // Detection's strange_feeling() bypasses dopotion discovery.
        if (source.dknown) await tryCallObjectType(source, state);
    } else {
        let unknown = effect.unknown;
        if (effect.nothing) {
            unknown++;
            await pline(`You have a ${heroIsHallucinating(state) ? 'normal' : 'peculiar'} feeling for a moment, then it passes.`);
        }
        if (source.dknown && !OBJECT_INITIAL_KNOWN[source.otyp]
            && !state._knownObjectTypes?.has(source.otyp)) {
            if (unknown) await tryCallObjectType(source, state);
            else {
                learnObjectType(source.otyp, state);
                addExperience(0, 10, state);
            }
        }
    }
    if (consume) await consumePotion(source, state);
    else source.in_use = false;
    return outcome(effect.result !== 0, state, source);
}

async function consumePotion(source: GameObject, state: GameState) {
    if (source.where === 'inventory' || state.inventory.includes(source))
        await consumeInventoryItem(source, state);
    else await useUpFloorObject(source, 1, { state });
}

function outcome(spentTime: boolean, state: GameState, object: GameObject | null = null): QuaffResult {
    return { spentTime, heroDied: !!state.program_state.gameover, object, cancelled: false };
}

// ---- peffect_* helpers (C potion.c:646-1332) ----

// C potion.c:peffect_restore_ability(). This restores the base directly,
// bypassing fixed abilities while preserving temporary penalties and exercise.
export function restoreHeroBaseAttributes({ all = false, state = game }: { all?: boolean; state?: GameState } = {}): void {
    requirePlayingGame(state);
    const hero = state.u;
    const start = rn2(A_MAX);
    for (let offset = 0; offset < A_MAX; offset++) {
        const attribute = (start + offset) % A_MAX;
        requireAttributeIndex(attribute);
        if (hero.acurr.a[attribute] >= hero.amax.a[attribute]) continue;
        hero.acurr.a[attribute] = hero.amax.a[attribute];
        state.context.botl = true;
        if (hero._exercise && hero._exercise[attribute] < 0) hero._exercise[attribute] = 0;
        if (!all) break;
    }
}

async function restoreAbility(source: GameObject, state: PlayingGameState) {
    if (source.cursed) {
        await pline('Ulch!  This makes you feel mediocre!');
        return;
    }
    const feeling = !source.blessed ? 'good' : restorationLeavesTrouble(state) ? 'better' : 'great';
    await pline(`Wow!  This makes you feel ${feeling}!`);
    restoreHeroBaseAttributes({ all: !!source.blessed, state });
    if (source.otyp === POT_RESTORE_ABILITY) {
        while (state.u.ulevel < state.u.ulevelmax) {
            await gainExperienceLevel({ state });
            if (!source.blessed) break;
        }
    }
}

// C apply.c:unfixable_trouble_count(FALSE). Restoration does not treat these
// ailments or temporary attribute penalties; they only change its feedback.
function restorationLeavesTrouble(state: PlayingGameState) {
    const hero = state.u;
    return heroIsPetrifying(state) || heroIsSliming(state) || heroIsStrangled(state)
        || hero.atemp.a[A_DEX] < 0 && (hero._woundedLegTurns ?? 0) > 0
        || hero.atemp.a[A_STR] < 0 && hero.uhs >= WEAK
        || heroIsSick(state) || propertyIsActive('stunned', state)
        || (hero.confusionTurns ?? 0) > 0 || heroIsHallucinating(state)
        || heroIsVomiting(state) || heroIsDeaf(state);
}

// C potion.c:peffect_hallucination().
async function hallucinationEffect(source: GameObject, state: PlayingGameState) {
    if (state.u.hallucinationResistance
        || propertyIsActive('hallucinationResistance', state)) return true;
    const nothing = heroIsHallucinating(state);
    await makeHallucinated((state.u.hallucinationTurns || 0)
        + rn1(200, 600 - 300 * blessing(source)), { state });
    if (source.blessed && !rn2(3) || !source.cursed && !rn2(6)) {
        await pline('You perceive yourself...');
        await flushPendingTopline();
        await showEnlightenment({ basic: false, magic: true });
        await pline('Your awareness re-normalizes.');
        await exerciseAttribute(A_WIS, true, state);
    }
    return nothing;
}

function halfPhysical(amount: number, state: GameState) {
    return state.u.halfPhysicalDamage
        ? Math.ceil(amount / 2) : amount;
}

async function drinkWater(source: GameObject, state: PlayingGameState) {
    const hero = state.u;
    if (!source.blessed && !source.cursed) {
        await plineWithContinuation(`This tastes like ${displayLiquidName('water', state)}.`);
        hero.uhunger += rnd(10);
        await updateHeroHunger(false, { state });
        return !!state.program_state.gameover;
    }
    const hostileBody = monsterHatesBlessings({
        mnum: hero.umonnum,
        ...(hero.mcham === undefined ? {} : { cham: hero.mcham }),
    });
    if (hostileBody || hero.ualign.type === -1) {
        if (source.blessed) {
            await plineWithContinuation(`This burns like ${displayLiquidName('acid', state)}!`);
            await exerciseAttribute(A_CON, false, state);
            if (hero.ulycn >= 0) {
                const wereName = MONSTER_NAME[hero.ulycn];
                if (wereName === undefined) throw new Error(`Unknown lycanthrope species ${hero.ulycn}`);
                await plineWithContinuation(`Your affinity to ${makePlural(wereName)} disappears!`);
                if (hero.umonnum === hero.ulycn)
                    await revertHeroWereForm({ state });
                if (state.program_state.gameover) return true;
                setHeroLycanthropy(-1, state);
            }
            return loseHeroHp(halfPhysical(d(2, 6), state), 'potion of holy water', { state });
        }
        await plineWithContinuation(formatFeltMessage('quite proud of yourself.', state));
        await healHero(d(2, 6), 0, { state });
        if (hero.ulycn >= 0 && !heroIsPolymorphed(state))
            await applyHeroWereChange({ state });
        if (state.program_state.gameover) return true;
        await exerciseAttribute(A_CON, true, state);
        return !!state.program_state.gameover;
    }
    if (source.blessed) {
        await plineWithContinuation(formatFeltMessage('full of awe.', state));
        await cureHeroSicknessWithMessages(state);
        await exerciseAttribute(A_WIS, true, state);
        await exerciseAttribute(A_CON, true, state);
        if (hero.ulycn >= 0) await purifyHeroLycanthropy({ state });
    } else {
        if (hero.ualign.type === 1) {
            await plineWithContinuation(`This burns like ${displayLiquidName('acid', state)}!`);
            if (await loseHeroHp(halfPhysical(d(2, 6), state), 'potion of unholy water', { state })) return true;
        } else await plineWithContinuation(formatFeltMessage('full of dread.', state));
        if (hero.ulycn >= 0 && !heroIsPolymorphed(state))
            await applyHeroWereChange({ state });
        if (state.program_state.gameover) return true;
        await exerciseAttribute(A_CON, false, state);
    }
    return !!state.program_state.gameover;
}

function blessing(source: GameObject) {
    return source.blessed ? 1 : source.cursed ? -1 : 0;
}

// C potion.c:peffect_booze().
async function boozeEffect(source: GameObject, state: PlayingGameState) {
    const dilution = source.odiluted ? 'watered down ' : '';
    const taste = heroIsHallucinating(state) ? 'dandelion wine' : 'liquid fire';
    await pline(`Ooph!  This tastes like ${dilution}${taste}!`);
    if (!source.blessed) {
        await makeConfused((state.u.confusionTurns || 0)
            + d(2 + (state.u.uhs || 0), 8), { state, talk: false });
    }
    if (!source.odiluted) await healHero(1, 0, { state });
    // peffect_booze adds nutrition directly; it does not call lesshungry's
    // fullness/choking checks, even when drunk on a full stomach.
    state.u.uhunger = (state.u.uhunger ?? 900) + 10 * (2 + blessing(source));
    await updateHeroHunger(false, { state });
    await exerciseAttribute(A_WIS, false, state);
    if (source.cursed) {
        await pline('You pass out.');
        setMulti(-rnd(15), state);
        state._helplessDoneMessage = 'You awake with a headache.';
    }
}

// C potion.c:peffect_see_invisible().
async function seeInvisible(source: GameObject, state: PlayingGameState) {
    // C msg = Invisible && !Blind; Invisible is Invis && !See_invisible
    // (youprop.h), so an invisible hero who already sees invisible is
    // not told they can see through themselves.
    const wasInvisible = heroIsInvisible(state) && !propertyIsActive('seeInvisible', state)
        && !heroIsBlind(state);
    const permanenceChance = 10 - (hasInternalInvisibility(state) ? 3 : 0)
        - (hasIntrinsicProperty('seeInvisible', null, state) || (state.u.seeInvisibleTurns ?? 0) > 0 ? 6 : 0);
    const fruit = fruitName(true, state);
    const diluted = source.odiluted;
    await pline(source.cursed ? `Yecch!  This tastes ${heroIsHallucinating(state) ? 'overripe' : 'rotten'}.`
        : heroIsHallucinating(state) ? `This tastes like 10% real ${diluted ? 'reconstituted ' : ''}${fruit} all-natural beverage.`
        : `This tastes like ${diluted ? 'reconstituted ' : ''}${fruit}.`);
    if (source.otyp === POT_FRUIT_JUICE) {
        state.u.uhunger += (diluted ? 5 : 10) * (2 + (source.blessed ? 1 : source.cursed ? -1 : 0));
        await updateHeroHunger(false, { state });
        return 1;
    }
    if (!source.cursed) await makeBlinded(0, { state });
    const permanent = !!source.blessed && !rn2(permanenceChance);
    await grantHeroSeeInvisible({ permanent, duration: permanent ? 0 : rn1(100, 750), state });
    if (wasInvisible && !heroIsBlind(state)) {
        await pline('You can see through yourself, but you are visible!');
        return 0;
    }
    return 1;
}

// C potion.c:self_invis_message().
export async function showInvisibilityMessage(state = game) {
    const hallucinating = heroIsHallucinating(state);
    const seesInvisible = !!(state.u?.seeInvisible
        || (state.u?.seeInvisibleTurns ?? 0) > 0);
    const lead = hallucinating
        ? 'Far out, man!  You' : 'Gee!  All of a sudden, you';
    const effect = seesInvisible
        ? 'can see right through yourself' : "can't see yourself";
    await pline(`${lead} ${effect}.`);
}

// C potion.c:peffect_invisibility(), shared with SPE_INVISIBILITY through
// peffects() (C potion.c:1352-1354).
export async function applyPotionLikeInvisibility({
    state = game,
    blessed = false,
    cursed = false,
    spell = false,
    random = rn2,
    rollDice = d,
} = {}) {
    const cloak = state.uarmc || state.u.uarmc;
    if (spell && invisibilityIsBlocked(state) && cloak?.otyp === MUMMY_WRAPPING) {
        await pline(formatFeltMessage(`rather itchy under ${ownedObjectName(cloak, state, { capitalized: false })}.`, state));
        return {
            blocked: true,
            showedInvisibility: false,
            aggravates: false,
        };
    }

    const wasInvisible = heroIsInvisible(state);
    const showedInvisibility = !wasInvisible && !heroIsBlind(state)
        && !invisibilityIsBlocked(state);
    if (showedInvisibility) await showInvisibilityMessage(state);

    const blessing = blessed ? 1 : cursed ? -1 : 0;
    let duration = 0;
    let permanent = false;
    if (blessed && random(hasInternalInvisibility(state) ? 15 : 30) === 0) {
        grantIntrinsicProperty('invisible', 'outside', state);
        permanent = true;
    } else {
        duration = rollDice(6 - 3 * blessing, 100) + 100;
        state.u.invisibleTurns = Math.min(
            TIMEOUT,
            (state.u.invisibleTurns ?? 0) + duration,
        );
    }

    syncHeroInvisibility(state);
    // The hero's square is redrawn before the cursed message can page.
    await newsym(state.u.ux, state.u.uy);

    let aggravates = false;
    if (cursed) {
        await pline('For some reason, you feel your presence is known.');
        revokeIntrinsicProperty('invisible', 'outside', state);
        syncHeroInvisibility(state);
        aggravates = true;
    }
    return {
        blocked: false,
        showedInvisibility,
        aggravates,
        duration,
        permanent,
    };
}

// C potion.c:peffect_paralysis().
async function paralysisEffect(source: GameObject, state: PlayingGameState) {
    if (heroHasFreeAction(state)) {
        await pline('You stiffen momentarily.');
        return;
    }
    if (propertyIsActive('levitation', state) || Is_airlevel(state.u.uz)
        || Is_waterlevel(state.u.uz)) {
        await pline('You are motionlessly suspended.');
    } else if (state.u.usteed) {
        await pline('You are frozen in place!');
    } else {
        await pline(`Your ${makePlural(heroFootName(state))} are frozen to the ${
            surfaceName(state.u.ux, state.u.uy, state)}!`);
    }
    const turns = rn1(10, 25 - 12 * blessing(source));
    nomul(-turns, state);
    state._helplessReason = 'frozen by a potion';
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
}

// C potion.c:peffect_sleeping().
async function sleepingEffect(source: GameObject, state: PlayingGameState) {
    if (state.u.sleepResistance
        || propertyIsActive('sleepResistance', state) || heroHasFreeAction(state)) {
        monstersObserveHeroResistance(M_SEEN_SLEEP, state);
        await pline('You yawn.');
    } else {
        await pline('You suddenly fall asleep!');
        monstersForgetHeroResistance(M_SEEN_SLEEP, state);
        await putHeroToSleep(rn1(10, 25 - 12 * blessing(source)), { state });
    }
}

// C potion.c:peffect_monster_detection().
async function monsterDetection(source: GameObject, state: PlayingGameState) {
    let unknown = 0, nothing = false;
    if (source.blessed) {
        const hero = state.u;
        nothing = heroDetectsMonsters(state);
        unknown++;
        const timeout = hero.monsterDetectionTurns || 0;
        hero.monsterDetectionTurns = Math.min(TIMEOUT,
            timeout + (timeout >= 300 ? 1 : source.oclass === 10 ? rn1(40, 21) : rn2(100) + 100));
        let found = false;
        for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++) {
            await unmap_invisible(x, y);
            if (monsterAtPosition(state.level, x, y)) found = true;
        }
        if (found) unknown = 0;
        if (!hero.uswallow && !hero.uinwater && !state.underwater) {
            await see_monsters();
            if (!found) await pline(formatFeltMessage('lonely.', state));
            return { result: 0, unknown, nothing };
        }
    }
    const detection = await detectMonsters(source, { state });
    if (!detection.result) await exerciseAttribute(A_WIS, true, state);
    return { result: detection.result, unknown, nothing };
}

// C potion.c:peffect_sickness().
async function drinkSickness(source: GameObject, state: PlayingGameState) {
    const hero = state.u;
    await plineWithContinuation('Yecch!  This stuff tastes like poison.');
    const healer = state.urole.key === 'healer';
    if (source.blessed) {
        await plineWithContinuation(`(But in fact it was mildly stale ${fruitName(true, state)}.)`);
        if (!healer && await loseHeroHp(1, 'mildly contaminated potion', { state })) return true;
    } else {
        const resisted = propertyIsActive('poisonResistance', state);
        if (resisted)
            await plineWithContinuation(`(But in fact it was biologically contaminated ${fruitName(true, state)}.)`);
        if (healer) await plineWithContinuation('Fortunately, you have been immunized.');
        else {
            const attribute = rn2(A_MAX);
            const contaminant = `${resisted ? 'mildly ' : ''}contaminated ${source.fromsink ? 'tap water' : 'potion'}`;
            if (!hero.fixedAbilities && !propertyIsActive('sustainAbility', state)) {
                await plineWithContinuation(poisonAttributeMessage(attribute, state, false));
                const change = adjustAttribute(attribute, resisted ? -1 : -rn1(4, 3), state);
                if (change.changed && state._moveloopStarted
                    && (attribute === A_STR || attribute === A_CON))
                    await reportHeroEncumbrance(state);
            }
            const damage = resisted ? 1 + rn2(2) : rnd(10) + 5 * Number(!!source.cursed);
            if (await loseHeroHp(damage, contaminant, {
                state,
                deathCause: source.fromsink ? `killed by ${contaminant}` : null,
            })) return true;
            await exerciseAttribute(A_CON, false, state);
        }
    }
    if (heroIsHallucinating(state)) {
        await plineWithContinuation('You are shocked back to your senses!');
        await makeHallucinated(0, { state, talk: false });
    }
    return !!state.program_state.gameover;
}

// msgflg -1 suppresses failed attempts but still reports successful changes.
async function increaseAttribute(attribute: number, reportFailure: boolean, state: PlayingGameState) {
    const change = adjustAttribute(attribute, 1, state);
    if (change.changed || reportFailure
        && (change.blockedByDunceCap || state.flags.verbose)) {
        const message = attributeChangeMessage(attribute, change, state);
        if (message) await pline(message);
    }
    if (change.changed && state._moveloopStarted
        && (attribute === A_STR || attribute === A_CON)) {
        await reportHeroEncumbrance(state);
    }
    return change;
}

async function drinkGainLevel(source: GameObject, state: PlayingGameState) {
    if (!source.cursed) {
        await gainExperienceLevel({ state });
        if (source.blessed) state.u.uexp = randomExperience({ gaining: true, state });
        return;
    }
    const hero = state.u;
    const firstLevel = ledgerNo(hero.uz) === 1;
    if (!(firstLevel ? hero.uhave.amulet : canHeroRiseUp(hero.ux, hero.uy, { state }))) {
        await plineWithContinuation('You have an uneasy feeling.');
        return;
    }
    const destination = firstLevel ? state.earth_level : levelAtDepth(depth(hero.uz) - 1, { state });
    if (!destination) throw new Error('Gain-level potion requires its destination level.');
    if (destination.dnum === hero.uz.dnum && destination.dlevel === hero.uz.dlevel) {
        await plineWithContinuation('It tasted bad.');
        return;
    }
    await plineWithContinuation(`You rise up, through the ${ceilingName(hero.ux, hero.uy, state)}!`);
    await gotoLevel(destination);
}

// C potion.c:peffect_oil().
async function drinkOil(source: GameObject, state: PlayingGameState) {
    let good = false;
    if (source.lamplit) {
        if (heroIsFlaming(state)) {
            await plineWithContinuation('Ahh, a refreshing drink.');
            good = true;
        } else {
            await plineWithContinuation(`You burn your ${heroFaceName(state)}.`);
            const vulnerable = !propertyIsActive('fireResistance', state)
                || propertyIsActive('coldResistance', state);
            const killer = 'quaffing a burning potion of oil';
            if (await loseHeroHp(d(vulnerable ? 4 : 2, 4), killer, {
                state, deathCause: `killed by ${killer}`,
            })) return true;
        }
        await burnAwayHeroSlime({ state });
    } else await plineWithContinuation(source.cursed ? 'This tastes like castor oil.' : 'That was smooth!');
    await exerciseAttribute(A_WIS, good, state);
    return !!state.program_state.gameover;
}

async function drinkAcid(source: GameObject, state: PlayingGameState) {
    if (propertyIsActive('acidResistance', state))
        await plineWithContinuation(`This tastes ${heroIsHallucinating(state) ? 'tangy' : 'sour'}.`);
    else {
        await plineWithContinuation(`This burns${source.blessed ? ' a little' : source.cursed ? ' a lot' : ' like acid'}!`);
        const damage = halfPhysical(d(source.cursed ? 2 : 1, source.blessed ? 4 : 8), state);
        if (await loseHeroHp(damage, 'potion of acid', { state })) return true;
        await exerciseAttribute(A_CON, false, state);
    }
    await fixHeroPetrification({ state });
    return !!state.program_state.gameover;
}

// C potion.c:peffect_polymorph().
async function drinkPolymorph(source: GameObject, state: PlayingGameState) {
    await plineWithContinuation(formatFeltMessage(`a little ${heroIsHallucinating(state) ? 'normal' : 'strange'}.`, state));
    if (heroIsUnchanging(state)) return false;
    const controlled = source.blessed && !heroIsPolymorphed(state);
    const result = await polymorphHero(controlled ? POLY_CONTROLLED | POLY_LOW_CTRL : POLY_NOFLAGS);
    // C min() is the hack.h macro ((x) < (y) ? (x) : (y)), so rn2(15) + 10
    // is evaluated a second time when it is not smaller than mtimedone.
    if (controlled && state.u.mtimedone && heroIsPolymorphed(state))
        state.u.mtimedone = state.u.mtimedone < rn2(15) + 10
            ? state.u.mtimedone : rn2(15) + 10;
    return !!result?.died || !!state.program_state.gameover;
}

// ---- peffects() (C potion.c:1333) ----

// C potion.c:peffect_water().
// C potion.c:peffect_acid().
// C potion.c:peffect_gain_level().
export async function applyPotionBodyEffect(source: GameObject, { state = game }: PotionEffectOptions = {}): Promise<PartialPotionEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let unknown = 0;
    let heroDied = false;
    switch (source.otyp) {
    case POT_WATER:
        unknown = Number(!!(source.blessed || source.cursed));
        heroDied = await drinkWater(source, state);
        break;
    case POT_SICKNESS:
        heroDied = await drinkSickness(source, state);
        break;
    case POT_OIL:
        heroDied = await drinkOil(source, state);
        break;
    case POT_ACID:
        unknown = 1;
        heroDied = await drinkAcid(source, state);
        break;
    case POT_POLYMORPH:
        heroDied = await drinkPolymorph(source, state);
        break;
    case POT_GAIN_LEVEL:
        unknown = Number(!!source.cursed);
        await drinkGainLevel(source, state);
        heroDied = !!state.program_state.gameover;
        break;
    default:
        return { handled: false, unknown: 0, nothing: false, heroDied: false };
    }
    return { handled: true, unknown, nothing: false, heroDied };
}

// C potion.c:peffect_enlightenment().
// C potion.c:peffect_confusion().
// C potion.c:peffect_gain_ability().
// C potion.c:peffect_blindness().
export async function applyPotionMentalEffect(source: GameObject, { state = game }: PotionEffectOptions = {}): Promise<PartialPotionEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let unknown = 0;
    let nothing = false;
    switch (source.otyp) {
    case POT_HALLUCINATION:
        nothing = await hallucinationEffect(source, state);
        break;
    case POT_BOOZE:
        unknown = 1;
        await boozeEffect(source, state);
        break;
    case POT_ENLIGHTENMENT:
        if (source.cursed) {
            unknown = 1;
            await pline('You have an uneasy feeling...');
            await exerciseAttribute(A_WIS, false, state);
        } else {
            if (source.blessed) {
                await increaseAttribute(A_INT, true, state);
                await increaseAttribute(A_WIS, true, state);
            }
            await doEnlightenmentEffect();
        }
        break;
    case POT_PARALYSIS:
        await paralysisEffect(source, state);
        break;
    case POT_SLEEPING:
        await sleepingEffect(source, state);
        break;
    case POT_CONFUSION:
        if ((state.u.confusionTurns ?? 0) > 0) {
            nothing = true;
        } else if (heroIsHallucinating(state)) {
            await pline('What a trippy feeling!');
            unknown = 1;
        } else {
            await pline('Huh, What?  Where am I?');
        }
        await makeConfused((state.u.confusionTurns || 0)
            + rn1(7, 16 - 8 * blessing(source)), { state, talk: false });
        break;
    case POT_GAIN_ABILITY:
        if (source.cursed) {
            await pline('Ulch!  That potion tasted foul!');
            unknown = 1;
        } else if (state.u.fixedAbilities
            || propertyIsActive('sustainAbility', state)) {
            nothing = true;
        } else {
            for (let attempt = 0; attempt < A_MAX; attempt++) {
                const attribute = source.blessed ? attempt : rn2(A_MAX);
                const change = await increaseAttribute(attribute,
                    !!source.blessed || attempt === A_MAX - 1, state);
                if (change.changed && !source.blessed) break;
            }
        }
        break;
    case POT_BLINDNESS: {
        const blind = heroIsBlind(state);
        nothing = blind || blindnessBlocked(state)
            && (!!state.u.permaBlind || !!state.u.blindTurns || hasIntrinsicProperty('blinded', null, state)
                || hasWornProperty('blinded', state));
        await makeBlinded((state.u.blindTurns || 0)
            + rn1(200, 250 - 125 * blessing(source)), { state, talk: !blind });
        break;
    }
    default:
        return { handled: false, unknown: 0, nothing: false, heroDied: false };
    }
    return { handled: true, unknown, nothing, heroDied: !!state.program_state.gameover };
}

// C potion.c:peffect_speed().
// C potion.c:peffect_invisibility().
// C potion.c:peffect_object_detection().
// C potion.c:peffect_healing().
// C potion.c:peffect_extra_healing().
// C potion.c:peffect_full_healing().
// C potion.c:peffect_gain_energy().
export async function applyPotionEffect(source: GameObject, { state = game }: PotionEffectOptions = {}): Promise<PotionEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let result: -1 | 0 | 1 = -1;
    let unknown = 0, nothing = false;
    const blessing = source.blessed ? 1 : source.cursed ? -1 : 0;
    switch (source.otyp) {
    case POT_RESTORE_ABILITY:
    case SPE_RESTORE_ABILITY:
        unknown++;
        await restoreAbility(source, state);
        break;
    case POT_FRUIT_JUICE:
    case POT_SEE_INVISIBLE:
        unknown = await seeInvisible(source, state);
        break;
    case POT_SPEED:
    case SPE_HASTE_SELF:
        if (source.otyp === POT_SPEED && (state.u._woundedLegTurns ?? 0) > 0
            && !source.cursed && !state.u.usteed) {
            await healHeroLegs(state);
            unknown++;
        } else {
            await speedUpHero(rn1(10, 100 + 60 * blessing), state);
            if (source.otyp === POT_SPEED && !source.cursed
                && !hasPermanentIntrinsicProperty('fast', state)) {
                await pline('Your quickness feels very natural.');
                grantIntrinsicProperty('fast', 'outside', state);
            }
        }
        break;
    case POT_MONSTER_DETECTION:
    case SPE_DETECT_MONSTERS: {
        const effect = await monsterDetection(source, state);
        ({ unknown, nothing } = effect);
        if (effect.result) result = 1;
        break;
    }
    case POT_OBJECT_DETECTION:
    case SPE_DETECT_TREASURE: {
        const detected = await detectObjects(source, { state });
        if (detected.result) result = 1;
        else await exerciseAttribute(A_WIS, true, state);
        break;
    }
    case POT_INVISIBILITY:
    case SPE_INVISIBILITY: {
        const effect = await applyPotionLikeInvisibility({ state,
            spell: source.otyp === SPE_INVISIBILITY,
            blessed: !!source.blessed, cursed: !!source.cursed });
        nothing = !effect.showedInvisibility && !effect.blocked;
        if (effect.aggravates) aggravateMonsters(state);
        break;
    }
    case POT_LEVITATION:
    case SPE_LEVITATION: {
        const effect = await applyLevitationPotion(source, { state });
        nothing = effect.nothingHappened;
        break;
    }
    case POT_HEALING:
        await pline(formatFeltMessage('better.', state));
        await healHero(8 + d(4 + 2 * blessing, 4), source.cursed ? 0 : 1,
            { state, cureSickness: !!source.blessed, cureBlindness: !source.cursed });
        await exerciseAttribute(A_CON, true, state);
        break;
    case POT_EXTRA_HEALING:
        await pline(formatFeltMessage('much better.', state));
        await healHero(16 + d(4 + 2 * blessing, 8), source.blessed ? 5 : source.cursed ? 0 : 2,
            { state, cureSickness: !source.cursed, cureBlindness: true });
        await makeHallucinated(0, { state });
        await exerciseAttribute(A_CON, true, state);
        await exerciseAttribute(A_STR, true, state);
        if (source.blessed && !state.u.usteed) await healHeroLegs(state);
        break;
    case POT_FULL_HEALING:
        await pline(formatFeltMessage('completely healed.', state));
        await healHero(400, 4 + 4 * blessing,
            { state, cureSickness: !source.cursed, cureBlindness: true });
        if (source.blessed && state.u.ulevel < state.u.ulevelmax) {
            state.u.ulevelmax--;
            await gainExperienceLevel({ state });
        }
        await makeHallucinated(0, { state });
        await exerciseAttribute(A_STR, true, state);
        await exerciseAttribute(A_CON, true, state);
        if (source.blessed || (!source.cursed && !state.u.usteed)) await healHeroLegs(state);
        break;
    case POT_GAIN_ENERGY: {
        await pline(source.cursed ? formatFeltMessage('lackluster.', state) : 'Magical energies course through your body.');
        const amount = d(source.blessed ? 3 : source.cursed ? 1 : 2, 6) * (source.cursed ? -1 : 1);
        state.u.uenmax = Math.max(0, (state.u.uenmax || 0) + amount);
        state.u.uenpeak = Math.max(state.u.uenpeak || 0, state.u.uenmax);
        state.u.uen = Math.max(0, Math.min(state.u.uenmax, (state.u.uen || 0) + 3 * amount));
        state.context.botl = true;
        await exerciseAttribute(A_WIS, true, state);
        break;
    }
    default: {
        let effect = await applyPotionBodyEffect(source, { state });
        if (!effect.handled) effect = await applyPotionMentalEffect(source, { state });
        if (!effect.handled) throw new Error(`Unsupported potion effect ${source.otyp}`);
        unknown = effect.unknown || 0;
        nothing = !!effect.nothing;
    }
    }
    return { result, unknown, nothing, heroDied: !!state.program_state.gameover };
}

// ---- healup() (C potion.c:1428) ----
//
// ---- peffect_levitation() (C potion.c:1165-1223) ----

// C potion.c:healup(). Healing applies to the body currently occupied.
export async function healHero(amount: number, extraMaximum: number, {
    state = game, cureSickness = false, cureBlindness = false,
}: { state?: GameState; cureSickness?: boolean; cureBlindness?: boolean } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    if (amount) {
        const hp = polymorphed ? 'mh' : 'uhp';
        const maximum = polymorphed ? 'mhmax' : 'uhpmax';
        hero[hp] += amount;
        if (hero[hp] > hero[maximum]) {
            hero[maximum] += extraMaximum;
            hero[hp] = hero[maximum];
            if (!polymorphed) hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
        }
    }
    if (cureBlindness) {
        hero.ucreamed = 0;
        await makeBlinded(0, { state });
        await makeDeaf(0, { state });
    }
    if (cureSickness) {
        if (cureHeroVomiting(state) && !heroIsUnaware(state))
            await plineWithContinuation(formatFeltMessage('much less nauseated now.', state));
        await cureHeroSicknessWithMessages(state);
    }
    state.context.botl = true;
}

// C potion.c:itimeout()/itimeout_incr(): the timeout caps at TIMEOUT.
function increaseLevitationTimeout(hero: Hero, amount: number): void {
    const current = hero.levitationTurns ?? 0;
    hero.levitationTurns = Math.min(TIMEOUT, current + amount);
}

function upStairwayAt(x: number, y: number, state: GameState): Stairway | null {
    let stairs = state.stairs;
    while (stairs && (stairs.sx !== x || stairs.sy !== y))
        stairs = stairs.next;
    return stairs?.up ? stairs : null;
}

// C potion.c:peffect_levitation().
export async function applyLevitationPotion(
    potion: GameObject,
    { state = game, publish = plineWithContinuation }: {
        state?: GameState;
        publish?: MessagePublisher;
    } = {},
): Promise<{ nothingHappened: boolean }> {
    // The quaff lifecycle owns the live world: stair climbs, float_up, and
    // spot effects all run through singleton owners.
    requireLiveGame(state);
    const hero = state.u;
    let potionNothing = false;
    // BLevitation does not prevent setting or incrementing the timeout; it
    // only suppresses the float-up feedback (C potion.c:1167-1183).
    const blocked = propertyIsBlocked('levitation', state);
    const previous = captureLevitationState(state);
    if (!propertyIsActive('levitation', state) && !blocked) {
        // Kludge: C set_itimeout(&HLevitation, 1L) so float_up() sees the
        // property active; blessed and uncursed get one extra turn out of it.
        hero.levitationTurns = 1;
        refreshProperty('levitation', state);
        await floatHeroUp(state, previous);
    } else {
        potionNothing = true;
    }

    if (potion.cursed) {
        // 'already levitating' no longer blocks the cursed effects (3.6.1);
        // either way the hero can no longer descend upon demand.  BLevitation
        // is re-read here: a float_up over a floor trap has just blocked the
        // property (C potion.c:1192 reads it after float_up's side effects).
        revokeIntrinsicProperty('levitation', 'potion', state);
        if (!blocked && !propertyIsBlocked('levitation', state)) {
            if (upStairwayAt(hero.ux, hero.uy, state)) {
                await travelStairs(true);
                potionNothing = false; /* not nothing after all */
            } else if (levelHasCeiling(state)) {
                const helmet = state.uarmh || hero.uarmh;
                let damage = rnd(!helmet ? 10
                    : !objectIsHardHelmet(helmet) ? 6 : 3);
                if (hero.halfPhysicalDamage)
                    damage = Math.trunc((damage + 1) / 2);
                await publish(`You hit your ${heroHeadName(state)} on the ${
                    ceilingName(hero.ux, hero.uy, state)}.`);
                await loseHeroHp(damage, 'colliding with the ceiling',
                    { state, publish, deathCause: 'killed by colliding with the ceiling' });
                potionNothing = false; /* not nothing after all */
            }
        }
    } else if (potion.blessed) {
        /* at this point, timeout is already at least 1 */
        increaseLevitationTimeout(hero, rn1(50, 250));
        // Can descend at will ('>') provided the timeout is the only source
        // keeping the hero aloft: no worn ring or boots (C I_SPECIAL).
        grantIntrinsicProperty('levitation', 'potion', state);
    } else {
        /* timeout is already at least 1 */
        increaseLevitationTimeout(hero, rn1(140, 10));
    }

    if (propertyIsActive('levitation', state)
        && IS_SINK(requireGameLevel(state).requireAt(hero.ux, hero.uy).typ)) {
        await applyHeroLocationEffects(publish, { pick: false });
    }
    /* levitating blocks flying */
    refreshMovementProperties(state);
    state.context.botl = true;
    return { nothingHappened: potionNothing };
}

// ---- bottlename() (C potion.c:1488) ----

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
export function randomBottleName(
    state: GameState = game, select: (range: number) => number = rn2,
) {
    const names = heroIsHallucinating(state)
        ? HALLUCINATED_BOTTLE_NAMES : ORDINARY_BOTTLE_NAMES;
    const name = names[select(names.length)];
    if (name === undefined) throw new Error('Bottle name selection was outside its range.');
    return name;
}

export function potionImpactObjectName(potion: GameObject, state: GameState = game) {
    return objectCombatName(potion, { state, includeCorpseSpecies: false });
}

// ---- H2Opotion_dip() (C potion.c:1498) ----

async function dipInWater(object: GameObject, potion: GameObject): Promise<boolean> {
    let action: 'uncurse' | 'bless' | 'unbless' | 'curse' | null = null;
    let color = '';
    if (potion.blessed && object.cursed) { action = 'uncurse'; color = 'amber'; }
    else if (potion.blessed && !object.blessed) { action = 'bless'; color = 'light blue'; }
    else if (potion.cursed && object.blessed) { action = 'unbless'; color = 'brown'; }
    else if (potion.cursed && !object.cursed) { action = 'curse'; color = 'black'; }
    if (!potion.blessed && !potion.cursed) {
        let mentionedWater = false;
        const result = await waterDamageObject(object, [], game, {
            force: true, publish: pline, mentionWater: () => { mentionedWater = true; },
        });
        if (mentionedWater) learnObjectType(POT_WATER);
        return result !== 'nothing';
    }
    if (!action) return false;
    const seen = !heroIsBlind() || object === game.ublindf && blindfolded() && !heroIsBlinded();
    if (seen) {
        const glow = displayColorName(color);
        const suffix = action === 'bless' || action === 'curse'
            ? `with ${withIndefiniteArticle(glow)} aura` : glow;
        await pline(`${ownedObjectAction(object, 'glow')} ${suffix}.`);
        game._lastPlineKind = PLNMSG_OBJ_GLOWS;
        object.bknown = !heroIsHallucinating();
    } else if (!potion.bknown || !potion.dknown) object.bknown = false;
    if (object.unpaid && object.otyp === POT_WATER) {
        if (action === 'bless' || action === 'curse') updateUnpaidObjectPrice(object);
        else await chargeAlteredUnpaidObject(object, action);
    }
    if (action === 'curse') {
        await curseObject(object);
        await dropCursedSecondaryWeapon(object);
    } else {
        const oldRadius = objectLightRadius(object);
        if (action === 'bless') blessObjectState(object);
        else if (action === 'uncurse') uncurseObjectState(object);
        else unblessObjectState(object);
        if (object.lamplit) await adjustObjectLightAfterBlessing(object, oldRadius);
    }
    return true;
}

// C potion.c:impact_arti_light()/H2Opotion_dip(). The temporary water
// object is part of the native effect, including its construction draws.
export async function impactArtifactLight(object: GameObject, worsen: boolean): Promise<void> {
    if ((worsen ? object.cursed : object.blessed)
        || objectResistsDestruction(object, 25, 75)) return;
    const water = await mksobj(POT_WATER, true, false);
    if (worsen) curseObjectState(water);
    else blessObjectState(water);
    const oldRadius = objectLightRadius(object);
    const removeBlessing = worsen && object.blessed;
    const removeCurse = !worsen && object.cursed;
    const blind = heroIsBlind();
    if (!blind) {
        const phrase = ownedObjectAction(object, 'glow');
        const color = displayColorName(removeBlessing ? 'brown' : removeCurse ? 'amber'
            : worsen ? 'black' : 'light blue');
        await plineWithContinuation(`${phrase}${
            removeBlessing || removeCurse ? ` ${color}` : ` with ${withIndefiniteArticle(color)} aura`}.`);
        object.bknown = !heroIsHallucinating();
    } else if (!water.bknown || !water.dknown) object.bknown = false;
    if (removeBlessing) unblessObjectState(object);
    else if (removeCurse) uncurseObjectState(object);
    else if (worsen) curseObjectState(object);
    else blessObjectState(object);
    const delta = objectLightRadius(object) - oldRadius;
    if (delta) {
        game.vision_full_recalc = 1;
        if (!blind) await plineWithContinuation(`${object.quan === 1 ? 'It shines' : 'They shine'} `
            + `${Math.abs(delta) > 1 ? 'much ' : ''}${delta > 0 ? 'brighter' : 'less brightly'}.`);
    }
    deallocateObject(water);
}

// ---- potionhit() (C potion.c:1625) ----

export type PotionWakeResult = { heroDied?: boolean } | void;
export type PotionWakeMonster = (monster: Monster) => PotionWakeResult | Promise<PotionWakeResult>;
export type PotionWakeNearby = (x: number, y: number, distance: number) => unknown;
type PotionMonsterDisplay = (monster: Monster) => unknown;
type PotionSplitMonster = (monster: Monster, state: GameState) => Monster | null | Promise<Monster | null>;
type PotionTransformWere = (monster: Monster, state: GameState) => boolean | Promise<boolean>;
type PotionKnowledge = ObjectCallResult | { identified: true; prompted: false };

export interface PotionVaporOptions {
    state?: GameState;
    potion: GameObject;
    publish?: MessagePublisher;
    monsterCanSeeHero?: ((monster: Monster) => boolean) | null;
}

export interface PotionVaporResult {
    received: boolean;
    shielded?: boolean;
    abilityStart?: number | null;
    confusionDuration?: number | null;
    helplessDuration?: number | null;
    speedDuration?: number | null;
    blindnessDuration?: number | null;
    invisibilityGlimpse?: 'transparent' | 'unseen' | null;
    waterEffect?: Awaited<ReturnType<typeof applyHeroWaterVaporChange>> | null;
    sightToggled?: boolean;
    resisted?: boolean;
    identifiesType?: boolean;
    typeCall?: PotionKnowledge | null;
}

export interface PotionHitOptions {
    state?: GameState;
    monster: Monster;
    potion: GameObject;
    wakeMonster?: PotionWakeMonster | null;
    publish?: MessagePublisher;
    targetVisible?: boolean;
    targetSpotted?: boolean;
    spotMonster?: (monster: Monster) => boolean;
    repaintMonster?: PotionMonsterDisplay;
    rememberInvisible?: PotionMonsterDisplay;
    wakeNearby?: PotionWakeNearby | null;
    splitMonster?: PotionSplitMonster;
    transformWere?: PotionTransformWere;
    finishKill?: FinishHeroMonsterDeath | null;
    showShield?: PotionMonsterDisplay;
    heroCaused?: boolean;
    resolveVapor?: boolean;
    distance?: number;
    target?: Position;
}

export interface PotionDirectEffect {
    heroDied?: boolean;
    angered?: boolean;
    healed?: number;
    curedBlindness?: boolean;
    killed?: boolean;
    explosionDamage?: number;
    acidResistant?: boolean;
    resisted?: boolean;
    acidDamage?: number;
    waterDamage?: number;
    waterHealing?: number;
    transformedWere?: boolean;
    splitClone?: Monster | null;
    sawIt?: boolean;
    spottedAfter?: boolean;
    rememberedInvisible?: boolean;
    invisibilityMessage?: string | null;
    paralyzed?: boolean;
    duration?: number;
    slept?: boolean;
    oldSpeed?: number;
    speed?: number;
    speedChanged?: boolean;
    speedMessage?: string | null;
    blinded?: boolean;
    blindnessDuration?: number;
    blindnessAdded?: number;
    confused?: boolean;
    changed?: boolean;
    alreadyChanged?: boolean;
    magicResistant?: boolean;
    systemShock?: boolean;
    change?: MonsterFormChange | null;
    selfTouch?: MonsterSelfTouchResult | null;
}

export interface PotionHitResult {
    heroDied?: boolean;
    bottleName: string;
    crashMessage: string;
    evaporationMessage: string | null;
    impactDamage: number;
    directEffect: PotionDirectEffect | null;
    breathedVapor?: boolean;
    vaporEffect?: PotionVaporResult | null;
    typeCall?: PotionKnowledge | null;
}

interface DirectPotionOptions {
    state: GameState;
    monster: Monster;
    potion: GameObject;
    targetVisible: boolean;
    targetSpotted: boolean;
    wakeMonster: PotionWakeMonster | null;
    publish: MessagePublisher;
    showShield: PotionMonsterDisplay;
    spotMonster: (monster: Monster) => boolean;
    repaintMonster: PotionMonsterDisplay;
    rememberInvisible: PotionMonsterDisplay;
    wakeNearby: PotionWakeNearby | null;
    splitMonster: PotionSplitMonster;
    transformWere: PotionTransformWere;
    finishKill: FinishHeroMonsterDeath | null;
    heroCaused: boolean;
}

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

function sentenceSubject(monster: Monster) {
    const subject = monsterName(monster);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}`;
}

function potionHitsSaddle(monster: Monster, potion: GameObject): GameObject | null {
    const saddle = monsterSaddle(monster);
    if (!saddle) return null;
    if (rn2(10) === 0) return saddle;
    if (potion.otyp !== POT_WATER) return null;
    // Keep potion.c's short-circuit order. Neutral water still consumes both
    // luck rolls before it reaches the final one-in-three chance.
    if (rnl(10) > 7 && potion.cursed) return saddle;
    if (rnl(10) < 4 && potion.blessed) return saddle;
    return rn2(3) === 0 ? saddle : null;
}

function saddleOwnerPhrase(monster: Monster, state: GameState) {
    const phrase = possessiveName(monsterName(monster, { state, suppressIt: true, suppressSaddle: true }));
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
}

async function applyPotionToSaddle({
    state, monster, saddle, potion, targetVisible, targetSpotted, publish,
}: { state: GameState; monster: Monster; saddle: GameObject; potion: GameObject; targetVisible: boolean; targetSpotted: boolean; publish: MessagePublisher }): Promise<void> {
    const seen = !heroIsBlind(state) && targetVisible && targetSpotted;
    const owner = saddleOwnerPhrase(monster, state);
    const glowingSaddle = potion.otyp === POT_WATER
        ? `${owner} ${objectAction(saddle, 'glow', state)}` : '';
    let change: { apply: () => void; color: string; aura: boolean } | null = null;

    if (potion.otyp === POT_WATER && potion.blessed) {
        if (saddle.cursed) {
            change = { apply: () => uncurseObjectState(saddle), color: 'amber', aura: false };
        } else if (!saddle.blessed) {
            change = { apply: () => blessObjectState(saddle), color: 'light blue', aura: true };
        }
    } else if (potion.otyp === POT_WATER && potion.cursed) {
        if (saddle.blessed) {
            change = { apply: () => unblessObjectState(saddle), color: 'brown', aura: false };
        } else if (!saddle.cursed) {
            change = { apply: () => curseObjectState(saddle), color: 'black', aura: true };
        }
    }

    if (!change) {
        if (seen) await publish(`${owner} ${objectAction(saddle, 'get', state)} wet.`);
        return;
    }

    if (seen) {
        const color = displayColorName(change.color, state);
        const glow = change.aura ? `with ${withIndefiniteArticle(color)} aura` : color;
        await publish(`${glowingSaddle} ${glow}.`);
        state._lastPlineKind = PLNMSG_OBJ_GLOWS;
        saddle.bknown = !heroIsHallucinating(state);
    } else if (!potion.bknown || !potion.dknown) {
        saddle.bknown = false;
    }
    change.apply();
}

function healingCuresBlindness(potion: GameObject) {
    if (potion.otyp === POT_FULL_HEALING) return true;
    if (potion.otyp === POT_EXTRA_HEALING) return !potion.cursed;
    return potion.otyp === POT_HEALING && !!potion.blessed;
}

function sicknessCannotHarmMonster(monster: Monster) {
    return monsterHasPoisonResistance(monster)
        || MONSTER_ATTACKS[monster?.mnum]?.some(attack =>
            attack[1] === AD_DISE || attack[1] === AD_PEST);
}

// zap.c:resist() uses potion attack level 6 and the target's runtime level.
// NOTELL suppresses shield presentation but the resistance draw still occurs.
function monsterResistsPotion(monster: Monster, state: GameState = game) {
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

function monsterHasSleepDefense(monster: Monster) {
    const resistanceBits = (MONSTER_RESISTS[monster?.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
    return !!(resistanceBits & MR_SLEEP)
        || !!monster?.defendedSleep;
}

function monsterIsWere(monster: Monster) {
    return !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_WERE);
}

// potion.c:potionhit() shares this exact pain/wake transaction between holy
// water and acid.  Silence selects writhing and suppresses wake_nearto(); an
// audible species wakes the level-scaled radius before any damage die.
// Monnam() also names sensed monsters and the hero's engulfer without sight.
async function publishPotionPainAndWakeRadius({
    monster, wakeNearby, effectName,
    publish = plineWithContinuation,
}: { monster: Monster; wakeNearby: PotionWakeNearby | null; effectName: string; publish?: MessagePublisher }): Promise<void> {
    const silent = (MONSTER_SOUND[monster.mnum] ?? 0) === 0;
    await publish(`${sentenceSubject(monster)} ${silent ? 'writhes' : 'shrieks'} in pain!`);
    if (!silent) {
        if (!wakeNearby)
            throw new Error(`${effectName} wake-radius owner unavailable`);
        await wakeNearby(
            monster.mx,
            monster.my,
            (MONSTER_LEVEL[monster.mnum] ?? 0) * 10,
        );
    }
}

function wereTransformationNoun(monster: Monster) {
    if (!monsterIsHuman(monster?.mnum)) return 'human';
    if (monster.mnum === 261) return 'rat';
    if (monster.mnum === 262) return 'jackal';
    return 'wolf';
}

function monsterSurvivedPotion(monster: Monster) {
    return !monster.dead && (monster.mhp ?? 0) > 0;
}

async function applySupportedDirectEffect({
    state, monster, potion, targetVisible, targetSpotted, wakeMonster: wakeAttackedTarget,
    publish, showShield, spotMonster, repaintMonster, rememberInvisible,
    wakeNearby, splitMonster: splitMonsterHit, transformWere, finishKill, heroCaused,
}: DirectPotionOptions): Promise<PotionDirectEffect> {
    // Most effects inherit potionhit's your_fault flag. Invisibility has
    // its own anger rule; polymorph delegates its contact to bhitm().
    const wakeMonster = heroCaused || potion.otyp === POT_INVISIBILITY || potion.otyp === POT_POLYMORPH
        ? wakeAttackedTarget : (target: Monster) => { target.msleeping = 0; };
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
            const explosion = await explodeLitOilPotion(
                potion, monster.mx, monster.my, {
                    state,
                    // explode() attributes damage by the active turn.
                    heroCaused: !state.context.mon_moving,
                    publish,
                },
            );
            if (explosion.heroDied) return { heroDied: true };
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
                if (death.heroDied) return { heroDied: true };
                killed = death.killed;
            } else if (killed) {
                // C monkilled(mon, "", AD_ACID) when the hero did not throw it.
                const death = await finishMonsterKilled(monster, state, {
                    damageType: AD_ACID, publish,
                });
                if (death.heroDied) return { heroDied: true };
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
        let splitClone: Monster | null = null;
        let killed = false;

        if (affectedByHoliness) {
            if (potion.blessed) {
                await publishPotionPainAndWakeRadius({
                    monster,
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
                    if (death.heroDied) return { heroDied: true };
                    killed = death.killed;
                } else if (monsterIsWere(monster)
                    && !monsterIsHuman(monster?.mnum)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroIsHallucinating(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${
                            wereTransformationNoun(monster)
                        }.`);
                    }
                    transformedWere = !!await transformWere(monster, state);
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
                if (monsterIsWere(monster) && monsterIsHuman(monster?.mnum)
                    && !heroHasProtectionFromShapeChangers(state)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroIsHallucinating(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${
                            wereTransformationNoun(monster)
                        }.`);
                    }
                    transformedWere = !!await transformWere(monster, state);
                }
            }
        } else if (monster.mnum === PM_GREMLIN) {
            angered = false;
            if (!splitMonsterHit)
                throw new Error('water gremlin-split owner unavailable');
            splitClone = await splitMonsterHit(monster, state);
        } else if (monster.mnum === PM_IRON_GOLEM) {
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} rusts.`);
            waterDamage = d(1, 6);
            monster.mhp -= waterDamage;
            killed = monster.mhp <= 0;
            if (killed) {
                if (!finishKill)
                    throw new Error('water fatality owner unavailable');
                const death = await finishKill(monster);
                if (death.heroDied) return { heroDied: true };
                killed = death.killed;
            }
        }

        if (!killed) {
            if (angered) {
                if ((await wakeMonster?.(monster))?.heroDied)
                    return { heroDied: true };
            } else monster.msleeping = 0;
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

        setMonsterPermanentInvisibility(monster, !cursedPotion);
        if (!monster.invis_blkd) {
            await repaintMonster(monster);
            if (monster.wormno) await redrawMonsterWormSegments(monster);
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

        if (angered) {
            if ((await wakeMonster?.(monster))?.heroDied)
                return { heroDied: true };
        } else monster.msleeping = 0;
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
            await revealMonsterAppearance(monster);
        const inherentOrDefended = monsterHasSleepDefense(monster);
        const resisted = inherentOrDefended
            || monsterResistsPotion(monster, state);
        let slept = false;
        if (resisted) {
            await showShield?.(monster);
        } else if (await putMonsterToSleep(monster, duration)) {
            slept = true;
            await publish(`${sentenceSubject(monster)} falls asleep.`);
            if (monster === state.u?.ustuck && !state.u?.uswallow
                && !heroFormSticks(state)) {
                await publish(`${possessiveName(sentenceSubject(monster))} grip relaxes.`);
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
        if (speedMessage) await publish(speedMessage);
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
        const hasEyes = monsterHasEyes(monster.mnum);
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
        if (!resisted) monster.mconf = 1;
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
        } else if (monster.mhp > 2) {
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
            && monsterHasEyes(monster.mnum)) {
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
    wakeMonster = null,
    publish = plineWithContinuation,
    targetVisible = cansee(monster?.mx, monster?.my),
    targetSpotted = canSeeMonster(monster),
    spotMonster = target => canSpotMonster(target),
    repaintMonster = async target => await newsym(target.mx, target.my),
    rememberInvisible = async target => await map_invisible(target.mx, target.my),
    wakeNearby = null,
    splitMonster: splitMonsterHit = target => splitMonster(target, state, { publish }),
    transformWere = target => transformWereMonster(target, state),
    finishKill = null,
    showShield = target => shieldeff(target.mx, target.my, state),
    heroCaused = true,
    resolveVapor = false,
    distance = 0,
    target = { x: monster.mx, y: monster.my },
}: PotionHitOptions): Promise<PotionHitResult | null> {
    if (!monster || !potion
        || !SUPPORTED_MONSTER_POTION_TYPES.has(potion.otyp)) return null;

    const bottleName = randomBottleName(state);
    const saddle = potionHitsSaddle(monster, potion);
    const hasHead = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOHEAD);
    let crashMessage = 'Crash!';
    if (targetVisible) {
        const name = monsterName(monster, { state });
        const onHead = target.x === monster.mx && target.y === monster.my;
        const impactTarget = saddle
            ? `${possessiveName(monsterName(monster, { state, suppressIt: true, suppressSaddle: true }))} saddle`
            : hasHead ? `${possessiveName(name)} ${onHead ? 'head' : 'body'}` : name;
        crashMessage = `The ${bottleName} crashes on ${impactTarget} and breaks into shards.`;
    }
    await publish(crashMessage);

    const impactRoll = rn2(5);
    const impactDamage = !saddle && impactRoll !== 0 && monster.mhp > 1
        ? 1 : 0;
    if (impactDamage) monster.mhp--;

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
        splitMonster: splitMonsterHit,
        transformWere,
        finishKill,
        heroCaused,
    });
    if (directEffect?.heroDied) return {
        heroDied: true, bottleName, crashMessage, evaporationMessage,
        impactDamage, directEffect,
    };
    let breathedVapor = false;
    let vaporEffect = null;
    if (resolveVapor) {
        breathedVapor = distance === 0;
        if (!breathedVapor && distance > 0 && distance < 3) {
            breathedVapor = rn2(
                Math.trunc((1 + currentAttribute(A_DEX, state)) / 2),
            ) === 0;
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

// ---- potionbreathe() (C potion.c:1932) ----

function healHeroOnePoint(state: PlayingGameState) {
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

function restoreBaseAttributes(state: PlayingGameState, potion: GameObject) {
    const base = state.u?.acurr?.a;
    const maximum = state.u?.amax?.a;
    const start = rn2(6);
    if (!Array.isArray(base) || !Array.isArray(maximum)) return start;
    for (let offset = 0; offset < 6; offset++) {
        const index = (start + offset) % 6;
        if ((base[index] ?? 0) < (maximum[index] ?? 0)) {
            const current = base[index];
            if (current === undefined) throw new Error(`Missing hero attribute ${index}`);
            base[index] = current + 1;
            state.context.botl = true;
            if (!potion.blessed) break;
        }
    }
    return start;
}

export function heroPotionVaporProfile(state: GameState) {
    const mnum = Number.isInteger(state.u?.umonnum)
        ? state.u.umonnum
        : Number.isInteger(state.u?.umonster) ? state.u.umonster : null;
    const flags = typeof mnum === 'number' && Number.isInteger(mnum) ? MONSTER_FLAGS1[mnum] ?? 0 : 0;
    const breathless = !!(flags & M1_BREATHLESS);
    const hasEyes = !(flags & M1_NOEYES);
    return { breathless, hasEyes, canReceive: !breathless || hasEyes };
}

function heroHasVaporShield(state: GameState) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return eyewear?.otyp === TOWEL && (eyewear.spe ?? 0) > 0;
}

async function installPotionHelplessness(state: GameState, duration: number, reason: string) {
    // nomul() keeps a longer involuntary delay. The caller still replaces
    // its reason and recovery message, even when nomul() returns early.
    nomul(-duration, state);
    state._helplessReason = reason;
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
}

function heroIsFast(state: GameState) {
    return !!(state.u?.fast || state.u?.veryFast
        || state.u?.veryFastFromArmor
        || (state.u?.veryFastTurns ?? 0) > 0);
}

function heroSeesInvisible(state: GameState) {
    const hero = state.u;
    return !!(hero.seeInvisible
        || (hero.seeInvisibleTurns ?? 0) > 0);
}

async function finishPotionVaporKnowledge(state: GameState, potion: GameObject, identifiesType: boolean): Promise<PotionKnowledge | null> {
    if (potion.dknown === false) return null;
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

function cursedVaporEyeMessage(state: GameState): string {
    const eye = heroEyeName(state);
    const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
    return `Your ${eyes} ${verbForSubject(eyes, 'sting')}!`;
}

// potionbreathe() is shared by monster contact and nearby floor breakage.
// Its final knowledge transaction either identifies an unambiguous effect or
// asks for a type-wide call name before the caller frees the potion identity.
// Potions without a vapor effect still reach that naming opportunity.
export async function applySupportedPotionVapor(options: PotionVaporOptions): Promise<PotionVaporResult> {
    const potion = options.potion;
    const inUse = potion.in_use;
    potion.in_use = true;
    let effect: PotionVaporResult;
    try {
        effect = await applyPotionVaporEffect(options);
    } finally {
        if (inUse === undefined) delete potion.in_use;
        else potion.in_use = inUse;
    }
    if (!effect.received) return effect;
    const typeCall = await finishPotionVaporKnowledge(
        options.state ?? game, potion, effect.identifiesType ?? false,
    );
    return { ...effect, typeCall };
}

async function applyPotionVaporEffect({
    state = game,
    potion,
    publish = plineWithContinuation,
    monsterCanSeeHero = null,
}: PotionVaporOptions): Promise<PotionVaporResult> {
    requirePlayingGame(state);

    const profile = heroPotionVaporProfile(state);
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
    let invisibilityGlimpse: 'transparent' | 'unseen' | null = null;
    let waterEffect = null;
    let sightToggled = false;
    let resisted = false;
    let identifiesType = false;
    if (ABILITY_POTION_TYPES.has(potion.otyp)) {
        if (potion.cursed) {
            await publish(profile.breathless
                ? cursedVaporEyeMessage(state)
                : 'Ulch!  That potion smells terrible!');
        } else {
            abilityStart = restoreBaseAttributes(state, potion);
        }
    } else if (HEALING_POTION_TYPES.has(potion.otyp)) {
        const points = potion.otyp === POT_FULL_HEALING ? 3
            : potion.otyp === POT_EXTRA_HEALING ? 2 : 1;
        for (let point = 0; point < points; point++) healHeroOnePoint(state);
        if (healingCuresBlindness(potion)) {
            await makeBlinded(0, { state, talk: !state.u.ucreamed, publish });
            await makeDeaf(0, { state, publish });
        }
        await exerciseAttribute(A_CON, true, state);
    } else if (potion.otyp === POT_SICKNESS
        && state.urole?.key !== 'healer') {
        const hero = state.u;
        if (Upolyd(hero)) hero.mh = (hero.mh ?? 0) <= 5 ? 1 : hero.mh - 5;
        else hero.uhp = (hero.uhp ?? 0) <= 5 ? 1 : hero.uhp - 5;
        state.context.botl = true;
        await exerciseAttribute(A_CON, false, state);
    } else if (potion.otyp === POT_HALLUCINATION) {
        await publish('You have a momentary vision.');
    } else if (CONFUSION_POTION_TYPES.has(potion.otyp)) {
        const hero = state.u;
        if ((hero.confusionTurns ?? 0) <= 0)
            await publish(formatFeltMessage('somewhat dizzy.', state));
        confusionDuration = rnd(5);
        await makeConfused((hero.confusionTurns ?? 0) + confusionDuration, {
            state, talk: false, publish,
        });
    } else if (HELPLESS_POTION_TYPES.has(potion.otyp)) {
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
                monstersObserveHeroResistance(
                    M_SEEN_SLEEP, state, monsterCanSeeHero,
                );
            }
        } else {
            await publish(potion.otyp === POT_PARALYSIS
                ? 'Something seems to be holding you.'
                : formatFeltMessage('rather tired.', state));
            helplessDuration = rnd(5);
            await installPotionHelplessness(
                state,
                helplessDuration,
                potion.otyp === POT_PARALYSIS
                    ? 'frozen by a potion'
                    : 'sleeping off a magical draught',
            );
        }
    } else if (potion.otyp === POT_SPEED) {
        const hero = state.u;
        if (!heroIsFast(state))
            await publish('Your knees seem more flexible now.');
        speedDuration = rnd(5);
        hero.veryFastTurns = Math.min(
            TIMEOUT,
            Math.max(0, hero.veryFastTurns ?? 0) + speedDuration,
        );
        hero.veryFast = true;
        await exerciseAttribute(A_DEX, true, state);
    } else if (potion.otyp === POT_BLINDNESS) {
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
    } else if (potion.otyp === POT_INVISIBILITY) {
        if (!heroIsBlind(state) && !heroIsInvisible(state)) {
            identifiesType = true;
            invisibilityGlimpse = heroSeesInvisible(state)
                ? 'transparent' : 'unseen';
            await publish(invisibilityGlimpse === 'transparent'
                ? 'For an instant you could see right through yourself!'
                : "For an instant you couldn't see yourself!");
        }
    } else if (potion.otyp === POT_WATER) {
        waterEffect = await applyHeroWaterVaporChange({
            state, potion, publish,
        });
    } else if ([POT_ACID, POT_POLYMORPH].includes(potion.otyp)) {
        await exerciseAttribute(A_CON, false, state);
    } else if (potion.otyp === POT_OIL) {
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

// ---- mixtype() (C potion.c:2122) ----

const AMETHYST = OBJECT_NAMES.indexOf('amethyst');

function potionColor(potion: GameObject): string {
    return displayColorName(game.objectDescriptions?.[potion.otyp] ?? OBJECT_DESCRIPTIONS[potion.otyp]);
}

function mixtureType(first: GameObject, second: GameObject): number | null {
    let left = first.otyp, right = second.otyp;
    if (first.oclass === 8 && [POT_GAIN_LEVEL, POT_GAIN_ENERGY, POT_HEALING, POT_EXTRA_HEALING,
        POT_FULL_HEALING, POT_ENLIGHTENMENT, POT_FRUIT_JUICE].includes(right)) {
        left = second.otyp;
        right = first.otyp;
    }
    switch (left) {
    case POT_HEALING:
        if (right === POT_SPEED) return POT_EXTRA_HEALING;
        // Healing also follows the higher-healing and horn recipes below.
        break;
    case POT_GAIN_LEVEL: case POT_GAIN_ENERGY:
        switch (right) {
        case POT_CONFUSION: return rn2(3) ? POT_BOOZE : POT_ENLIGHTENMENT;
        case POT_HEALING: return POT_EXTRA_HEALING;
        case POT_EXTRA_HEALING: return POT_FULL_HEALING;
        case POT_FULL_HEALING: return POT_GAIN_ABILITY;
        case POT_FRUIT_JUICE: return POT_SEE_INVISIBLE;
        case POT_BOOZE: return POT_HALLUCINATION;
        default: return null;
        }
    case POT_FRUIT_JUICE:
        switch (right) {
        case POT_SICKNESS: return POT_SICKNESS;
        case POT_ENLIGHTENMENT: case POT_SPEED: return POT_BOOZE;
        case POT_GAIN_LEVEL: case POT_GAIN_ENERGY: return POT_SEE_INVISIBLE;
        default: return null;
        }
    case POT_ENLIGHTENMENT:
        if (right === POT_LEVITATION) return rn2(3) ? POT_GAIN_LEVEL : null;
        if (right === POT_FRUIT_JUICE) return POT_BOOZE;
        if (right === POT_BOOZE) return POT_CONFUSION;
        return null;
    case AMETHYST: return right === POT_BOOZE ? POT_FRUIT_JUICE : null;
    case POT_EXTRA_HEALING: case POT_FULL_HEALING: case UNICORN_HORN: break;
    default: return null;
    }
    if (left !== UNICORN_HORN && (right === POT_GAIN_LEVEL || right === POT_GAIN_ENERGY)) {
        return left === POT_HEALING ? POT_EXTRA_HEALING
            : left === POT_EXTRA_HEALING ? POT_FULL_HEALING : POT_GAIN_ABILITY;
    }
    if (right === POT_SICKNESS) return POT_FRUIT_JUICE;
    return [POT_HALLUCINATION, POT_BLINDNESS, POT_CONFUSION].includes(right) ? POT_WATER : null;
}

// ---- dip_ok()/dip_hands_ok() (C potion.c:2214-2242) ----

// C dip_ok() downplays hands; dip_hands_ok() suggests them instead when
// slippery hands could be washed in the water source here.
async function chooseDipTarget(verb: string, floorWater = true): Promise<DipTarget | null> {
    requirePlayingGame(game);
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    const atHere = floorWater && !game.iflags.menu_requested && (location.typ === FOUNTAIN
        || location.typ === SINK || isPoolAt(game.u.ux, game.u.uy));
    const handsSuggested = atHere && !!game.u.glibTurns && heroCanReachFloor(game);
    const selection = await getobj(verb, dipClassification, {
        forcePrompt: true, hands: handsSuggested ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY,
        handsText: `your ${makePlural(heroHandName())}`,
    });
    return selection.none ? 'hands' : selection.object;
}

function dipClassification(object: GameObject): InventoryClassification {
    if (object.oclass === 12) return GETOBJ_EXCLUDE;
    return coveringEquipment(object).length ? GETOBJ_EXCLUDE_INACCESS : GETOBJ_SUGGEST;
}

function potionClassification(object: GameObject): InventoryClassification {
    return object.oclass === 8 ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE;
}

// ---- hold_potion() (C potion.c:2243) ----

async function holdPotion(potion: GameObject, dropPrefix: string): Promise<void> {
    const burden = game.flags.pickup_burden;
    game.flags.pickup_burden = Math.max(nearCapacity(game), pickupBurden(game));
    const description = await inventoryItemDescription(potion);
    unlinkObject(potion);
    try {
        await holdAnotherObject(potion, { dropMessage: `${dropPrefix} ${description}!` });
    } finally {
        if (burden === undefined) delete game.flags.pickup_burden;
        else game.flags.pickup_burden = burden;
    }
}

// ---- dodip()/dip_into() (C potion.c:2267-2406) ----

export async function dip({
    fountain,
}: { fountain: (object: DipTarget, location: MapLocation) => Promise<void> }): Promise<'cancelled' | void> {
    requirePlayingGame(game);
    const object = await chooseDipTarget('dip');
    if (!object) { game.context.move = 0; return 'cancelled'; }
    if (object !== 'hands' && await reportCoveredEquipment(object)) { game.context.move = 0; return; }
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    let declinedSource = false;
    const description = object === 'hands' ? `your ${makePlural(heroHandName())}` : await dipTargetDescription(object);
    const target = game.flags.verbose ? description : dipTargetPronoun(object);
    if (!game.iflags.menu_requested && heroCanReachFloor(game) && location.typ === FOUNTAIN) {
        if (await promptYesNo(`Dip ${target} into the fountain?`, 'n') === 'y') {
            if (object !== 'hands') object.pickup_prev = false;
            await fountain(object, location);
            game.context.move = 1;
            return;
        }
        declinedSource = true;
    }
    if (!game.iflags.menu_requested && heroCanReachFloor(game)
        && (location.typ === SINK || isPoolAt(game.u.ux, game.u.uy))) {
        const source = location.typ === SINK ? 'sink' : waterbodyName(game.u.ux, game.u.uy);
        if (await promptYesNo(`Dip ${target} into the ${source}?`, 'n') === 'y') {
            if (location.typ !== SINK && propertyIsActive('levitation')) {
                await floatingAbove(source);
                game.context.move = 1;
                return;
            }
            if (object !== 'hands') object.pickup_prev = false;
            if (location.typ === SINK) await dipSink(object);
            else if (object === 'hands' || object === game.uarmg) await washHands();
            else {
                if (object.otyp === POT_ACID) object.in_use = true;
                const result = await waterDamageObject(object, [], game, { force: true, publish: pline });
                if (result !== 'destroyed' && object.in_use) await consumeInventoryItem(object);
            }
            game.context.move = 1;
            return;
        }
        declinedSource = true;
    }
    // drink_ok() reports a declined floor source as GETOBJ_EXCLUDE_NONINVENT.
    const potion = await chooseInventoryObject(`dip ${target} into`, potionClassification, {
        hands: declinedSource ? GETOBJ_EXCLUDE_NONINVENT : GETOBJ_EXCLUDE,
    });
    if (!potion) { game.context.move = 0; return 'cancelled'; }
    game.context.move = Number(await finishDip(object, potion));
}

function dipTargetPronoun(object: DipTarget): string {
    if (object === 'hands') return 'them';
    const slot = object.oclass === 3 ? armorSlotFor(object.otyp) : null;
    return objectNameIsPlural(object) || object.otyp === LENSES
        || slot === 'uarmg' || slot === 'uarmf' ? 'them' : 'it';
}

// C potion.c:dodip() formats the item once with short_oname(doname,
// thesimpleoname), reserving its fixed worst-case prompt. The reserved text
// is "What do you want to dip into? [abdeghjkmnpqstvwyzBCEFHIKLNOQRTUWXZ#-#
// or ?*] " whose trailing blank and NUL leave 50 characters for the item.
const DIP_PROMPT_RESERVE = 77;

async function dipTargetDescription(object: GameObject): Promise<string> {
    observeObjectForNaming(object);
    return await objectQuestion(object, {
        prefix: '', suffix: '', reserve: DIP_PROMPT_RESERVE,
        // objectQuestion() retries with the call name truncated to
        // "abcdefgh..." through this state; doname must format from it.
        format: async (item, state) => await objectDescription(item, { state }),
        shortFormat: (item, state) => definiteName(simpleObjectName(item, state), state),
    });
}

// C potion.c:dodip(): the command entry over the shared dip transaction.
export async function dodip(): Promise<void> {
    if (await dip({ fountain: dipFountain }) === 'cancelled') commandResultCancelled();
}

export async function dipInto(): Promise<void> {
    if (!cmdq_peek(CQ_CANNED)) {
        // C potion.c:2384 dip_into() refuses to run when cmdq_peek(
        // CQ_CANNED) finds nothing: the item-action potion letter is
        // queued there. A ^A do-again replay pops dip_into from CQ_REPEAT
        // while CQ_CANNED is empty, so the replayed dip can never proceed.
        await impossible('dip_into: where is potion?');
        commandResultFailed();
        game.context.move = 0;
        return;
    }
    const potion = await chooseInventoryObject('dip', potionClassification);
    if (!potion) {
        // potion.c:dip_into() returns ECMD_CANCEL when the potion getobj()
        // is declined.
        commandResultCancelled();
        game.context.move = 0;
        return;
    }
    const name = simpleObjectName(potion);
    const object = await chooseDipTarget(`dip into ${objectQuantity(potion) > 1 ? 'one of ' : ''}the ${name}`, false);
    if (!object || object !== 'hands' && await reportCoveredEquipment(object)) {
        // A declined dip target is ECMD_CANCEL; covered equipment keeps
        // potion.c's ECMD_OK.
        if (!object) commandResultCancelled();
        game.context.move = 0;
        return;
    }
    game.context.move = Number(await finishDip(object, potion));
}

// ---- poof()/dip_potion_explosion()/potion_dip() (C potion.c:2407-2795) ----

async function poof(potion: GameObject): Promise<void> {
    if (potion.dknown) await tryCallObjectType(potion);
    await consumeInventoryItem(potion);
}

// C potion.c:dip_potion_explosion(): a cursed/acid/burning-oil mixture, or
// a 1-in-10 (1-in-30 over an alchemy smock) roll, explodes.
async function mixtureExplodes(object: GameObject, damage: number): Promise<boolean> {
    if (!(object.cursed || object.otyp === POT_ACID || object.otyp === POT_OIL && object.lamplit
        || !rn2(game.uarmc?.otyp === ALCHEMY_SMOCK ? 30 : 10))) return false;
    object.in_use = true;
    await pline(`${heroIsDeaf() ? '' : 'BOOM!  '}They explode!`);
    await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, (BOLT_LIM + 1) * (BOLT_LIM + 1));
    await exerciseAttribute(A_STR, false);
    if (heroPotionVaporProfile(game).canReceive) await applySupportedPotionVapor({ potion: object });
    await useUpInventoryStack(object);
    await loseHeroHp(damage, 'alchemic blast');
    return true;
}

export async function treatDippedObject(object: GameObject, potion: GameObject): Promise<boolean> {
    requirePlayingGame(game);
    if (object === potion && objectQuantity(potion) === 1) {
        await pline('That is a potion bottle, not a Klein bottle!');
        return false;
    }
    object.pickup_prev = false;
    potion.in_use = true;
    if (potion.otyp === POT_WATER) {
        if (await dipInWater(object, potion)) { await poof(potion); return true; }
    } else if (object.otyp === POT_POLYMORPH || potion.otyp === POT_POLYMORPH) {
        await dipInPolymorph(object, potion);
        return true;
    } else if (object.oclass === 8 && object.otyp !== potion.otyp) {
        await mixPotions(object, potion);
        return true;
    }
    if (potion.otyp === POT_ACID && object.otyp === CORPSE
        && object.corpsenm === MONSTER_NAME.indexOf('lichen')) {
        const color = heroIsBlind() ? 'wrinkled' : displayColorName(potion.odiluted ? 'orange' : 'red');
        await pline(`The ${objectCombatName(object)} ${objectNameIsPlural(object) ? 'turn' : 'turns'} ${color} around the edges.`);
        potion.in_use = false;
        if (potion.dknown) await tryCallObjectType(potion);
        return true;
    }
    if (potion.otyp === POT_WATER && object.otyp === TOWEL) {
        await pline('The towel soaks it up!');
        await poof(potion);
        return true;
    }
    if (isPoisonableObject(object)) {
        if (potion.otyp === POT_SICKNESS && !object.opoisoned) {
            const source = objectQuantity(potion) > 1 ? `One of the ${objectCombatName(potion)}`
                : `The ${objectCombatName(potion)}`;
            await pline(`${source} forms a coating on the ${objectCombatName(object)}.`);
            object.opoisoned = true;
            await poof(potion);
            return true;
        }
        if (object.opoisoned && !isPermanentlyPoisonedObject(object)
            && [POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING].includes(potion.otyp)) {
            await pline(`A coating wears off the ${objectCombatName(object)}.`);
            object.opoisoned = false;
            await poof(potion);
            return true;
        }
    }
    if (potion.otyp === POT_ACID) {
        const erosion = await erodeObject(object, 'corrosion', {
            displayName: objectCombatName(object),
        });
        if (erosion !== 'nothing') {
            await poof(potion);
            return true;
        }
    }
    if (potion.otyp === POT_OIL) {
        if (await dipInOil(object, potion)) return true;
        if (object.otyp === OIL_LAMP || object.otyp === MAGIC_LAMP) {
            await fillLamp(object, potion);
            return true;
        }
    }
    potion.in_use = false;
    if (await neutralizePotion(object, potion)) return true;
    await pline('Interesting...');
    return true;
}

async function dipInPolymorph(object: GameObject, potion: GameObject): Promise<void> {
    if (obj_unpolyable(object.otyp === POT_POLYMORPH ? potion : object)) {
        await pline('Nothing happens.');
        potion.in_use = false;
        return;
    }
    const conduct = game.u.uconduct ??= {};
    if (!conduct.polypiles)
        recordGameLogEvent(`polymorphed ${game.flags.female ? 'her' : 'his'} first item`, { flags: LL_CONDUCT });
    conduct.polypiles = (conduct.polypiles ?? 0) + 1;
    const oldType = object.otyp;
    const replacement = await poly_obj(object);
    if (!replacement) { learnObjectType(POT_POLYMORPH); return; }
    if (replacement.otyp !== oldType) {
        learnObjectType(POT_POLYMORPH);
        await consumeInventoryItem(potion);
        // C prinv() formats with doname(), whose xname() observes the
        // polymorphed item's new appearance before naming it.
        observeObjectForNaming(replacement);
        await pline(`${replacement.invlet} - ${await inventoryItemDescription(replacement)}.`);
    } else {
        await pline('Nothing seems to happen.');
        await poof(potion);
    }
}

async function finishDip(object: DipTarget, potion: GameObject): Promise<boolean> {
    if (object !== 'hands') return treatDippedObject(object, potion);
    await pline(`You can't fit your ${heroHandName()} into the mouth of the bottle!`);
    return false;
}

export async function mixPotions(object: GameObject, potion: GameObject): Promise<void> {
    requirePlayingGame(game);
    const mixture = mixtureType(object, potion);
    const magic = mixture ? OBJECT_MAGIC[mixture]
        : OBJECT_MAGIC[object.otyp] || OBJECT_MAGIC[potion.otyp];
    const count = objectQuantity(object);
    let amount = count;
    if (count > (object.odiluted ? 2 : magic ? 3 : 7)) {
        amount = object.odiluted ? 2 : magic ? rnd(Math.min(count, 8) - 2) + 2 : rnd(count - 6) + 6;
    }
    let prefix = 'The';
    if (amount < count) {
        const split = splitObjectStack(object, amount);
        if (!split) throw new Error(`Cannot dip ${amount} bottles from a stack of ${count}`);
        object = split;
        prefix = `${amount} of the`;
    }
    await pline(`${prefix} ${simpleObjectName(object)} ${amount === 1 ? 'mixes' : 'mix'} with ${
        objectQuantity(potion) > 1 ? 'one of ' : ''}the ${simpleObjectName(potion)}...`);
    await consumeInventoryItem(potion);
    if (await mixtureExplodes(object, amount + rnd(9))) return;
    object.blessed = false;
    object.cursed = false;
    object.buc = 'uncursed';
    object.bknown = false;
    if (heroIsBlind() || heroIsHallucinating()) object.dknown = false;
    if (mixture) object.otyp = mixture;
    else {
        switch (object.odiluted ? 1 : rnd(8)) {
        case 1: object.otyp = POT_WATER; break;
        case 2: case 3: object.otyp = POT_SICKNESS; break;
        case 4: {
            const randomPotion = await mkobj(8, false);
            object.otyp = randomPotion.otyp;
            if (object.otyp === POT_OIL) object.age = randomPotion.age;
            await deleteObject(randomPotion);
            break;
        }
        default:
            await useUpInventoryStack(object);
            await pline(`The mixture ${heroIsBlind() ? '' : 'glows brightly and '}evaporates.`);
            return;
        }
    }
    object.odiluted = object.otyp !== POT_WATER;
    if (object.otyp === POT_WATER && !heroIsHallucinating())
        await pline(`The mixture bubbles${heroIsBlind() ? '' : ', then clears'}.`);
    else if (!heroIsBlind()) await pline(`The mixture looks ${potionColor(object)}.`);
    await freeInventoryObject(object);
    await holdPotion(object, 'You drop');
}

export async function neutralizePotion(object: GameObject, potion: GameObject): Promise<boolean> {
    if (object.otyp !== UNICORN_HORN && object.otyp !== AMETHYST) return false;
    const mixture = mixtureType(object, potion);
    if (!mixture) return false;
    const oldType = potion.otyp;
    const oldKnown = !!potion.dknown;
    const oldColor = oldKnown ? `${potionColor(potion)} ` : '';
    const several = objectQuantity(potion) > 1;
    let single = potion;
    if (several) {
        const split = splitObjectStack(potion, 1);
        if (!split) throw new Error('Cannot separate the potion being neutralized');
        single = split;
    }
    await chargeAlteredUnpaidObject(single, 'neutralize');
    single.otyp = mixture;
    single.blessed = false;
    single.cursed = mixture === POT_WATER ? false : !!object.cursed;
    single.buc = single.cursed ? 'cursed' : 'uncursed';
    if (mixture === POT_WATER) single.odiluted = false;
    single.bknown = false;
    single.dknown = false;
    if (!heroIsBlind()) {
        if (!heroIsHallucinating()) observeObject(single);
        const change = mixture === POT_WATER && single.dknown ? 'clears' : `turns ${potionColor(single)}`;
        await pline(`The ${oldColor}potion${several ? ' that you dipped into' : ''} ${change}.`);
        if (oldKnown) {
            // docall's temporary object describes the old liquid, whose
            // identity must remain available after the real bottle changes.
            await tryCallObjectType({ ...single, otyp: oldType, dknown: true });
        }
    }
    await holdPotion(single, 'You juggle and drop');
    return true;
}

async function dipInOil(object: GameObject, potion: GameObject): Promise<boolean> {
    let wisdom = false;
    if (potion.lamplit) {
        await fireDamageObject(object, { force: true, x: game.u.ux, y: game.u.uy, publish: pline });
    } else if (potion.cursed) {
        await pline(`The potion spills and covers your ${fingersOrGloves()} with oil.`);
        setPropertyTimeout('glib', (game.u.glibTurns ?? 0) + d(2, 10));
    } else if (object.oclass !== 2 && !isWeaponTool(object)) return false;
    else if ((!objectIsVulnerableToErosion(object, 'rust') && !objectIsVulnerableToErosion(object, 'corrosion'))
        || isLauncherAmmunition(object) || !(object.oeroded || object.oeroded2)) {
        const verb = verbForSubject(objectNameIsPlural(object) ? 'they' : null,
            heroIsBlind() ? 'feel' : 'gleam');
        await pline(`${ownedObjectName(object)} ${verb} ${heroIsBlind() ? 'oily' : 'with an oily sheen'}.`);
    } else {
        const damage = object.oeroded && object.oeroded2 ? 'corroded and rusty'
            : object.oeroded ? 'rusty' : 'corroded';
        const verb = verbForSubject(objectNameIsPlural(object) ? 'they' : null,
            heroIsBlind() ? 'feel' : 'are');
        await pline(`${ownedObjectName(object)} ${verb} less ${damage}.`);
        object.oeroded = Math.max(0, (object.oeroded ?? 0) - 1);
        object.oeroded2 = Math.max(0, (object.oeroded2 ?? 0) - 1);
        wisdom = true;
    }
    await exerciseAttribute(A_WIS, wisdom);
    if (potion.dknown) learnObjectType(POT_OIL);
    await consumeInventoryItem(potion);
    return true;
}

async function fillLamp(lamp: GameObject, potion: GameObject): Promise<void> {
    if (lamp.lamplit || potion.lamplit) {
        await consumeInventoryItem(potion);
        await explode(game.u.ux, game.u.uy, 11, d(6, 6), 0, EXPL_FIERY);
        await exerciseAttribute(A_WIS, false);
        return;
    }
    if (lamp.otyp === MAGIC_LAMP && !lamp.spe) { lamp.otyp = OIL_LAMP; lamp.age = 0; }
    if (lamp.age > 1000) {
        await pline(`${ownedObjectAction(lamp, 'are')} full.`);
        potion.in_use = false;
    } else {
        await pline(`You fill ${ownedObjectName(lamp, game, { capitalized: false })} with oil.`);
        await chargeUnpaidUsage(potion);
        lamp.age = Math.min(1500, lamp.age + Math.trunc((potion.odiluted ? 3 : 4) * potion.age / 2));
        await consumeInventoryItem(potion);
        await exerciseAttribute(A_WIS, true);
    }
    if (potion.dknown) learnObjectType(POT_OIL);
    lamp.spe = 1;
}

// ---- mongrantswish()/djinni_from_bottle()/split_mon() (C potion.c:2796-2918) ----

export async function grantMonsterWish(monster: Monster, {
    state = game,
}: PotionEffectOptions = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { mx, my } = monster;
    const spentTime = state.context.move;
    const square = state.level.at(mx, my);
    const projection = square ? {
        ch: square.disp_ch ?? ' ', color: square.disp_color,
        decgfx: square.disp_decgfx, attr: square.disp_attr,
        glyph: square.disp_glyph ?? null,
    } : null;
    // Remove before wishing so an artifact-fatal wish cannot put the donor
    // in bones. Keep its last map projection visible until the prompt ends.
    await removeWishGrantingMonster(monster);
    if (state.program_state.gameover) return;
    if (projection)
        await show_glyph_cell(mx, my, projection.ch, projection.color,
            projection.decgfx, projection.attr, projection.glyph);
    try {
        await makeWish();
    } finally {
        state.context.move = spentTime;
        await newsym(mx, my);
    }
}

// C potion.c:djinni_from_bottle(), shared by smoky potions and rubbed lamps.
export async function releaseDjinni(source: GameObject, state: PlayingGameState) {
    const monster = await makemonNear(PM_DJINNI, state.u.ux, state.u.uy, MM_NOMSG);
    if (!monster) {
        await pline('It turns out to be empty.');
        return;
    }
    if (heroIsBlind(state)) {
        await pline('You smell acrid fumes.');
        await pline('Something speaks.');
    } else {
        await pline(`In a cloud of smoke, ${monsterName(monster, { article: 'a', state })} emerges!`);
        await pline(`${monsterName(monster, { capitalized: true, state })} speaks.`);
    }

    let chance = rn2(5);
    if (source.blessed) chance = chance === 4 ? rnd(4) : 0;
    else if (source.cursed) chance = chance === 0 ? rn2(4) : 4;
    switch (chance) {
    case 0:
        await pline('"I am in your debt.  I will grant one wish!"');
        await grantMonsterWish(monster, { state });
        break;
    case 1:
        await pline('"Thank you for freeing me!"');
        await tameMonster(monster, null, { state });
        break;
    case 2:
        await pline('"You freed me!"');
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        break;
    case 3:
        await pline('"It is about time!"');
        if (canSpotMonster(monster))
            await pline(`${monsterName(monster, { capitalized: true, state })} vanishes.`);
        await removeMonsterFromGame(monster);
        break;
    default:
        await pline('"You disturbed me, fool!"');
        monster.mpeaceful = 0;
        setMonsterMalign(monster, state);
        break;
    }
}

interface SplitOptions extends CloneOptions {
    // split_mon()'s second argument: whose heat made the monster divide.
    heatSource?: Monster | 'hero' | null;
    publish?: MessagePublisher;
}

// C potion.c:split_mon() for a monster.  The heat source is named before
// cloning, and a spotted monster announces the division.
export async function splitMonster(
    monster: Monster | null | undefined, state: GameState = game,
    { heatSource = null, publish = plineWithContinuation, ...options }: SplitOptions = {},
): Promise<Monster | null> {
    if (!monster) return null;
    const reason = heatSource === 'hero' ? ' from your heat'
        : heatSource ? ` from ${possessiveName(monsterName(heatSource, { state }))} heat` : '';
    const maximumHp = monster.mhpmax ?? monster.mhp ?? 0;
    if ((monster.mhp ?? 0) > maximumHp) monster.mhp = maximumHp;
    const clone = await cloneMonster(monster, state, options);
    if (!clone) return null;

    clone.mhpmax = Math.trunc(maximumHp / 2);
    monster.mhpmax = maximumHp - clone.mhpmax;
    if (canSpotMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} multiplies${reason}!`);
    return clone;
}

// C potion.c:split_mon() halves maximum HP after cloneu() divides current HP.
export async function splitHeroMonsterForm(state: GameState = game): Promise<Monster | null> {
    const maximum = state.u.mhmax;
    if (maximum === undefined) return null;
    const clone = await cloneHeroMonsterForm(state);
    if (clone) {
        clone.mhpmax = Math.trunc(maximum / 2);
        state.u.mhmax = maximum - clone.mhpmax;
    }
    return clone;
}

// C potion.c:speed_up().
export async function speedUpHero(duration: number, state = game) {
    requireLiveGame(state);
    const hero = state.u;
    if (!hero.veryFast) {
        const alreadyFast = hero.fast || hero.veryFastFromArmor;
        await plineWithContinuation(`You are suddenly moving ${alreadyFast ? '' : 'much '}faster.`);
    } else {
        await plineWithContinuation(`Your ${makePlural(heroLegName(state))} get new energy.`);
    }
    await exerciseAttribute(A_DEX, true, state);
    setPropertyTimeout('fast', propertyTimeout('fast', state) + duration, state);
}

// C potion.c:strange_feeling(). Detection already owns its result message;
// both paths finish through the same object naming and single-use boundary.
export async function strangeFeeling(source: GameObject | null, text: string | null, {
    state = game,
}: Pick<ScrollEffectOptions, 'state'> = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const message = state.flags.beginner || !text
        ? `You have a ${heroIsHallucinating(state) ? 'normal' : 'strange'} feeling for a moment, then it passes.`
        : text;
    await plineWithContinuation(message);
    return finishStrangeFeeling(source, { state });
}

export async function finishStrangeFeeling(source: GameObject | null, {
    state = game,
}: Pick<ScrollEffectOptions, 'state'> = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (source?.dknown) await tryCallObjectType(source, state);
    if (source) await consumeInventoryItem(source, state);
    return { known: false, consumed: !!source, heroDied: !!state.program_state.gameover };
}

// C potion.c:strange_feeling(), message half, as detect.c's detectors call
// it; the trycall/useup half stays with the callers' effectResult handling.
// The owning full port is strangeFeeling() above.
export async function strangeFeelingMessage(message: string, state: GameState, forceMessage = false) {
    await plineWithContinuation(state.flags.beginner && !forceMessage
        ? `You have a ${heroIsHallucinating(state) ? 'normal' : 'strange'} feeling for a moment, then it passes.`
        : message);
}

// C potion.c:make_glib().
export function setSlipperyHands(turns: number, state: GameState = game) {
    // Native make_glib() redraws when the old and requested states agree.
    // Timeout expiry calls it after clearing the old timer.
    if (!!state.u.glib === (turns > 0)) state.context.botl = true;
    state.u.glibTurns = Math.max(0, Math.min(TIMEOUT, turns));
    state.u.glib = state.u.glibTurns > 0;
}
