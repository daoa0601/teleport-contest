// NetHack uhitm.c combat, including each attacker/defender direction of
// the physical, seduction, brain-drain, elemental and status effects below.
// Message publishers await tty input at the point where C prints a line.

import {
    WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, POTION_CLASS, SPBOOK_CLASS,
    COIN_CLASS, GEM_CLASS,
} from './objclass.js';
import {
    objectSkill, ACID_VENOM, AMULET_OF_LIFE_SAVING, BLINDING_VENOM, BOOMERANG, BOULDER,
    CLOVE_OF_GARLIC, CORPSE, CREAM_PIE, DUNCE_CAP, EGG, ELVEN_ARROW, ELVEN_BOW, EXPENSIVE_CAMERA,
    GAUNTLETS_OF_POWER, HEAVY_IRON_BALL, IRON_CHAIN, IRON_SHOES, KATANA, LOADSTONE, MIRROR,
    OBJECT_NAMES, TOWEL, YA, YUMI,
} from './object_data.js';
import { adjustHeroAlignment } from './alignment.js';
import { OBJ_DESCR } from './o_init.js';
import { monsterSentenceSubject, sessionIsNight } from './ambient_sounds.js';
import { monsterHasMagicResistance } from './trap.js';
import { applyArtifactHit, artifactById, artifactDamageBonus, artifactEmitsLight, artifactStrikesShade, findArtifact, monsterHasArtifactDefense } from './artifacts.js';
import type { ArtifactDefender } from './artifacts.js';
import { getmattk } from './attack_selection.js';
import { adjustAttribute, attributeChangeMessage, changeHeroLuck, currentAttribute, exerciseAttribute, exerciseWisdom } from './attrib.js';
import { heroIsPunished } from './ball.js';
import { applyMonsterBlindness, heroBlindingObjectHitMessage, heroCanBeBlindedByContact, monsterCanBeBlindedByObject, monsterResistsBlindingLight } from './blinding_attack.js';
import { heroHandName, heroLegName, heroStomachName, monsterLegName } from './body_parts.js';
import { heroHasInvoluntaryDelay } from './cmd.js';
import { A_CON, A_DEX, A_INT, A_LAWFUL, A_STR, A_WIS, D_CLOSED, D_LOCKED, DIED, DISMOUNT_KNOCKED, DISMOUNT_POLY, DOOR, DROWNING, EXPL_FIERY, EXPL_FROSTY, EXPL_MAGICAL, FAINTED, G_NOCORPSE, IRONBARS, Is_airlevel, IS_OBSTRUCTED, IS_TREE, Is_waterlevel, KILLED_BY, KILLED_BY_AN, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_SLEEP, MGIVENNAME, MM_IGNORELAVA, MM_IGNOREWATER, MMOVE_DIED, MON_EXPLODE, MSLOW, Luck, NEW_MOON, NON_PM, P_AXE, P_BARE_HANDED_COMBAT, P_BASIC, P_ISRESTRICTED, P_KNIFE, P_LANCE, P_NONE, P_SKILLED, P_TWO_WEAPON_COMBAT, P_UNSKILLED, P_WHIP, PARANOID_HIT, POOL, RLOC_MSG, RLOC_NOMSG, SHOPBASE, STONING, STR18, STRAT_WAITFORU, STRAT_WAITMASK, TT_PIT, Upolyd, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMU, W_RINGL, W_RINGR, W_SADDLE, W_WEP, WATER, WT_IRON_BALL_INCR } from './const.js';
import { isok } from './cmd.js';
import { specialContactDamage } from './contact_damage.js';
import { isZombieMaker } from './corpse_species.js';
import type { MonsterAttack } from './data_types.js';
import { isPoolAt } from './dbridge.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, flush_screen, glyphAt, map_invisible, map_location, newsym, senseWithTelepathy, shieldeff, show_glyph_cell, transientMonsterGlyph, unmap_invisible } from './display.js';
import { displayColorName, displayLiquidName, monsterLeashName, monsterName, monsterName as displayedMonsterName, namelessMonsterName, randomDisplayMonsterSubject } from './do_name.js';
import { armorSimpleName, armorSlotFor, heroHasDrainResistance, heroHasFreeAction, objectIsHardHelmet, some_armor } from './do_wear.js';
import { abusePetAfterHeroHit, tameMonster } from './dog.js';
import { hurtleHero, hurtleMonster, objectBreaksOnImpact, releaseCameraDemon, staggerVerb, tryUnarmedStagger, willMonsterHurtle } from './dothrow.js';
import type { HurtleDeathHandler, HurtleLiquidDeathHandler } from './dothrow.js';
import { levelIsWaterLevel } from './dungeon.js';
import { eat_brains, eating_conducts, morehungry, newuhs } from './eat.js';
import { finishHeroDeath, finishMonsterAttackDeath } from './end.js';
import type { DeathHandler } from './end.js';
import { wipeHeroEngraving } from './engrave.js';
import { loseHeroExperience } from './exper.js';
import { explode } from './explosion.js';
import { floorObjectDescription } from './invent.js';
import type { GameState, MonsterHelplessnessReason, PlayingGameState } from './game_state.js';
import { LL_CONDUCT, recordGameLogEvent } from './gamelog.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import { checkHeroAttackOverexertion, doorlessDoor, exceedsActionCapacity, heroTestMove, nearCapacity, nomul, roomForRoomno, roomsAt, stopRun } from './hack.js';
import { dist2, ordinalSuffix, possessiveName, upstart } from './hacklib.js';
import { dropObjectAtHero, woundHeroLegs } from './do.js';
import { resolveHeroEggHit } from './hero_egg_hit.js';
import { releaseHeroFromMonster } from './mon.js';

import { heroGrabMisses, heroSeductionCompatibility, monsterCanBeStrangled, showHeroSilverContact } from './hero_form_contact.js';
import { setHeroGrip } from './mon.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { freeInventoryObject } from './invent.js';
import { heroIsInvisible } from './hero_invisibility.js';

import { finishHeroLiquidMonsterDeath, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import type { FinishHeroMonsterDeath, HeroMonsterKillOptions } from './hero_monster_death.js';
import type { HeroNaturalDamageResult, HeroNaturalEffectContext, HeroNaturalEffectResult } from './hero_natural_types.js';
import type { HeroPhysicalAttackMode, HeroPhysicalHitOptions, HeroPhysicalHitResult, HeroProjectileVolley } from './hero_physical_types.js';
import { retouchEquipment } from './hero_retouch.js';
import { formatFeltMessage, formatHeardMessage, publishHeardMessage } from './hero_speech.js';
import { requireInitializedHero } from './hero_types.js';
import type { Hero, HeroSkill } from './hero_types.js';
import { consumeInventoryItem, inventoryItemDescription, mergable } from './invent.js';
import { snuffMonsterInventoryLights } from './light.js';
import { cloneMonster } from './makemon.js';
import type { MapLocation, Position } from './map_types.js';
import { touchHeroWithDeath } from './mcastu.js';
import { drainMonsterEnergy, putMonsterToSleep, showMonsterArtifactFallbackHit } from './mhitm.js';
import { mdamageu, heroHasRemovableSpeed, u_slip_free, diseasemu, magic_negation, mpoisons_subj, presentMonsterAttackEffects, doseduce, u_slow_down } from './mhitu.js';
import { normalDemon } from './minion.js';
import { cloneHeroMonsterForm, makemonNear } from './mklev.js';
import { deallocateObject, linkObjectToMonsterInventory, mksobj, objectQuantity, objectWeight, set_corpsenm, splitObjectStack, unlinkMonsterObject, unlinkObject } from './mkobj.js';
import { angerAttackedMonster, angerWatchGuards, applyMonsterGolemEffects, changeMonsterForm, finishMonsterKilled, finishMonsterPetrification, grantMonsterCorpseIntrinsic, grantMonsterIntrinsic, healMonster, isWatch, monsterSubject, paralyzeMonster, removeMonsterFromGame, resolveMonsterCorpseChance, revealMonsterAppearance, turnGolemToStone, wakeAttackedMonster, wakeMonster, wakeMonstersNearWithMessages } from './mon.js';
import type { MonsterDeathHandler, MonsterDefenderPetrificationResult, PetrificationDeathHandler, PetrificationOptions } from './mon.js';
import { is_neuter, monsterCombatDefense, monsterFireDescription, monsterHasAcidResistance, monsterHasColdResistance, monsterHasDrainResistance, monsterHasFireResistance, monsterHasPoisonResistance, monsterHasShockResistance, monsterHasStoneResistance, monsterIsHelpless, monsterPossessive, monsterResistsSleep, monstersForgetHeroResistance, monstersObserveHeroResistance, monsterSubjectPronoun, cant_drown, carnivorous, herbivorous, is_elf, is_orc, is_shapeshifter, metallivorous, monsterIsAmphibious, monsterIsBreathless, monsterIsHumanoid, monsterCanTeleport, monsterDigests, monsterEnfolds, monsterHasEyes, monsterHasHead, monsterHasNoHands, monsterHasProperName, monsterHatesBlessings, monsterHatesLight, monsterHatesSilver, monsterHidesUnder, monsterIsAmorphous, monsterIsAnimal, monsterIsDemon, monsterIsEel, monsterIsFlyer, monsterIsMindless, monsterIsNoncorporeal, monsterIsNonliving, monsterIsRider, monsterIsShade, monsterIsSlimeproof, monsterIsSlithy, monsterIsThickSkinned, monsterIsUndead, monsterIsUnsolid, monsterIsVampireShifter, monsterIsVerySmall, monsterIsWhirly, monsterIsWooden, monsterPassesWalls, monsterSpeciesHatesSilver, monsterSpeciesSticks , monsterHasNoAttacks } from './mondata.js';
import { wornMonsterLifeSaver } from './mon.js';
import { beginMonsterMove, makeMonsterFlee, presentMonsterMoveMessage, presentMonsterPostMove, setMonsterApparentHeroPosition } from './monmove.js';
import { recordRandom } from './monster_action_types.js';
import type { AttackTuple, HeroContactAttack, MonsterCallLog, MonsterMovementAction, RandomBelow, RollDice, RollOne } from './monster_action_types.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DGST, AD_DISE, AD_DISN, AD_DRCO, AD_DRDX, AD_DREN, AD_DRIN, AD_DRLI, AD_DRST, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RBRE, AD_RUST, AD_SAMU, AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPC1, AD_SPC2, AD_SPEL, AD_SSEX, AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP } from './monster_attack_types.js';
import type { AttackMethod, DamageType } from './monster_attack_types.js';
import type { MonsterCombatEffectContext, MonsterCombatEffectResult } from './monster_combat_effect_types.js';
import { MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SYMBOL, PM_GREEN_SLIME, monsterTypeName, requireMonsterData  } from './monster_data.js';
import type { Monster } from './monster_types.js';
import { destroyObjectFromMonsterInventory, findMonsterArmorClass, removeObjectFromMonsterInventory } from './monworn.js';
import { munslime, munstone } from './muse.js';
import type { MonsterStoningCureOptions } from './muse.js';
import { objectMaterial, observeObject, objectTypeKnown } from './o_init.js';
import { isAxe, isBimanualObject, isBlade, isBluntWeapon, isFlimsyObject, isLauncherAmmunition, isMissileObject, isPermanentlyPoisonedObject, isPoisonableObject, isPolearm, isWeaponTool, launcherMatchesAmmo, is_launcher } from './object_properties.js';
import type { GameObject } from './object_types.js';
import { corpseName, makePlural, minimalObjectName, objectCombatName, objectHasPersonalName, objectName, objectNameIsPlural, observeObjectForNaming, ownedObjectAction, ownedObjectName, pluralizeObjectNoun, verbForSubject, withIndefiniteArticle } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { objectAtMonsterDescription } from './pager.js';
import { petFoodNutrition } from './pet_eating.js';
import { pline, plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { poisonHero } from './poison.js';
import type { HeroPoisonOptions } from './poison.js';
import { applyHeroGolemEffects, heroFormSticks, heroHasNoHands, heroHasProtectionFromShapeChangers, heroHatesSilver, heroIsFlaming, heroIsPolymorphed, heroIsUnchanging, heroIsVerySmall, heroMonsterForm, heroPassesWalls, heroSpecies, polymonHero, polymorphHero, releaseHeroGrip, returnHeroToHumanForm } from './polyself.js';
import { cureHeroSickness, heroIsSick, heroIsSliming, hitMonsterWithSupportedPotion, makeBlinded, makeConfused, makeStunned, setHeroPetrificationTimeout, setHeroSlimingTimeout, splitMonster } from './potion.js';
import { ghodHitsu } from './priest.js';
import { hasWornProperty, propertyIsActive } from './properties.js';
import { paranoidQuery } from './cmd.js';
import { capitalizedDefiniteName, rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { ureflects, heroReflectsRay } from './muse.js';

import { d, rn2, rnd, rnl } from './rng.js';
import type { rnd as RndType } from './rng.js';
import { heroDetectsMonsters, heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { carriedObjectOwner, deleteObject, dopay, tendedShop } from './shk.js';
import { loseHeroSpellMemory } from './spell.js';
import { addObjectToMonsterInventory, stealFromHero, stealHeroGold, stealHeroQuestObject } from './steal.js';
import { dismountHero, monsterAtPosition } from './steed.js';
import { contactIsProtected, fleshPetrifies, formCanBecomeStoneGolem, heroIsPetrifying, heroResistsStoning, startHeroPetrification, touchPetrifies } from './stoning.js';
import { askTeleportDestination, goodPosition, heroControlsTeleport, randomMonsterRelocation, reportMonsterTeleportRestriction, teleportHero, teleportMonsterByHero } from './teleport.js';
import { attrcurse } from './throne.js';
import { burnAwayHeroSlime, putHeroToSleep } from './timeout.js';
import { damageObjectWithAcid, erodeArmor, erodeAttackingWeapon, erodeObject, mintrap, heroIsUnconscious, igniteItems, monsterSelfTouch, petrifyMonsterFromContact, resolveImmediatePetrification } from './trap.js';
import type { ErosionKind } from './trap.js';
import { canBeginTwoWeaponCombat, dropSecondaryWeapon, stopTwoWeaponCombat } from './wield.js';
import { addInventoryItem } from './invent.js';
import { cansee, monsterHasLineOfSightToHero } from './vision.js';
import { drainHeroWeaponSkills, dryTowel, ensureHeroSkills, heroAttackBonus, heroStrengthDamageBonus, monsterWieldedWeapon, rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero, shadeBlocksWeaponBaseDamage, unwieldMonsterWeapon, updateMonsterWeaponAfterPolymorph, useHeroSkill, weaponHitValue, weaponSkillDamageBonus, weaponSkillHitBonus, weaponSkillType } from './weapon.js';
import { applyHeroWereChange, isHumanWereMonster, isWereMonster, revertHeroWereForm, setHeroLycanthropy, wereChange } from './were.js';
import { isTwoWeaponObject, setPrimaryWeapon, setTwoWeaponCombat, uwepgone } from './wield.js';
import { cutWorm } from './worm.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './worn.js';
import { destroyColdInventory, destroyElectricInventory, destroyFireInventory, destroyMonsterInventoryByElement, drainObjectEnchantment, monsterResistsEffect, objectResistsDestruction } from './zap.js';

// C obj.h/permonst: completelyburns() — bodies that fire destroys outright.
function completelyBurns(monster: Pick<Monster, 'mnum'>): boolean {
    const species = MONSTER_NAME[monster.mnum];
    return species === 'paper golem' || species === 'straw golem';
}

export interface HeroDefenderFireContext {
    state: PlayingGameState;
    attacker: Monster;
    /** Precomposed mhitu.c:hitmsg() line for the attacking slot. */
    hitMessage: string | null;
    /** mhitm_data.damage on entry: hitmu()'s declared damage roll. */
    damage: number;
    /** mattk->aatyp, for on_fire()'s hug wording. */
    attackType: AttackMethod;
    publish: MessagePublisher;
    die: DeathHandler;
    random: typeof rn2;
    rollOne: typeof rnd;
    calls: MonsterCallLog;
}

// One call of mhitm_adtyping(… AD_FIRE …): the union member names the actor
// that C compares against &gy.youmonst.
export type MhitmAdFireCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderFireContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

export interface MhitmAdFireResult {
    /** mhm->damage after the branch. */
    damage: number;
    /** mhm->hitflags (set only by the monster-vs-monster golem death). */
    nativeResult: number;
    /** mhm->done. */
    done: boolean;
    heroDied: boolean;
    /** Hero defender only: the burn left the hero at zero hit points, so
     *  hitmu() must skip its ordinary damage tail and finish the fatal
     *  attack through mdamageu(magr, 1) instead. */
    heroAtZeroHitPoints?: boolean;
}

function continueResult(damage: number): MhitmAdFireResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}


// ─── C uhitm.c:attack_checks() (from hero_attack_preflight.ts) ───

// Attack permission and hidden-monster discovery before a hero weapon strike.
// C ref: uhitm.c attack_checks().

export interface AppliedWeaponAttackOptions {
    state?: GameState;
    // C gb.bhitpos: a struck worm tail can be away from the head.
    struckAt?: Position;
}

export interface AppliedWeaponAttackPermission {
    proceed: boolean;
    spentTime: boolean;
    confirmationOverridden?: boolean;
}

const DISGUISE_TYPES = new Set([
    M_AP_OBJECT, M_AP_FURNITURE, M_AP_MONSTER,
]);

function heroIsBlindFromState(state: GameState) {
    return !!(state.blind || state.u?.blind || (state.u?.blindTurns ?? 0) > 0);
}

function heroIsImpaired(state: GameState) {
    const hero = state.u;
    return !!(hero?.confused || (hero?.confusionTurns ?? 0) > 0
        || heroIsHallucinating(state)
        || hero?.stunned || (hero?.stunnedTurns ?? 0) > 0);
}

function shapechangerProtection(state: GameState) {
    return !!(state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers);
}

function targetGlyphState(at: Position, state: GameState) {
    const glyph = glyphAt(at.x, at.y, state);
    return {
        invisible: glyph?.kind === 'invisible',
        warning: glyph?.kind === 'warning',
    };
}

function hasUnrevealedAppearance(monster: Monster, state: GameState) {
    return DISGUISE_TYPES.has(M_AP_TYPE(monster))
        && !shapechangerProtection(state);
}

function hidesUnder(monster: Monster) {
    return monsterHidesUnder(monster?.mnum);
}

function isEel(monster: Monster) {
    return monsterIsEel(monster?.mnum);
}

// C dmgtype(mtmp->data, AD_STCK): any attack of the species adheres.
function hasStickyAttack(monster: Monster) {
    return requireMonsterData(MONSTER_ATTACKS, monster.mnum)
        .some(attack => attack[1] === AD_STCK);
}

// C m_next2u(m): the squared euclidean distance to the hero is at most 2.
function isAdjacentToHero(monster: Monster, state: GameState) {
    const dx = monster.mx - (state.u?.ux ?? monster.mx);
    const dy = monster.my - (state.u?.uy ?? monster.my);
    return dx * dx + dy * dy <= 2;
}

async function floorObjectName(x: number, y: number, state: GameState) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object) return null;
    observeObjectForNaming(object, { state });
    return await floorObjectDescription(object);
}

async function publishHiddenMonster(monster: Monster, state: GameState) {
    const blind = heroIsBlindFromState(state);
    const hallucinating = heroIsHallucinating(state);
    const perceivedName = monsterLeashName(monster, state);
    const visibleName = perceivedName === 'it' ? null : perceivedName;
    if (!blind && hallucinating) {
        const disposition = monster.mtame ? 'tame' : 'wild';
        const noun = visibleName || 'creature';
        const verb = visibleName ? 'appears' : 'is present';
        await plineWithContinuation(`A ${disposition} ${noun} ${verb}!`);
        return;
    }

    const submergedCover = isPoolAt(monster.mx, monster.my, state)
        && !(state.underwater || state.u.uinwater);
    if (blind || submergedCover) {
        await plineWithContinuation("Wait!  There's a hidden monster there!");
        return;
    }

    const cover = await floorObjectName(monster.mx, monster.my, state);
    if (cover) {
        await plineWithContinuation(
            `Wait!  There's ${visibleName
                ? withIndefiniteArticle(visibleName) : 'something'} hiding under ${cover}!`,
        );
    }
}

function stormbringerOverridesConfirmation(weapon: GameObject | null, state: GameState) {
    return artifactById(weapon?.oartifact, state)?.name === 'Stormbringer';
}

export async function prepareAppliedWeaponAttack(
    monster: Monster, weapon: GameObject | null,
    { state = game, struckAt }: AppliedWeaponAttackOptions = {},
): Promise<AppliedWeaponAttackPermission> {
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;

    if (state.u?.uswallow && state.u?.ustuck === monster)
        return { proceed: true, spentTime: false };
    if (state.context?.forcefight)
        return { proceed: true, spentTime: false };

    // Read and mark the struck square, including when it is a worm tail.
    const struck = struckAt ?? { x: monster.mx, y: monster.my };
    const glyph = targetGlyphState(struck, state);
    const sensed = canSenseMonster(monster);
    const unrevealedAppearance = hasUnrevealedAppearance(monster, state);
    const spotted = canSpotMonster(monster);
    const hiddenUnderVisibleCover = !heroIsBlindFromState(state)
        && monster.mundetected && hidesUnder(monster);

    if (!spotted && !glyph.warning && !glyph.invisible
        && !hiddenUnderVisibleCover) {
        await plineWithContinuation(
            "Wait!  There's something there you can't see!",
        );
        await map_invisible(struck.x, struck.y);
        // An unseen mimic sticks to the hero before being woken, exactly
        // as if it had been stumbled upon while visible.
        if (hasUnrevealedAppearance(monster, state) && !state.u.ustuck
            && !monster.mflee && hasStickyAttack(monster)
            && isAdjacentToHero(monster, state)) {
            setHeroGrip(monster, state);
        }
        await wakeAttackedMonster(monster);
        return { proceed: false, spentTime: true };
    }

    if (unrevealedAppearance && !sensed && !glyph.warning) {
        if (glyph.invisible) {
            await revealMonsterAppearance(monster);
            return { proceed: true, spentTime: false };
        }
        await stumbleOntoMimic(monster, state);
        return { proceed: false, spentTime: true };
    }

    if (monster.mundetected
        && !canSeeMonster(monster)
        && !glyph.warning && (hidesUnder(monster) || isEel(monster))) {
        monster.mundetected = 0;
        monster.msleeping = 0;
        await newsym(monster.mx, monster.my);
        if (glyph.invisible) {
            // C seemimic() redraws the square even without a disguise to drop.
            if (!(await revealMonsterAppearance(monster)).revealed) await newsym(monster.mx, monster.my);
            return { proceed: true, spentTime: false };
        }
        if (!senseWithTelepathy(monster) && !heroDetectsMonsters()) {
            await publishHiddenMonster(monster, state);
            return { proceed: false, spentTime: true };
        }
    }

    if ((monster.mundetected || monster.m_ap_type) && canSenseMonster(monster)) {
        monster.mundetected = 0;
        await wakeAttackedMonster(monster);
    }

    const confirm = state.flags?.confirm !== false;
    if (confirm && monster.mpeaceful && !heroIsImpaired(state)) {
        if (stormbringerOverridesConfirmation(weapon, state))
            return { proceed: true, spentTime: false, confirmationOverridden: true };
        if (canSpotMonster(monster)) {
            const paranoid = !!((state.flags?.paranoia_bits ?? 0)
                & PARANOID_HIT);
            const accepted = await paranoidQuery(
                paranoid, `Really attack ${monsterName(monster, { state })}?`,
                state.flags?.paranoia_bits ?? 0,
            );
            if (!accepted) {
                state.context.move = 0;
                return { proceed: false, spentTime: false };
            }
        }
    }

    return { proceed: true, spentTime: false };
}

// ─── C uhitm.c:check_caitiff()/first_weapon_hit() (from hero_attack_conduct.ts) ───

// C ref: uhitm.c check_caitiff().


// C uhitm.c:first_weapon_hit(). Player-given names are omitted from the
// conduct log; a recognized artifact keeps its native artifact name.
export function recordFirstHeroWeaponHit(weapon: GameObject, state: GameState = game): void {
    let name: string;
    const artifact = artifactById(weapon.oartifact, state);
    if (objectHasPersonalName(weapon, state)) {
        name = weapon.oextra?.oname || weapon.oname || artifact?.name || minimalObjectName(weapon, state);
    } else {
        name = minimalObjectName(weapon, state);
        if (weapon.quan !== 1) name = pluralizeObjectNoun(weapon, name);
        if (artifact && weapon.dknown)
            name += ` named ${artifact.name.replace(/^The /, '')}`;
    }
    if (weapon.cursed && weapon.bknown) name = `cursed ${name}`;
    recordGameLogEvent(`hit with a wielded weapon (${name}) for the first time`, { state, flags: LL_CONDUCT });
}

export async function applyCaitiffPenalty(monster: Monster, state: GameState = game): Promise<boolean> {
    const alignment = state.u.ualign;
    if (!alignment || alignment.record <= -10) return false;
    const helpless = !!monster.msleeping || !monster.mcanmove;
    const fleeingFromBehind = !!(monster.mflee && !monster.mavenge);
    const lawfulKnight = state.urole?.key === 'knight'
        && (state.u?.ualign?.type ?? 0) > 0;
    const undead = monsterIsUndead(monster.mnum);
    if (lawfulKnight && !undead && (helpless || fleeingFromBehind)) {
        await plineWithContinuation('You caitiff!');
    } else if (state.urole?.key === 'samurai' && monster.mpeaceful) {
        await plineWithContinuation('You dishonorably attack the innocent!');
    } else return false;
    adjustHeroAlignment(-1, state);
    return true;
}

// ─── C uhitm.c:find_roll_to_hit()/mon_maybe_unparalyze()/missum() (from hero_attack_accuracy.ts) ───

// Native uhitm.c:find_roll_to_hit(), mon_maybe_unparalyze(), and missum().


export async function findHeroMeleeHitThreshold(
    monster: Monster, method: AttackMethod, weapon: GameObject | null,
    { firstAttack, state = game }: { firstAttack: boolean; state?: GameState },
): Promise<{ threshold: number; armorPenalty: number }> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const species = heroSpecies(state);
    const luck = Luck(hero);
    let threshold = 1 + heroAttackBonus(state) + findMonsterArmorClass(monster)
        + (hero.uhitinc ?? 0) + Math.sign(luck) * Math.trunc((Math.abs(luck) + 2) / 3)
        + (polymorphed ? requireMonsterData(MONSTER_LEVEL, species) : hero.ulevel);
    let armorPenalty = 0;

    if (firstAttack) await applyCaitiffPenalty(monster, state);
    if (monster.mstun) threshold += 2;
    if (monster.mflee) threshold += 2;
    if (monster.msleeping) threshold += 2;
    if (!monster.mcanmove) threshold += 4;

    if (state.urole?.key === 'monk' && !polymorphed) {
        if (state.uarm || hero.uarm) {
            armorPenalty = state.urole.spellcasting.armor;
            threshold -= armorPenalty;
        } else if (!(state.uwep || hero.uwep) && !(state.uarms || hero.uarms)) {
            threshold += Math.trunc(hero.ulevel / 3) + 2;
        }
    }
    const elvenHero = polymorphed
        ? is_elf(species)
        : state.urace?.name === 'elf';
    if (elvenHero && is_orc(monster.mnum))
        threshold++;

    const burden = nearCapacity(state);
    if (burden) threshold -= burden * 2 - 1;
    if (hero.utrap) threshold -= 3;

    if (method === AT_WEAP || method === AT_CLAW) {
        if (weapon) threshold += weaponHitValue(weapon, monster, { state });
        threshold += weaponSkillHitBonus(weapon, state);
    } else if (method === AT_KICK && heroUsesMartialArts(state)) {
        threshold += weaponSkillHitBonus(null, state);
    }
    return { threshold, armorPenalty };
}
export function maybeUnparalyzeMeleeDefender(monster: Monster, random: RandomBelow = rn2): void {
    if (!monster.mcanmove && random(10) === 0) {
        monster.mcanmove = 1;
        monster.mfrozen = 0;
    }
}

export async function showHeroMeleeMiss(
    monster: Monster, attack: AttackTuple, wouldHaveHit: boolean,
    { state = game, publish = plineWithContinuation }: {
        state?: GameState; publish?: MessagePublisher;
    } = {},
): Promise<{ heroDied: boolean }> {
    requireLiveGame(state);
    if (wouldHaveHit) await publish('Your armor is rather cumbersome...');
    if (heroSeductionCompatibility(monster, attack, state)) {
        await publish(`You pretend to be friendly to ${monsterName(monster, { state })}.`);
    } else if (canSpotMonster(monster) && state.flags.verbose !== false) {
        await publish(`You miss ${monsterName(monster, { state })}.`);
    } else {
        await publish('You miss it.');
    }
    if (!monster.msleeping && monster.mcanmove) return wakeAttackedMonster(monster);
    return { heroDied: false };
}

// weapon.c's abon() lives in weapon.js (heroAttackBonus); its monster-form
// level reading is shared with dig.c.

// Await monmove.c m_move(), its post-move effects and messages as one call.
// Resolve that movement transaction before the hero tests its new position;
// no movement ration, dochug prelude, or dochug attack tail belongs here.
export async function moveMonsterForHeroAttack(
    monster: Monster, state: PlayingGameState = requireInitializedGame(),
): Promise<{ status: number; heroDied: boolean }> {
    requireLiveGame(state);
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    let action: MonsterMovementAction;
    try {
        action = await beginMonsterMove(monster, state);
    } finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
    let heroDied = await presentMonsterPostMove(action, state);
    if (!heroDied) heroDied = (await presentMonsterAttackEffects(action, state)).heroDied;
    if (!heroDied) await presentMonsterMoveMessage(action, state);
    const status = action.movement.postMoveStatus;
    if (status === undefined)
        throw new Error('Monster movement completed without its native movement result.');
    return { status, heroDied: heroDied || !!state.program_state.gameover };
}

// Hero melee command and ordinary hitum(). Monster forms own their attack slots.

const DIRECTIONS: readonly (readonly [number, number])[] = [
    [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1],
];
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const S_LEPRECHAUN = requireMonsterData(MONSTER_SYMBOL, MONSTER_NAME.indexOf('leprechaun'));

interface HeroAttackOptions {
    safeMonster?: boolean;
    // Applied tools already ran attack_checks() with the tool as their weapon.
    permission?: AppliedWeaponAttackPermission;
}

// C uhitm.c:do_attack().  Returns 'declined' for the one stop that spends
// no time — attack_checks()'s paranoid "Really attack?" refusal, its own
// context.move = 0 — so domove_core() can keep the turn unspent.  Every
// other stop, and any completed attack (death and life saving included),
// returns C's TRUE and spends the action; FALSE means the target yielded
// and the step continues through the move checks.
export async function do_attack(monster: Monster, x: number, y: number, {
    safeMonster = false, permission,
}: HeroAttackOptions = {}): Promise<boolean | 'declined'> {
    requirePlayingGame(game);
    if (safeMonster && !game.context.forcefight
        && artifactById(game.uwep?.oartifact, game)?.name !== 'Stormbringer') {
        // C uhitm.c:do_attack(): a tame monster normally yields to
        // the hero, and ordinary peacefuls share the same displacement path.
        // Only tame actors flee after refusal.
        const tame = !!(monster.pet || monster.mtame);
        const blocked = heroIsPunished() || rn2(7) === 0
            || (!!monster.wormno && ['baby long worm', 'long worm', 'long worm tail']
                .includes(MONSTER_NAME[monster.mnum] ?? ''))
            || (IS_OBSTRUCTED(requireGameLevel(game).requireAt(game.u.ux, game.u.uy).typ)
                && !monsterPassesWalls(monster.mnum));
        const inShop = !blocked && roomsAt(game.level, monster.mx, monster.my, SHOPBASE)
            .some(roomno => tendedShop(roomForRoomno(game.level, roomno), game));
        if ((blocked || inShop) && monster.isshk
            && !game.context.travel && !game.context.run) {
            // C returns ECMD_TIME | dopay(): the bump spends the action
            // even when dopay() buys nothing.
            await dopay();
            return true;
        }
        if ((blocked || inShop) && tame) {
            const flight = await makeMonsterFlee(monster, {
                turns: rnd(6), announce: false,
            });
            if (flight.heroDied) return true;
        }
        if (blocked || inShop) {
            // C uhitm.c do_attack(): y_monnam(), capitalized.
            const displayName = monsterName(monster, {
                state: game, article: 'your', capitalized: true,
            });
            await plineWithContinuation(`You stop.  ${displayName} is in the way!`);
            stopRun(game);
            return true;
        }
        if (monster.mfrozen || monster.msleeping || !monster.mcanmove
            || ((MONSTER_MOVE[monster.mnum] ?? 0) === 0 && rn2(6))) {
            await plineWithContinuation(`${monsterName(monster, { state: game, capitalized: true })} doesn't seem to move!`);
            stopRun(game);
            return true;
        }
        return false;
    }
    const verdict = permission ?? await prepareAppliedWeaponAttack(monster, game.uwep ?? null,
        { state: game, struckAt: { x, y } });
    if (!verdict.proceed) return verdict.spentTime ? true : 'declined';
    const confirmationOverridden = verdict.confirmationOverridden ?? false;
    atk_done: {
        game._heroMeleeThisCommand = true;
        if (Upolyd(game.u) && monsterHasNoAttacks(heroSpecies(game))) {
            await plineWithContinuation('You have no way to attack monsters physically.');
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
            break atk_done;
        }
        if (exceedsActionCapacity(game)) {
            await plineWithContinuation('You cannot fight while so heavily loaded.');
            break atk_done;
        }
        if (await checkHeroAttackOverexertion()) {
            break atk_done;
        }
        if (game.u.twoweap && !await canBeginTwoWeaponCombat(game))
            await stopTwoWeaponCombat(game);
        if (game._unweapon) {
            game._unweapon = false;
            if (game.flags.verbose !== false) {
                const weapon = primaryWeapon();
                if (weapon) {
                    observeObjectForNaming(weapon);
                    await pline(`You begin bashing monsters with ${ownedObjectName(weapon, game, { capitalized: false })}.`);
                } else if (!monsterHasNoHands(heroSpecies(game)) && !monsterIsVerySmall(heroSpecies(game))) {
                    const action = game.urole?.key === 'monk' ? 'striking' : 'bashing';
                    const covered = game.uarmg || game.u.uarmg ? 'gloved' : 'bare';
                    await pline(`You begin ${action} monsters with your ${covered} ${makePlural(heroHandName(game))}.`);
                }
            }
        }
        await exerciseAttribute(A_STR, true);
        wipeHeroEngraving(3);

        if (MONSTER_SYMBOL[monster.mnum] === S_LEPRECHAUN && !monster.mfrozen
            && !monsterIsHelpless(monster) && !monster.mconf && monster.mcansee && rn2(7) === 0) {
            const movement = await moveMonsterForHeroAttack(monster, game);
            if (movement.heroDied) return true;
            if (movement.status === MMOVE_DIED || monster.mx !== x || monster.my !== y) {
                await plineWithContinuation('You miss wildly and stumble forwards.');
                return false;
            }
        }

        if (Upolyd(game.u)) {
            await attackHeroInMonsterForm(monster, x, y, { confirmationOverridden });
        } else {
            const attack = requireMonsterData(MONSTER_ATTACKS, heroSpecies(game))[0];
            if (!attack) throw new Error('The hero species is missing its first attack.');
            await attackWithHumanForm(monster, x, y, attack, confirmationOverridden);
        }
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    }
    if (game.context.forcefight && !monster.dead && monster.mhp > 0
        && !canSpotMonster(monster) && !(game.u.uswallow && game.u.ustuck === monster)
        && game.level?.at(x, y)?.remembered_glyph?.kind !== 'invisible')
        await map_invisible(x, y);
    return true;
}

async function attackWithHumanForm(monster: Monster, x: number, y: number, attack: AttackTuple, confirmationOverridden: boolean): Promise<void> {
    requirePlayingGame(game);
    const weaponBefore = primaryWeapon();
    if (artifactById(weaponBefore?.oartifact)?.enumName === 'CLEAVER'
        && !game.u.twoweap && !game.u.uswallow && !game.u.ustuck
        && heroSpecies(game) !== PM_GRID_BUG) {
        await cleaveAroundTarget(x, y, attack);
        return;
    }
    const secondWeapon = game.u.twoweap ? secondaryWeapon() : null;
    const mortality = game.u.umortality ?? 0;
    const twoHits = (weaponBefore ? game.u.twoweap : doublePunch(game)) ? 1 : 0;
    const accuracy = await findHeroMeleeHitThreshold(monster, attack[0], primaryWeapon(), { firstAttack: true });
    maybeUnparalyzeMeleeDefender(monster);
    const dieRoll = rnd(20);
    const hit = accuracy.threshold > dieRoll;
    if (hit) await exerciseAttribute(A_DEX, true);
    const first = await resolveHeroWeaponHit(monster, x, y, primaryWeapon(), {
        attack, hit: hit || !!game.u.uswallow, ...accuracy, dieRoll, twoHits, confirmationOverridden,
    });
    if (first.heroDied) return;
    const weaponAfter = primaryWeapon();
    const passive = await applyHeroContactPassive(monster, {
        hit: first.hit, defenderSurvived: first.survived, attackType: AT_WEAP,
        weapon: weaponAfter, weaponWasDestroyed: !!weaponBefore && !weaponAfter,
    });
    if (passive.heroDied || !twoHits || confirmationOverridden || heroAttackInterrupted(mortality)
        || !first.survived || monsterAtPosition(game.level, x, y) !== monster) return;

    // Accuracy uses the current slot; hmon uses the object saved before the
    // first hit, matching hitum when the primary strike changes equipment.
    const secondAccuracy = await findHeroMeleeHitThreshold(monster, attack[0], secondaryWeapon(), { firstAttack: false });
    maybeUnparalyzeMeleeDefender(monster);
    const secondRoll = rnd(20);
    const second = await resolveHeroWeaponHit(monster, x, y, secondWeapon, {
        attack, hit: secondAccuracy.threshold > secondRoll || !!game.u.uswallow,
        ...secondAccuracy, dieRoll: secondRoll, twoHits: 2,
    });
    if (second.heroDied || !second.hit) return;
    await applyHeroContactPassive(monster, {
        hit: second.hit, defenderSurvived: second.survived, attackType: AT_WEAP,
        weapon: secondWeapon, weaponWasDestroyed: !!secondWeapon && !secondaryWeapon(),
    });
}

async function cleaveAroundTarget(targetX: number, targetY: number, attack: AttackTuple): Promise<void> {
    requirePlayingGame(game);
    const originX = game.u.ux;
    const originY = game.u.uy;
    const direction = DIRECTIONS.findIndex(([dx, dy]) =>
        dx === targetX - originX && dy === targetY - originY);
    if (direction < 0) throw new Error('Cleaver requires an adjacent target.');
    const mortality = game.u.umortality ?? 0;
    const clockwise = game._cleaveClockwise ?? false;
    for (const offset of clockwise ? [-1, 0, 1] : [1, 0, -1]) {
        const delta = DIRECTIONS[(direction + offset + DIRECTIONS.length) % DIRECTIONS.length];
        if (!delta) throw new Error('Cleaver direction is outside the compass.');
        const x = originX + delta[0];
        const y = originY + delta[1];
        if (!isok(x, y)) continue;
        const monster = monsterAtPosition(game.level, x, y);
        if (!monster) {
            await unmap_invisible(x, y);
            continue;
        }
        const accuracy = await findHeroMeleeHitThreshold(monster, attack[0], primaryWeapon(), { firstAttack: true });
        maybeUnparalyzeMeleeDefender(monster);
        const dieRoll = rnd(20);
        const result = await resolveHeroWeaponHit(monster, x, y, primaryWeapon(), {
            attack, hit: accuracy.threshold > dieRoll, ...accuracy, dieRoll, twoHits: 0,
        });
        if (result.heroDied) break;
        const weapon = primaryWeapon();
        const passive = await applyHeroContactPassive(monster, {
            hit: result.hit, defenderSurvived: !monster.dead && monster.mhp > 0,
            weapon, attackType: AT_WEAP, weaponWasDestroyed: !weapon,
        });
        if (passive.heroDied || !primaryWeapon() || heroAttackInterrupted(mortality)) break;
    }
    game._cleaveClockwise = !clockwise;
}

function heroAttackInterrupted(mortality: number): boolean {
    return !!game.program_state.gameover || (game.multi ?? 0) < 0
        || (game._helplessTurns ?? 0) > 0 || (game.u.umortality ?? 0) > mortality;
}

function primaryWeapon(): GameObject | null {
    return game.uwep || game.u.uwep || null;
}

function secondaryWeapon(): GameObject | null {
    return game.uswapwep || game.u.uswapwep || null;
}

// ─── C uhitm.c:known_hitum() (from hero_weapon_hit.ts) ───

// Native uhitm.c:known_hitum(). hmon owns damage; callers own turns/passives.

interface HeroWeaponHitOptions {
    attack: AttackTuple;
    hit: boolean;
    threshold: number;
    armorPenalty: number;
    dieRoll: number;
    twoHits: number;
    confirmationOverridden?: boolean;
}

export interface HeroWeaponHitResult {
    hit: boolean;
    survived: boolean;
    heroDied: boolean;
}

export async function resolveHeroWeaponHit(
    monster: Monster, x: number, y: number, weapon: GameObject | null,
    { attack, hit, threshold, armorPenalty, dieRoll, twoHits, confirmationOverridden = false }: HeroWeaponHitOptions,
): Promise<HeroWeaponHitResult> {
    requirePlayingGame(game);
    if (confirmationOverridden && game.flags.verbose)
        await plineWithContinuation('Your bloodthirsty blade attacks!');
    if (!hit) {
        const miss = await showHeroMeleeMiss(monster, attack, threshold + armorPenalty > dieRoll);
        return { hit: false, survived: true, heroDied: miss.heroDied };
    }
    const sliceOrChop = isBlade(weapon) || isAxe(weapon);
    const oldHitPoints = monster.mhp;
    const oldWeaponHits = game.u.uconduct.weaphit ?? 0;
    if (weapon && (weapon.oclass === WEAPON_CLASS || isWeaponTool(weapon)))
        game.u.uconduct.weaphit = oldWeaponHits + 1;
    const result = await hitMonsterWithHeroObject(monster, weapon, {
        mode: 'melee', dieRoll, twoHits, target: { x, y },
    });
    if (result.heroDied || !result.survived) return { ...result, hit: true };

    if (rn2(25) === 0 && monster.mhp < Math.trunc(monster.mhpmax / 2)
        && !(game.u.uswallow && game.u.ustuck === monster)) {
        const flight = await makeMonsterFlee(monster, { turns: rn2(3) === 0 ? rnd(100) : 0 });
        if (flight.heroDied) return { ...result, hit: true, heroDied: true };
        if (game.u.ustuck === monster && !game.u.uswallow && !monsterSpeciesSticks(game.u.umonnum)) {
            setHeroGrip(null);
        }
    }
    if (monster.mhp === oldHitPoints) {
        game.u.uconduct.weaphit = oldWeaponHits;
        return { ...result, hit: false };
    }
    if (monster.wormno) await cutWorm(monster, x, y, sliceOrChop);
    return { ...result, hit: true };
}

// ─── C uhitm.c:double_punch()/hmon_hitmon_barehands() (from barehand_combat.ts) ───

// Native uhitm.c:double_punch(), hmon_hitmon_barehands(), and damage bonuses.

export interface BarehandContact {
    damage: number;
    silverRings: boolean;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
}

export interface BarehandContactOptions {
    state?: GameState;
    twoHits?: number;
}

interface BarehandMessageOptions {
    state?: GameState;
}

function requiredHeroSkill(state: GameState, skill: number): HeroSkill {
    const entry = ensureHeroSkills(state)?.[skill];
    if (!entry) throw new Error(`Hero combat requires initialized skill ${skill}.`);
    return entry;
}

export function barehandSkill(state: GameState = game): number {
    return requiredHeroSkill(state, P_BARE_HANDED_COMBAT).skill;
}

export function heroUsesMartialArts(state: GameState = game): boolean {
    if (!state.urole) throw new Error('Hero combat requires a selected role.');
    return state.urole.key === 'monk' || state.urole.key === 'samurai';
}

export function doublePunch(state: GameState = game): boolean {
    const skill = barehandSkill(state);
    if (state.uwep || state.u.uwep || state.uarms || state.u.uarms || skill <= P_BASIC)
        return false;
    return skill - P_BASIC > rn2(5);
}

// twoHits is native hmd.twohits: 0 for a single attempt, otherwise its
// one-based position. Only the first two attempts can use exposed rings.
// C uhitm.c:hmon_hitmon_barehands().
export function prepareHeroBarehandContact(
    monster: Monster, { state = game, twoHits = 0 }: BarehandContactOptions = {},
): BarehandContact {
    const usesSkill = !monsterIsShade(monster);
    let damage = usesSkill ? rnd(heroUsesMartialArts(state) ? 4 : 2) : 0;
    const trainsSkill = damage > 1;
    const mask = state.uarmg || state.u.uarmg ? W_ARMG
        : ((twoHits === 0 || twoHits === 1 ? W_RINGR : 0)
            | (twoHits === 0 || twoHits === 2 ? W_RINGL : 0));
    const contact = specialContactDamage(state.u, monster, mask, { state });
    damage += contact.damage;
    return {
        damage, silverRings: !!(contact.silverMask & (W_RINGL | W_RINGR)),
        useWeaponSkill: usesSkill, trainWeaponSkill: trainsSkill,
    };
}

// hmon's silver feedback names the contact material without identifying rings.
export async function showBarehandSilverHit(
    monster: Monster, hit: Pick<BarehandContact, 'silverRings'> | null, { state = game }: BarehandMessageOptions = {},
): Promise<void> {
    if (!hit?.silverRings) return;
    const spotted = canSpotMonster(monster);
    let target = monsterName(monster, { state });
    if (!spotted) target = target.charAt(0).toUpperCase() + target.slice(1);
    if (!monsterIsNoncorporeal(monster) && !monsterIsAmorphous(monster))
        target = `${possessive(target)} flesh`;
    await plineWithContinuation(spotted
        ? `Your silver ring sears ${target}!` : `${target} is seared!`);
}

function possessive(noun: string): string {
    if (noun.toLowerCase() === 'it') return `${noun}s`;
    return noun.endsWith('s') ? `${noun}'` : `${noun}'s`;
}

// ─── C uhitm.c:hmon_hitmon_weapon()/_ranged()/backstabbable() (from hero_weapon_contact.ts) ───

// C uhitm.c:hmon_hitmon_weapon(), before artifact and damage-bonus handling.

interface HeroWeaponContactOptions {
    mode: HeroPhysicalAttackMode;
    dieRoll: number;
    state?: GameState;
    publish?: MessagePublisher;
}

export interface HeroWeaponContactResult {
    damage: number;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
    specialMessage: boolean;
    heroDied: boolean;
}

const S_BLOB = 2;

// C uhitm.c:hmon_hitmon_weapon_melee(): base damage, backstab, and weapon shattering.
// Also C uhitm.c:hmon_hitmon_weapon(): the normal/improvised weapon choice is inlined here.
export async function prepareHeroWeaponContact(
    monster: Monster, weapon: GameObject,
    { mode, dieRoll, state = game, publish = plineWithContinuation }: HeroWeaponContactOptions,
): Promise<HeroWeaponContactResult | null> {
    requirePlayingGame(state);
    if (weapon.oclass !== WEAPON_CLASS && weapon.oclass !== GEM_CLASS && !isWeaponTool(weapon))
        return null;
    if (isImprovisedContact(weapon, mode, state))
        return improvisedWeaponContact(monster, weapon, mode, state, publish);

    const result: HeroWeaponContactResult = {
        damage: rollPhysicalWeaponDamage(weapon, monster, { state }), useWeaponSkill: true,
        trainWeaponSkill: false, specialMessage: false, heroDied: false,
    };
    result.trainWeaponSkill = result.damage > 1;
    const handToHand = mode === 'melee'
        || (mode === 'applied' && isPolearm(state.uwep || state.u.uwep));
    if (state.urole.key === 'healer' && handToHand && weapon.oclass === WEAPON_CLASS
        && objectSkill(weapon.otyp) === P_KNIFE) {
        const vital = state.mvitals?.[monster.mnum];
        if (!vital) throw new Error(`Healer anatomy requires initialized vitals for species ${monster.mnum}.`);
        result.damage += Math.min(3, Math.trunc(vital.died / 6));
    }

    if (!result.trainWeaponSkill || monster === state.u.ustuck || state.u.twoweap
        || (handToHand && artifactById(weapon.oartifact, state)?.enumName === 'CLEAVER'))
        return result;
    if (state.urole.key === 'rogue' && !Upolyd(state.u) && handToHand && canBackstab(monster)) {
        await publish(`You strike ${monsterName(monster, { state })} from behind!`);
        result.damage += rnd(state.u.ulevel);
        result.specialMessage = true;
        return result;
    }
    const defenderWeapon = shatterCandidate(monster, weapon, dieRoll, state);
    if (!defenderWeapon) return result;
    const resistance = 50 + 15 * (greatestErosion(weapon) - greatestErosion(defenderWeapon));
    if (objectResistsDestruction(defenderWeapon, resistance, 100)) return result;

    await unwieldMonsterWeapon(monster, state, { weapon: defenderWeapon, publish });
    const subject = canSeeMonster(monster)
        ? ownedObjectAction(defenderWeapon, 'shatter', state)
        : `${possessiveName(monsterName(monster, { state, capitalized: true }))} weapon${
            objectQuantity(defenderWeapon) > 1 ? 's shatter' : ' shatters'}`;
    await publish(`${subject} from the force of your blow!`);
    await destroyObjectFromMonsterInventory(monster, defenderWeapon, state, { publish });
    if (state.program_state.gameover) return { ...result, heroDied: true };
    if (rn2(4)) {
        const flight = await makeMonsterFlee(monster, { state, turns: d(2, 3), first: true, publish });
        result.heroDied = flight.heroDied;
    }
    result.specialMessage = true;
    return result;
}

function isImprovisedContact(weapon: GameObject, mode: HeroPhysicalAttackMode, state: PlayingGameState): boolean {
    const skill = objectSkill(weapon.otyp) ?? P_NONE;
    const launcher = is_launcher(weapon);
    return launcher
        || (mode === 'melee' && (isMissileObject(weapon) || isLauncherAmmunition(weapon)))
        || (mode === 'melee' && !state.u.usteed && isPolearm(weapon)
            && artifactById(weapon.oartifact, state)?.enumName !== 'SNICKERSNEE')
        || (isLauncherAmmunition(weapon) && (mode !== 'thrown'
            || !launcherMatchesAmmo(weapon, state.uwep || state.u.uwep)));
}

// C uhitm.c:hmon_hitmon_weapon_ranged().
async function improvisedWeaponContact(
    monster: Monster, weapon: GameObject, mode: HeroPhysicalAttackMode,
    state: PlayingGameState, publish: MessagePublisher,
): Promise<HeroWeaponContactResult> {
    let damage = shadeBlocksWeaponBaseDamage(weapon, monster, state) ? 0 : rnd(2);
    if (objectMaterial(weapon, state) === SILVER && monsterHatesSilver(monster))
        damage += rnd(damage ? 20 : 10);
    let specialMessage = false;
    if (mode === 'melee' && weapon === (state.uwep || state.u.uwep)
        && weapon.otyp === BOOMERANG && rnl(4) === 3) {
        const stack = objectQuantity(weapon) > 1;
        await publish(`As you hit ${monsterName(monster, { state })}, ${stack ? 'one of ' : ''}${
            ownedObjectName(weapon, state, { capitalized: false })} breaks into splinters.`);
        if (!stack) await uwepgone(state);
        await consumeInventoryItem(weapon, state);
        specialMessage = true;
        if (!monsterIsShade(monster)) damage++;
    }
    return {
        damage, useWeaponSkill: false, trainWeaponSkill: false, specialMessage,
        heroDied: !!state.program_state.gameover,
    };
}

// C uhitm.c:backstabbable().
function canBackstab(monster: Monster): boolean {
    return !monsterIsAmorphous(monster) && !monsterIsWhirly(monster)
        && !monsterIsNoncorporeal(monster)
        && ![S_BLOB, S_EYE, S_FUNGUS].includes(MONSTER_SYMBOL[monster.mnum] ?? -1)
        && canSeeMonster(monster) && (!!monster.mflee || monsterIsHelpless(monster));
}

function shatterCandidate(
    monster: Monster, weapon: GameObject, dieRoll: number, state: PlayingGameState,
): GameObject | null {
    if (dieRoll !== 2 || weapon !== (state.uwep || state.u.uwep) || weapon.oclass !== WEAPON_CLASS)
        return null;
    const samuraiKatana = state.urole.key === 'samurai' && weapon.otyp === KATANA
        && !(state.uarms || state.u.uarms);
    if (!isBimanualObject(weapon) && !samuraiKatana) return null;
    const skill = Math.abs(objectSkill(weapon.otyp) ?? P_NONE);
    if (skill === P_NONE) return null;
    const proficiency = ensureHeroSkills(state)?.[skill];
    if (!proficiency) throw new Error(`Weapon shattering requires initialized skill ${skill}.`);
    if (proficiency.skill < P_SKILLED) return null;
    const defenderWeapon = monsterWieldedWeapon(monster);
    return defenderWeapon && !isFlimsyObject(defenderWeapon, state) ? defenderWeapon : null;
}

function greatestErosion(weapon: GameObject): number {
    return Math.max(weapon.oeroded ?? 0, weapon.oeroded2 ?? 0);
}

// ─── C uhitm.c:hmon_hitmon_potion()/_misc_obj()/shade_aware() (from hero_object_contact.ts) ───

// C uhitm.c:hmon_hitmon_potion() and hmon_hitmon_misc_obj(). This phase
// resolves the object's own effects; hmon owns bonuses and remaining damage.

export interface HeroObjectContactOptions {
    mode: HeroPhysicalAttackMode;
    state?: GameState;
    target?: Position;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    finishMonsterDeath?: FinishHeroMonsterDeath;
}

export interface HeroObjectContactEffects {
    damage: number;
    getDamageBonus: boolean;
    specialMessage: boolean;
    dryTowel: boolean;
    silverContact: boolean;
    objectConsumed: boolean;
    heroDied: boolean;
}

export type HeroObjectContactResult = HeroObjectContactEffects & (
    | { done: false; survived?: never }
    | { done: true; survived: boolean }
);

const VEGGY = 3;
const PAPER = 5;
const PHYSICAL_OBJECTS = new Set([BOULDER, HEAVY_IRON_BALL, IRON_CHAIN]);
const SHADE_AWARE_OBJECTS = new Set([...PHYSICAL_OBJECTS, MIRROR, CLOVE_OF_GARLIC]);

// C uhitm.c:hmon_hitmon_misc_obj()
// Also C uhitm.c:hmon_hitmon_potion(): the potion contact branch is inlined here.
export async function resolveHeroObjectContact(
    monster: Monster, object: GameObject, {
        mode, state = game, target = { x: monster.mx, y: monster.my },
        publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd,
        finishMonsterDeath = (victim, death) => finishHeroMonsterKillOutcome(victim, victim.mx, victim.my, death),
    }: HeroObjectContactOptions,
): Promise<HeroObjectContactResult> {
    requirePlayingGame(state);
    const contact: HeroObjectContactResult = {
        done: false, damage: 0, getDamageBonus: true, specialMessage: false,
        dryTowel: false, silverContact: false, objectConsumed: false, heroDied: false,
    };
    if (object.oclass === POTION_CLASS) {
        const potion = await detachContactPotion(object, state);
        const impact = await hitMonsterWithSupportedPotion({
            state, monster, potion, target, publish, finishKill: finishMonsterDeath,
            wakeMonster: wakeAttackedMonster,
            wakeNearby: (x, y, distance) => wakeMonstersNearWithMessages(x, y, distance, state, publish),
            resolveVapor: true,
            distance: dist2(state.u.ux, state.u.uy, monster.mx, monster.my),
        });
        if (!impact) throw new Error(`Potion contact has no effect owner for object type ${potion.otyp}`);
        contact.objectConsumed = consumedIdentity(object);
        contact.heroDied = !!impact.heroDied;
        if (contact.heroDied || monster.dead || monster.mhp <= 0)
            return { ...contact, done: true, survived: !monster.dead && monster.mhp > 0 };
        contact.damage = monsterIsShade(monster) ? 0 : 1;
        contact.specialMessage = true;
        return contact;
    }
    if (monsterIsShade(monster) && !objectCanTouchShade(object, state)) return contact;

    switch (object.otyp) {
    case BOULDER: case HEAVY_IRON_BALL: case IRON_CHAIN:
        contact.damage = rollPhysicalWeaponDamage(object, monster, { rollOne });
        break;
    case MIRROR:
        if (objectBreaksOnImpact(object, random)) {
            await publish(`You break ${ownedSimpleName(object, state)}.  That's bad luck!`);
            changeHeroLuck(-2, state);
            await consumeContactObject(object, state, false);
            contact.getDamageBonus = false;
            contact.specialMessage = true;
        }
        contact.damage = 1;
        break;
    case EXPENSIVE_CAMERA:
        await publish(`You succeed in destroying ${ownedSimpleName(object, state)}.  Congratulations!`);
        await releaseCameraDemon(object, state.u.ux, state.u.uy, { state, publish, random });
        await consumeContactObject(object, state, false);
        return {
            ...contact, done: true, survived: true,
            objectConsumed: consumedIdentity(object), heroDied: !!state.program_state.gameover,
        };
    case CORPSE:
        if (touchPetrifies(object.corpsenm)) {
            await publish(`You hit ${monsterName(monster, { state })} with ${corpseName(object, {
                definite: !!object.dknown, includeArticle: !object.dknown,
            })}.`);
            observeObject(object, state);
            contact.damage = 1;
            contact.specialMessage = true;
            const petrification = await petrifyMonsterFromContact(monster, {
                state, publish, rollOne, creditHero: true,
                finishDeath: (victim, death) => finishMonsterDeath(victim, {
                    ...death, showKillMessage: false, recordConduct: !death?.noCorpse,
                }),
            });
            if (petrification.heroDied) return { ...contact, done: true, survived: monster.mhp > 0, heroDied: true };
            if (!monsterHasStoneResistance(monster))
                return { ...contact, done: true, survived: petrification.survived };
        } else contact.damage = (object.corpsenm === undefined ? 0 : MONSTER_SIZE[object.corpsenm] ?? 0) + 1;
        break;
    case EGG:
        return resolveHeroEggHit(monster, object, { state, mode, publish, random, rollOne, finishMonsterKill: finishMonsterDeath });
    case CLOVE_OF_GARLIC:
        if (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster)) {
            const flight = await makeMonsterFlee(monster, { state, turns: rollDice(2, 4), publish, random, rollOne });
            if (flight.heroDied) return { ...contact, done: true, survived: monster.mhp > 0, heroDied: true };
        }
        contact.damage = 1;
        break;
    case CREAM_PIE: case BLINDING_VENOM: {
        monster.msleeping = 0;
        // C uhitm.c passes &gy.youmonst as magr: a raven hero cannot blind
        // another raven.
        const canBlind = monsterCanBeBlindedByObject(monster, object.otyp, {
            state,
            attackerSpecies: heroSpecies(state),
            heroInsideTarget: !!state.u.uswallow,
        });
        await publish(heroBlindingObjectHitMessage(monster, object, {
            canBlind, state, thrown: mode !== 'melee',
            describeTarget: () => monsterName(monster, { state }),
        }));
        await angerAttackedMonster(monster);
        if (state.program_state.gameover) return { ...contact, done: true, survived: monster.mhp > 0, heroDied: true };
        if (canBlind) applyMonsterBlindness(monster, random(25) + 21);
        await consumeContactObject(object, state, mode !== 'melee');
        contact.getDamageBonus = false;
        contact.specialMessage = true;
        break;
    }
    case ACID_VENOM:
        if (monsterHasAcidResistance(monster)) {
            await publish(`Your venom hits ${monsterName(monster, { state })} harmlessly.`);
        } else {
            await publish(`Your venom burns ${monsterName(monster, { state })}!`);
            contact.damage = rollPhysicalWeaponDamage(object, monster, { rollOne });
        }
        await consumeContactObject(object, state, mode !== 'melee');
        contact.getDamageBonus = false;
        contact.specialMessage = true;
        break;
    default: {
        const material = objectMaterial(object, state);
        if ((material === VEGGY || material === PAPER) && object.oclass !== SPBOOK_CLASS) {
            contact.getDamageBonus = false;
            break;
        }
        const range = Math.ceil(object.owt / 100);
        contact.damage = Math.min(6, range <= 1 ? 1 : rollOne(range));
        if (object.otyp === TOWEL && object.spe > 0) {
            contact.damage += object.spe * (MONSTER_NAME[monster.mnum] === 'iron golem' ? 2 : 1);
            contact.damage = rollOne(contact.damage);
            contact.dryTowel = random(object.spe + 1) > 0;
        }
        if (material === SILVER && monsterHatesSilver(monster)) {
            contact.damage += rollOne(20);
            contact.silverContact = true;
        }
        if (object.blessed && monsterHatesBlessings(monster)) contact.damage += rollOne(4);
        break;
    }
    }
    contact.objectConsumed = consumedIdentity(object);
    contact.heroDied = !!state.program_state.gameover;
    return contact;
}

// C uhitm.c:shade_aware().
export function objectCanTouchShade(object: GameObject | null | undefined, state: GameState = game): boolean {
    return !!object && (SHADE_AWARE_OBJECTS.has(object.otyp) || objectMaterial(object, state) === SILVER);
}

function consumedIdentity(object: GameObject): boolean {
    return object.where === 'gone' || object.where === 'onbill';
}

function ownedSimpleName(object: GameObject, state: GameState): string {
    const owner = carriedObjectOwner(object, state);
    const name = objectName(object, state, { minimal: true });
    return `${owner === 'Your' || owner === 'The' ? owner.toLowerCase() : owner} ${objectQuantity(object) === 1
        ? name : pluralizeObjectNoun(object, name)}`;
}

async function consumeContactObject(object: GameObject, state: GameState, all: boolean): Promise<void> {
    if (all) {
        await deleteObject(object, state);
    } else if (object.where === 'inventory') {
        await consumeInventoryItem(object, state);
    } else if (objectQuantity(object) > 1) {
        object.quan = object.quantity = objectQuantity(object) - 1;
        object.owt = objectWeight(object);
    } else await deleteObject(object, state);
}

async function detachContactPotion(object: GameObject, state: GameState): Promise<GameObject> {
    let potion = object;
    if (objectQuantity(object) > 1) {
        const split = splitObjectStack(object, 1, state);
        if (!split) throw new Error('Potion contact could not separate one bottle');
        potion = split;
    // C uhitm.c:hmon_hitmon_potion() unwields the last bottle through
    // setuwep(0) before freeinv().
    } else await setPrimaryWeapon(null, state);
    if (potion.where === 'inventory') await freeInventoryObject(potion, state);
    else unlinkObject(potion, state);
    potion.invlet = null;
    return potion;
}

// ─── C uhitm.c:hmon_hitmon_dmg_recalc() (from hero_physical_damage.ts) ───

// Native uhitm.c:hmon_hitmon_dmg_recalc() and weapon.c:weapon_dam_bonus().

interface HeroPhysicalDamageOptions {
    mode: HeroPhysicalAttackMode;
    twoHits: number;
    getDamageBonus: boolean;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
    state?: GameState;
}

// The hmon caller enters this stage only after positive contact damage.
// Zero-damage shade contacts keep their separate admission and message rules.
export async function recalculateHeroPhysicalDamage(
    damage: number, object: GameObject | null, {
        mode, twoHits, getDamageBonus, useWeaponSkill, trainWeaponSkill,
        state = game,
    }: HeroPhysicalDamageOptions,
): Promise<number> {
    requireLiveGame(state);
    const primary = state.uwep || state.u.uwep || null;
    const launched = launcherMatchesAmmo(object, primary);
    let bonus = 0;
    if (getDamageBonus) {
        bonus = state.u.udaminc ?? 0;
        if (mode !== 'thrown' || !launched) {
            let strength = heroStrengthDamageBonus(state);
            const magnitude = Math.abs(strength);
            if (twoHits) strength = Math.trunc((3 * magnitude + 2) / 4) * Math.sign(strength);
            else if (mode === 'melee' && isBimanualObject(primary))
                strength = Math.trunc((3 * magnitude + 1) / 2) * Math.sign(strength);
            bonus += strength;
        }
    }

    if (useWeaponSkill) {
        const skillWeapon = launched ? primary : object;
        bonus += weaponSkillDamageBonus(skillWeapon, state);
        if (trainWeaponSkill) {
            const skill = mode !== 'melee' ? weaponSkillType(skillWeapon)
                : state.u.twoweap ? P_TWO_WEAPON_COMBAT : weaponSkillType(primary);
            await useHeroSkill(skill, 1, { state });
        }
    }
    return Math.max(1, damage + bonus);
}

// ─── C uhitm.c:hmon_hitmon_poison() (from hero_weapon_poison.ts) ───

// Poison applied by the hero's weapon.
// C ref: uhitm.c hmon_hitmon_poison().

export interface HeroWeaponPoisonOptions {
    state?: GameState;
    mode: HeroPhysicalAttackMode;
    dieRoll: number;
    publish: MessagePublisher;
    random?: (range: number) => number;
    rollOne?: (sides: number) => number;
}

export interface HeroWeaponPoisonResult {
    damage: number;
    deadly: boolean;
    resisted: boolean;
    woreOff: boolean;
}

function hitUsesPoison(
    weapon: GameObject, mode: HeroWeaponPoisonOptions['mode'], dieRoll: number,
) {
    const poisonedMissile = mode === 'thrown' && weapon.opoisoned
        && (isLauncherAmmunition(weapon) || isMissileObject(weapon))
        && isPoisonableObject(weapon);
    const permanentPoison = isPermanentlyPoisonedObject(weapon)
        && dieRoll <= 5;
    return poisonedMissile || permanentPoison;
}

// C uhitm.c:hmon_hitmon_poison().
export async function resolveHeroWeaponPoison(monster: Monster, weapon: GameObject, {
    state = game,
    mode,
    dieRoll,
    publish,
    random = rn2,
    rollOne = rnd,
}: HeroWeaponPoisonOptions): Promise<HeroWeaponPoisonResult | null> {
    if (!hitUsesPoison(weapon, mode, dieRoll)) return null;

    if (state.urole?.key === 'samurai') {
        await publish('You dishonorably use a poisoned weapon!');
        adjustHeroAlignment(-Math.sign(state.u?.ualign?.type ?? 0), state);
    } else if (state.u?.ualign?.type === A_LAWFUL
        && (state.u.ualign.record ?? 0) > -10) {
        await publish(
            formatFeltMessage('like an evil coward for using a poisoned weapon.', state),
        );
        adjustHeroAlignment(-1, state);
    }

    const permanent = isPermanentlyPoisonedObject(weapon);
    const wearOffChance = Math.max(
        2, 10 - Math.trunc((weapon.owt ?? 0) / 10),
    );
    const woreOff = !permanent && random(wearOffChance) === 0;
    if (woreOff) weapon.opoisoned = false;

    if (monsterHasPoisonResistance(monster)) {
        return { damage: 0, deadly: false, resisted: true, woreOff };
    }
    if (random(10) !== 0) {
        return {
            damage: rollOne(6), deadly: false, resisted: false, woreOff,
        };
    }
    return { damage: 0, deadly: true, resisted: false, woreOff };
}

// ─── C uhitm.c:joust()/hmon_hitmon_jousting()/mhurtle_to_doom()/hmon_hitmon_splitmon() (from hero_weapon_impact.ts) ───

// Native uhitm.c:joust(), hmon_hitmon_jousting(), and hmon_hitmon_splitmon().

const PM_BLACK_PUDDING = MONSTER_NAME.indexOf('black pudding');
const PM_BROWN_PUDDING = MONSTER_NAME.indexOf('brown pudding');

// The contact owner admits only mounted, positive-damage melee lance hits
// against an unheld target. These are the remaining native joust() checks.
export function rollHeroJoust(
    monster: Monster, weapon: GameObject, { state = game }: { state?: GameState } = {},
): -1 | 0 | 1 {
    requirePlayingGame(state);
    const hero = state.u;
    if (hero.fumbling || (hero.fumblingTurns ?? 0) > 0
        || hero.stunned || (hero.stunnedTurns ?? 0) > 0 || hero.utrap) return 0;
    const primary = state.uwep || hero.uwep;
    const secondary = state.uswapwep || hero.uswapwep;
    if (weapon !== primary && (weapon !== secondary || !hero.twoweap)) return 0;
    const skills = ensureHeroSkills(state);
    let rating = skills?.[Math.abs(objectSkill(weapon.otyp))]?.skill ?? P_ISRESTRICTED;
    if (hero.twoweap)
        rating = Math.min(rating, skills?.[P_TWO_WEAPON_COMBAT]?.skill ?? P_ISRESTRICTED);
    if (rating === P_ISRESTRICTED) rating = P_UNSKILLED;
    const roll = rn2(5);
    if (roll >= rating) return 0;
    if (roll === 0 && rnl(50) === 49 && !monsterIsUnsolid(monster)
        && !objectResistsDestruction(weapon, 0, 100)) return -1;
    return 1;
}

interface JoustImpactOptions {
    damage: number;
    joust: 1 | -1;
    state?: GameState;
    publish?: MessagePublisher;
}

export interface HeroJoustImpact {
    damage: number;
    alreadyKilled: boolean;
    heroDied: boolean;
    specialMessage: true;
    weapon: GameObject | null;
}

// C uhitm.c:hmon_hitmon_jousting().
// C uhitm.c:mhurtle_to_doom().
export async function resolveHeroJoust(
    monster: Monster, weapon: GameObject,
    { damage, joust, state = game, publish = plineWithContinuation }: JoustImpactOptions,
): Promise<HeroJoustImpact> {
    requirePlayingGame(state);
    damage += d(2, weapon === (state.uwep || state.u.uwep) ? 10 : 2);
    const punctuation = canSeeMonster(monster) ? damage < 0 ? '?' : damage <= 4 ? '.' : '!' : '.';
    await publish(`You joust ${monsterName(monster, { state })}${punctuation}`);
    if ((state.u.uconduct.weaphit ?? 0) <= 1) recordFirstHeroWeaponHit(weapon, state);

    let survivingWeapon: GameObject | null = weapon;
    if (joust < 0) {
        setTwoWeaponCombat(false, state);
        if (weapon === (state.uwep || state.u.uwep)) await uwepgone(state);
        await publish(`${ownedObjectName(weapon, state)} shatters on impact!`);
        await consumeInventoryItem(weapon, state);
        // Even when a stack retains another lance, this impact has none.
        survivingWeapon = null;
    }
    let alreadyKilled = false;
    let heroDied = false;
    if (damage < monster.mhp) {
        const movement = await hurtleMonster(monster, state.u.dx ?? 0, state.u.dy ?? 0, 1, {
            state, announce: publish,
            nameMonster: target => monsterName(target, { state }),
            finishMonsterDeath: (target, options) =>
                finishHeroMonsterKillOutcome(target, target.mx, target.my, { ...options, publish }),
            finishLiquidDeath: (target, options) => finishHeroLiquidMonsterDeath(target, options),
        });
        alreadyKilled = !!monster.dead || monster.mhp <= 0;
        heroDied = !!movement.heroDied || !!state.program_state.gameover;
    }
    return { damage, alreadyKilled, heroDied, specialMessage: true, weapon: survivingWeapon };
}

interface PuddingImpactOptions {
    handToHand: boolean;
    material: number;
    offMap: boolean;
    state?: GameState;
    publish?: MessagePublisher;
}

// C uhitm.c:hmon_hitmon_splitmon().
export async function tryHeroPuddingSplit(
    monster: Monster, weapon: GameObject | null,
    { handToHand, material, offMap, state = game, publish = plineWithContinuation }: PuddingImpactOptions,
): Promise<{ split: boolean; heroDied: boolean }> {
    requirePlayingGame(state);
    if ((monster.mnum !== PM_BLACK_PUDDING && monster.mnum !== PM_BROWN_PUDDING)
        || monster.mhp <= 1 || monster.mcan || offMap || !weapon || !handToHand
        || (weapon !== (state.uwep || state.u.uwep)
            && (!state.u.twoweap || weapon !== (state.uswapwep || state.u.uswapwep)))
        || (material !== IRON && material !== METAL)
        || isLauncherAmmunition(weapon) || isMissileObject(weapon))
        return { split: false, heroDied: false };

    const clone = await cloneMonster(monster, state);
    if (!clone) return { split: false, heroDied: false };
    const withWhat = state.u.twoweap && state.flags.verbose
        ? ` with ${ownedObjectName(weapon, state, { capitalized: false })}` : '';
    await publish(`${monsterName(monster, { state, capitalized: true })} divides as you hit it${withWhat}!`);
    await mintrap(clone, state, { publish });
    return { split: true, heroDied: !!state.program_state.gameover };
}

// ─── C uhitm.c:hmon_hitmon_msg_hit()/_msg_silver()/_msg_lightobj()/shade_miss() (from hero_physical_messages.ts) ───

// Native uhitm.c:hmon_hitmon_msg_hit(), msg_silver(), msg_lightobj(),
// shade_miss(), and the deferred poison-wearing-off message.

interface PhysicalMessageOptions {
    state?: GameState;
    publish?: MessagePublisher;
}

interface PhysicalHitMessageOptions extends PhysicalMessageOptions {
    mode: HeroPhysicalAttackMode;
    damage: number;
    destroyed: boolean;
    hitTextShown: boolean;
    target?: Position;
    volley?: HeroProjectileVolley;
}

interface ProjectileMessageOptions extends PhysicalMessageOptions {
    target?: Position;
    volley?: HeroProjectileVolley;
}

interface PhysicalSearingOptions extends PhysicalMessageOptions {
    // hmon's mdat: captured before contact, then updated by any hurtle.
    originalSpecies: number;
    savedObjectName: string;
}

interface PhysicalSilverOptions extends PhysicalSearingOptions {
    silverObject: boolean;
    silverRings: number;
}

interface ShadeMissOptions extends PhysicalMessageOptions {
    thrown?: boolean;
    verbose?: boolean;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
}

export function captureHeroPhysicalObjectName(object: GameObject, state: GameState = game): string {
    if (artifactEmitsLight(object) && object.lamplit && object.oartifact) {
        const artifact = artifactById(object.oartifact, state);
        if (!artifact) throw new RangeError(`Unknown light artifact ${object.oartifact}`);
        return artifact.name.replace(/^The /u, 'the ');
    }
    return objectCombatName(object, { state });
}

// Capture after clearing poison and before a death can merge/delete the object.
export function captureUnpoisonedPhysicalObjectName(object: GameObject, state: GameState = game): string {
    return objectCombatName(object, { state });
}

export function captureHeroProjectileName(
    object: GameObject, state: GameState = game, volley?: HeroProjectileVolley,
): string {
    const name = objectCombatName(object, { state, includeCorpseSpecies: false });
    return volley && volley.count > 1 && volley.objectType === object.otyp
        ? `the ${volley.index}${ordinalSuffix(volley.index)} ${name}` : name;
}

// C uhitm.c:hmon_hitmon_msg_hit().
export async function showHeroPhysicalHit(monster: Monster, object: GameObject | null, {
    state = game, publish = plineWithContinuation, mode, damage, destroyed, hitTextShown,
    target = { x: monster.mx, y: monster.my }, volley,
}: PhysicalHitMessageOptions): Promise<boolean> {
    if (hitTextShown) return false;
    const ranged = mode !== 'melee';
    const volleyHit = ranged && object && volley && volley.count > 1 && volley.objectType === object.otyp;
    if (destroyed && !volleyHit) return false;
    if (ranged) {
        if (!object) throw new Error('A ranged physical hit needs its object for feedback');
        const name = captureHeroProjectileName(object, state, volley);
        await publish(rayHitMessage(name, monster, { ...target, state, damage }));
    } else if (!state.flags.verbose) {
        await publish('You hit it.');
    } else {
        const verb = object && (armorSlotFor(object.otyp) === 'uarms' || object.otyp === HEAVY_IRON_BALL)
            ? 'bash' : object && (objectSkill(object.otyp) === P_WHIP || object.otyp === TOWEL && object.spe > 0)
                ? 'lash' : state.urole?.key === 'barbarian' ? 'smite' : 'hit';
        const punctuation = canSeeMonster(monster) ? damagePunctuation(damage) : '.';
        await publish(`You ${verb} ${monsterName(monster, { state })}${punctuation}`);
    }
    return true;
}

export async function showHeroHarmlessStoneHit(monster: Monster, object: GameObject, {
    state = game, publish = plineWithContinuation, volley,
    target = { x: monster.mx, y: monster.my },
}: ProjectileMessageOptions = {}): Promise<void> {
    const name = captureHeroProjectileName(object, state, volley);
    await publish(rayHitMessage(name, monster, { ...target, state, ending: ' but does no harm.' }));
}

// C uhitm.c:hmon_hitmon_msg_silver().
export async function showHeroPhysicalSilver(monster: Monster, {
    state = game, publish = plineWithContinuation, originalSpecies, savedObjectName, silverObject, silverRings,
}: PhysicalSilverOptions): Promise<void> {
    const whom = searedTarget(monster, originalSpecies, state);
    if (!canSpotMonster(monster)) {
        await publish(`${upstart(whom)} is seared!`);
    } else if (silverRings === 1) {
        await publish(`Your silver ring sears ${whom}!`);
    } else if (silverRings === 2) {
        await publish(`Your silver rings sear ${whom}!`);
    } else if (silverObject && savedObjectName) {
        const silver = /silver/iu.test(savedObjectName) ? '' : 'silver ';
        await publish(`Your ${silver}${savedObjectName} ${verbForSubject(savedObjectName, 'sear')} ${whom}!`);
    } else await publish(`The silver sears ${whom}!`);
}

// C uhitm.c:hmon_hitmon_msg_lightobj().
export async function showHeroPhysicalLight(monster: Monster, {
    state = game, publish = plineWithContinuation, originalSpecies, savedObjectName,
}: PhysicalSearingOptions): Promise<void> {
    const whom = searedTarget(monster, originalSpecies, state);
    if (!canSpotMonster(monster)) await publish(`${upstart(whom)} is seared!`);
    else if (savedObjectName)
        await publish(`${possessiveName(savedObjectName)} radiance penetrates deep into ${whom}!`);
    else await publish(`The light sears ${whom}!`);
}

export async function showHeroPhysicalPoisonWoreOff(savedName: string, {
    publish = plineWithContinuation,
}: PhysicalMessageOptions = {}): Promise<void> {
    await publish(`Your ${savedName} ${verbForSubject(savedName, 'are')} no longer poisoned.`);
}

export async function showHeroShadeMiss(monster: Monster, object: GameObject | null, {
    state = game, publish = plineWithContinuation, thrown = false, verbose = true, rollOne = rnd, rollDice = d,
}: ShadeMissOptions = {}): Promise<boolean> {
    if (!monsterIsShade(monster)
        || object && rollPhysicalWeaponDamage(object, monster, { state, rollOne, rollDice }) !== 0) return false;
    const adjacent = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 <= 2;
    if (verbose && (cansee(monster.mx, monster.my) || canSenseMonster(monster) || adjacent)) {
        const what = !object || objectCanTouchShade(object, state) ? 'attack' : objectCombatName(object, { state });
        const target = monsterName(monster, { state });
        const subject = thrown ? capitalizedDefiniteName(what, state) : `Your ${what}`;
        await publish(`${subject} ${verbForSubject(what, 'pass')} harmlessly through ${target}.`);
        if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
    }
    monster.msleeping = 0;
    return true;
}

function searedTarget(monster: Monster, originalSpecies: number, state: GameState): string {
    const name = monsterName(monster, { state });
    const original = { mnum: originalSpecies };
    return monsterIsNoncorporeal(original) || monsterIsAmorphous(original)
        ? name : `${possessiveName(name)} flesh`;
}

function damagePunctuation(damage: number): string {
    return damage < 0 ? '?' : damage <= 4 ? '.' : '!';
}

// ─── C uhitm.c:hmon() aftermath (from hero_hit_aftermath.ts) ───

// C uhitm.c:hmon(): reactions after the hit and any resulting monster death.

// Capture before damage or wakeup changes peacefulness, species, or residency.
export function shouldAngerGuardsAfterHeroHit(monster: Monster): boolean {
    return !!monster.mpeaceful
        && !!(monster.ispriest || monster.isshk || isWatch(monster));
}

export async function finishHeroHitAftermath(monster: Monster, {
    angerGuards, state = game, publish = plineWithContinuation, random = rn2,
}: {
    angerGuards: boolean;
    state?: GameState;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
}): Promise<{ heroDied: boolean }> {
    requireLiveGame(state);
    if (state.program_state.gameover) return { heroDied: true };
    // This is independent of wakeup's peaceful-priest response and still
    // applies when the hit has killed the priest or changed its attitude.
    if (monster.ispriest && random(2) === 0) {
        const retaliation = await ghodHitsu(monster, { state, publish });
        if (retaliation.heroDied) return retaliation;
    }
    if (angerGuards) await angerWatchGuards(heroIsDeaf(state), { state, publish });
    return { heroDied: false };
}

// ─── C uhitm.c:hmon() (from hero_physical_hit.ts) ───

// Native uhitm.c:hmon(). Callers own accuracy, flight, turns, and passives.

interface ActivePhysicalHit extends Omit<HeroPhysicalHitOptions, 'state' | 'publish' | 'finishMonsterDeath' | 'twoHits' | 'target'> {
    state: PlayingGameState;
    publish: MessagePublisher;
    finishMonsterDeath: FinishHeroMonsterDeath;
    twoHits: number;
    target: Position;
}

interface PhysicalStrike {
    object: GameObject | null;
    damage: number;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
    getDamageBonus: boolean;
    hitTextShown: boolean;
    dryTowel: boolean;
    silverContact: boolean;
    silverObject: boolean;
    silverRings: number;
    lightContact: boolean;
    originalSpecies: number;
    material: number;
    savedObjectName: string;
    joust: -1 | 0 | 1;
    canUseWeaponPoison: boolean;
}

type PhysicalBodyResult = Pick<HeroPhysicalHitResult, 'survived' | 'heroDied'>;
type PreparedContact = { kind: 'strike'; strike: PhysicalStrike }
    | { kind: 'finished'; outcome: PhysicalBodyResult };

const GEMSTONE = 20;
const MINERAL = 21;

export async function hitMonsterWithHeroObject(
    monster: Monster, object: GameObject | null, options: HeroPhysicalHitOptions,
): Promise<HeroPhysicalHitResult> {
    const state = options.state ?? game;
    requirePlayingGame(state);
    const publish = options.publish ?? plineWithContinuation;
    const context: ActivePhysicalHit = {
        ...options, state, publish,
        target: options.target ?? { x: monster.mx, y: monster.my },
        twoHits: options.mode === 'melee' ? options.twoHits ?? 0 : 0,
        finishMonsterDeath: options.finishMonsterDeath
            ?? ((victim, death) => finishHeroMonsterKillOutcome(victim, victim.mx, victim.my, { ...death, publish })),
    };
    const angerGuards = shouldAngerGuardsAfterHeroHit(monster);
    const body = await resolvePhysicalHit(monster, object, context);
    const aftermath = body.heroDied ? body
        : await finishHeroHitAftermath(monster, { angerGuards, state, publish });
    return {
        survived: body.survived, heroDied: aftermath.heroDied,
        objectConsumed: object?.where === 'gone' || object?.where === 'onbill',
    };
}

// C uhitm.c:hmon_hitmon()
async function resolvePhysicalHit(
    monster: Monster, originalObject: GameObject | null, context: ActivePhysicalHit,
): Promise<PhysicalBodyResult> {
    const { state, mode, publish, finishMonsterDeath } = context;
    const handToHand = mode === 'melee'
        || (mode === 'applied' && isPolearm(state.uwep || state.u.uwep));
    const unarmed = !(state.uwep || state.u.uwep || state.uarm || state.u.uarm || state.uarms || state.u.uarms);
    const prepared = await preparePhysicalContact(monster, originalObject, context);
    if (prepared.kind === 'finished') return prepared.outcome;
    const strike = prepared.strike;
    if (strike.damage > 0) strike.damage = await recalculateHeroPhysicalDamage(strike.damage, strike.object, {
        ...context, getDamageBonus: strike.getDamageBonus,
        useWeaponSkill: strike.useWeaponSkill, trainWeaponSkill: strike.trainWeaponSkill,
    });
    const poison = strike.canUseWeaponPoison && strike.object
        ? await resolveHeroWeaponPoison(monster, strike.object, { ...context }) : null;
    if (poison) strike.damage += poison.damage;
    if (strike.damage < 1) {
        const shade = monsterIsShade(monster);
        strike.damage = strike.getDamageBonus && !shade ? 1 : 0;
        if (shade && !strike.hitTextShown && mode !== 'thrown' && mode !== 'kicked')
            strike.hitTextShown = await showHeroShadeMiss(monster, strike.object, { state, publish });
    }

    let alreadyKilled = false;
    let maybeKnockback = false;
    if (strike.joust && strike.object) {
        const impact = await resolveHeroJoust(monster, strike.object, {
            damage: strike.damage, joust: strike.joust, state, publish,
        });
        if (impact.heroDied) return { survived: monster.mhp > 0, heroDied: true };
        strike.damage = impact.damage;
        strike.object = impact.weapon;
        strike.originalSpecies = monster.mnum;
        strike.hitTextShown = true;
        alreadyKilled = impact.alreadyKilled;
    } else if (unarmed && strike.damage > 1 && mode === 'melee' && !strike.object && !Upolyd(state.u)) {
        const stagger = await tryUnarmedStagger(monster, {
            skill: barehandSkill(state), damage: strike.damage,
            dx: state.u.dx ?? context.target.x - state.u.ux,
            dy: state.u.dy ?? context.target.y - state.u.uy,
            state, announce: publish,
            nameMonster: victim => monsterName(victim, { state, capitalized: true }),
            wakeMonster: () => wakeAttackedMonster(monster),
            finishMonsterDeath,
            finishLiquidDeath: (victim, death) => finishHeroLiquidMonsterDeath(victim, death),
        });
        if (stagger.heroDied) return { survived: monster.mhp > 0, heroDied: true };
        if (stagger.staggered) {
            strike.originalSpecies = monster.mnum;
            strike.hitTextShown = true;
        }
        alreadyKilled = !!stagger.dead;
    } else if (!unarmed && strike.damage > 1 && mode === 'melee' && !Upolyd(state.u)
        && !state.u.twoweap && (state.uwep || state.u.uwep)) maybeKnockback = true;

    if (!alreadyKilled) {
        if (shouldLogWeaponHit(strike, context)) recordFirstHeroWeaponHit(strike.object, state);
        monster.mhp -= strike.damage;
    }
    monster.mhp = Math.min(monster.mhp, monster.mhpmax);
    const offMap = monster.mx === 0;
    let destroyed = monster.mhp <= 0;
    const abuse = await abusePetAfterHeroHit(monster, strike.damage, state);
    if (abuse.heroDied) return { survived: !destroyed, heroDied: true };
    const split = await tryHeroPuddingSplit(monster, strike.object, {
        handToHand, material: strike.material, offMap, state, publish,
    });
    if (split.heroDied) return { survived: !destroyed, heroDied: true };
    strike.hitTextShown ||= split.split;
    await showHeroPhysicalHit(monster, strike.object, {
        ...context, damage: strike.damage, destroyed, hitTextShown: strike.hitTextShown,
    });
    if (strike.dryTowel) {
        if (!strike.object) throw new Error('A drying contact must retain its towel');
        await dryTowel(strike.object, -1, { state, verbose: true });
    }
    if (strike.silverContact) await showHeroPhysicalSilver(monster, { ...strike, state, publish });
    if (strike.lightContact) await showHeroPhysicalLight(monster, { ...strike, state, publish });
    const unpoisonedName = poison?.woreOff && strike.object
        ? captureUnpoisonedPhysicalObjectName(strike.object, state) : null;
    if (poison?.resisted)
        await publish(`The poison doesn't seem to affect ${monsterName(monster, { state })}.`);
    if (poison?.deadly) {
        await publish('The poison was deadly...');
        if (!alreadyKilled && (await finishMonsterDeath(monster, { showKillMessage: false })).heroDied)
            return { survived: false, heroDied: true };
        destroyed = true;
    } else if (destroyed) {
        if (!alreadyKilled) {
            const death = await finishMonsterDeath(monster, {
                noRevive: MONSTER_SYMBOL[monster.mnum] === S_TROLL
                    && artifactById(strike.object?.oartifact, state)?.enumName === 'TROLLSBANE',
                zombifyCorpse: !originalObject && isZombieMaker(state.u.umonnum, state.u.mcan),
            });
            if (death.heroDied) return { survived: false, heroDied: true };
        }
    } else if (state.u.umconf && handToHand) await confuseTouchedMonster(monster, { state });
    if (unpoisonedName) await showHeroPhysicalPoisonWoreOff(unpoisonedName, { state, publish });
    if (!destroyed && !offMap) {
        if ((await wakeAttackedMonster(monster)).heroDied) return { survived: true, heroDied: true };
        if (maybeKnockback) {
            const attack = requireMonsterData(MONSTER_ATTACKS, heroSpecies(state))[0];
            if (!attack) throw new Error('Hero knockback requires the first species attack');
            const impact = await mhitm_knockback(state.u, monster, { attackType: attack[0], damageType: attack[1] }, {
                state, publish, weaponUsed: true,
                nameMonster: victim => monsterName(victim, { state }),
                wakeDefender: () => wakeAttackedMonster(monster),
                finishMonsterDeath,
                finishLiquidDeath: (victim, death) => finishHeroLiquidMonsterDeath(victim, death),
            });
            if (impact.heroDied) return { survived: !impact.defenderDied, heroDied: true };
            destroyed = !!impact.defenderDied;
        }
    }
    return { survived: !destroyed, heroDied: false };
}

// C uhitm.c:hmon_hitmon_do_hit()
// Also C uhitm.c:hmon_hitmon_weapon_melee(): artifact, silver, light, jousting, and ammunition effects.
async function preparePhysicalContact(
    monster: Monster, object: GameObject | null, context: ActivePhysicalHit,
): Promise<PreparedContact> {
    const { state, publish, mode, dieRoll } = context;
    const material = object ? objectMaterial(object, state) : 0;
    if (object && (mode === 'thrown' || mode === 'kicked') && object.oclass !== RING_CLASS
        && (material === GEMSTONE || material === MINERAL)
        && (monsterPassesWalls(monster.mnum)) && !monsterIsUnsolid(monster)) {
        await showHeroHarmlessStoneHit(monster, object, { ...context });
        const wake = await wakeAttackedMonster(monster);
        return { kind: 'finished', outcome: { survived: true, heroDied: wake.heroDied } };
    }
    const strike: PhysicalStrike = {
        object, damage: 0, useWeaponSkill: false, trainWeaponSkill: false,
        getDamageBonus: true, hitTextShown: false, dryTowel: false,
        silverContact: false, silverObject: false, silverRings: 0, lightContact: false,
        originalSpecies: monster.mnum, material,
        savedObjectName: object ? captureHeroPhysicalObjectName(object, state) : '',
        joust: 0, canUseWeaponPoison: false,
    };
    if (!object) {
        const contact = prepareHeroBarehandContact(monster, { state, twoHits: context.twoHits });
        strike.damage = contact.damage;
        strike.useWeaponSkill = contact.useWeaponSkill;
        strike.trainWeaponSkill = contact.trainWeaponSkill;
        strike.silverRings = Number(contact.silverRings);
        strike.silverContact = contact.silverRings;
        return { kind: 'strike', strike };
    }
    const weapon = await prepareHeroWeaponContact(monster, object, { mode, dieRoll, state, publish });
    if (!weapon) {
        const contact = await resolveHeroObjectContact(monster, object, { ...context });
        if (contact.heroDied || contact.done)
            return { kind: 'finished', outcome: { survived: contact.done ? contact.survived : monster.mhp > 0, heroDied: contact.heroDied } };
        strike.damage = contact.damage;
        // potionhit() refreshes hmon's cached species after changing the body.
        if (object.oclass === POTION_CLASS) strike.originalSpecies = monster.mnum;
        strike.getDamageBonus = contact.getDamageBonus;
        strike.hitTextShown = contact.specialMessage;
        strike.dryTowel = contact.dryTowel;
        strike.silverContact = strike.silverObject = contact.silverContact;
        return { kind: 'strike', strike };
    }
    if (weapon.heroDied) return { kind: 'finished', outcome: { survived: monster.mhp > 0, heroDied: true } };
    strike.damage = weapon.damage;
    strike.useWeaponSkill = weapon.useWeaponSkill;
    strike.trainWeaponSkill = weapon.trainWeaponSkill;
    strike.hitTextShown = weapon.specialMessage;
    if (weapon.useWeaponSkill && object.oartifact) {
        const visible = cansee(monster.mx, monster.my)
            || (!!state.u.uswallow && state.u.ustuck === monster && !heroIsBlind(state));
        const artifact = await applyArtifactHit(object, monster, strike.damage, {
            state, publish, dieRoll, visible,
            realizesDamage: visible || state.u.ustuck === monster,
            hitOnHead: context.target.x === monster.mx && context.target.y === monster.my,
            describeTarget: () => monsterName(monster, { state }),
        });
        if (artifact.heroDied) return { kind: 'finished', outcome: { survived: monster.mhp > 0, heroDied: true } };
        strike.damage = artifact.damage;
        if (artifact.specialMessage || artifact.attackStopped) {
            if (monster.mhp <= 0 || strike.damage === 0)
                return { kind: 'finished', outcome: { survived: monster.mhp > 0, heroDied: false } };
            strike.hitTextShown = true;
        }
    }
    strike.silverContact = strike.silverObject = material === SILVER && monsterHatesSilver(monster);
    if (weapon.useWeaponSkill) {
        strike.lightContact = artifactEmitsLight(object) && !!object.lamplit && monsterHatesLight(monster);
        if (state.u.usteed && mode === 'melee' && strike.damage > 0
            && Math.abs(objectSkill(object.otyp)) === P_LANCE && monster !== state.u.ustuck) {
            strike.joust = rollHeroJoust(monster, object, { state });
            if (strike.joust) strike.trainWeaponSkill = true;
        }
        const primary = state.uwep || state.u.uwep;
        if (mode === 'thrown' && (isLauncherAmmunition(object) || isMissileObject(object))
            && launcherMatchesAmmo(object, primary)) {
            if (state.urole.key === 'samurai' && object.otyp === YA && primary?.otyp === YUMI) strike.damage++;
            else if (state.urace.name === 'elf' && object.otyp === ELVEN_ARROW && primary?.otyp === ELVEN_BOW) strike.damage++;
            strike.trainWeaponSkill = strike.damage > 0;
        }
        strike.canUseWeaponPoison = true;
    }
    return { kind: 'strike', strike };
}

function shouldLogWeaponHit(strike: PhysicalStrike, { state, mode }: ActivePhysicalHit): strike is PhysicalStrike & { object: GameObject } {
    const object = strike.object;
    return !!object && (object === (state.uwep || state.u.uwep)
        || (!!state.u.twoweap && object === (state.uswapwep || state.u.uswapwep)))
        && (object.oclass === WEAPON_CLASS || isWeaponTool(object))
        && (mode === 'melee' || mode === 'applied')
        && !strike.joust && strike.damage > 0 && (state.u.uconduct.weaphit ?? 0) <= 1;
}
// C uhitm.c:mhitm_ad_fire().
export async function mhitmAdFire(call: MhitmAdFireCall): Promise<MhitmAdFireResult> {
    if ('magr' in call) {
        const mdef = call.defender;
        const { state, publish, attack, random, rollOne } = call.context;
        // mhitm_mgc_atk_negated(magr, mdef, TRUE): the hero cannot be
        // cancelled, so the rn2(10) probe always runs.
        if (await mhitm_mgc_atk_negated(state.u, mdef, { state, random })) {
            if (canSeeMonster(mdef))
                await publish(`${monsterName(mdef, { state, capitalized: true })} avoids harm.`);
            return continueResult(0);
        }
        const blind = heroIsBlind(state);
        if (!blind)
            await publish(`${monsterName(mdef, { state, capitalized: true })} is ${monsterFireDescription(mdef, attack[0])}!`);
        if (completelyBurns(mdef)) {
            // note: the life-saved case is hypothetical because life-saving
            // doesn't work for golems
            if (blind)
                await publish(`You smell burning ${MONSTER_NAME[mdef.mnum] === 'paper golem' ? 'paper' : 'straw'}.`);
            else
                await publish(`${monsterName(mdef, { state, capitalized: true })} ${wornMonsterLifeSaver(mdef)
                    ? 'is totally engulfed in flames' : 'burns completely'}!`);
            await finishHeroMonsterKillOutcome(mdef, mdef.mx, mdef.my, {
                noCorpse: true, showKillMessage: false, publish,
            });
            return continueResult(0);
        }
        let damage = call.context.damage;
        if (monsterHasFireResistance(mdef)) {
            if (!blind)
                await publish(`The fire doesn't heat ${monsterName(mdef, { state })}!`);
            await applyMonsterGolemEffects(mdef, AD_FIRE, damage, { state, publish });
            await shieldeff(mdef.mx, mdef.my, state);
            damage = 0;
        }
        damage += await destroyMonsterInventoryByElement(mdef, 'fire', call.context.damage, {
            state, publish, random, rollOne, visible: canSeeMonster(mdef),
        });
        await igniteItems(mdef.minvent, {
            state, publish, random, visible: canSeeMonster(mdef),
        });
        return continueResult(damage);
    } else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero */
        const { state, attacker, hitMessage, attackType, publish, die, random, rollOne, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage) await publish(hitMessage);
        const cancelled = !!attacker.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magic_negation(state.u, state);
        let damage = call.context.damage;
        if (cancelled) {
            // no message if attacker has been cancelled
            damage = 0;
        } else if (negated) {
            damage = 0;
            await publish('You avoid harm.');
        } else {
            const species = heroSpecies(state);
            const form = MONSTER_NAME[species];
            await publish(`You're ${monsterFireDescription({ mnum: species }, attackType)}!`);
            if (form === 'paper golem' || form === 'straw golem') {
                // mhitm_ad_fire() burns these bodies before checking
                // resistance; the declared damage still applies to the
                // restored human form.
                await publish('You go up in flames!');
                monstersForgetHeroResistance(M_SEEN_FIRE, state);
                const restored = await returnHeroToHumanForm(state, { publish, die });
                return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: restored.died };
            }
            if (state.u.fireResistance) {
                await publish("The fire doesn't feel hot!");
                monstersObserveHeroResistance(M_SEEN_FIRE, state);
                damage = 0;
            } else {
                monstersForgetHeroResistance(M_SEEN_FIRE, state);
            }
            const attackerLevel = attacker.m_lev ?? MONSTER_LEVEL[attacker.mnum] ?? 0;
            if (attackerLevel > recordRandom(random, calls, 20)) {
                const items = await destroyFireInventory(call.context.damage, {
                    state, publish, random, rollOne, die,
                });
                if (items.heroDied)
                    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: true };
                await igniteItems(state.inventory, { state, publish });
                // The burn itself can finish the hero; hitmu() then reports
                // the fatal attack instead of applying this damage again.
                const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
                if ((state.u?.[hitPoints] ?? 1) <= 0)
                    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
                        heroAtZeroHitPoints: true };
            }
            await burnAwayHeroSlime({ state, publish });
        }
        return continueResult(damage);
    } else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        const { state, visible, publish, random, rollOne } = context;
        if (await mhitm_mgc_atk_negated(attacker, defender, { verbose: true, state, visible, publish, random }))
            return continueResult(0);
        const seen = visible && canSeeMonster(defender);
        if (seen)
            await publish(`${monsterName(defender, { state, capitalized: true })} is ${monsterFireDescription(defender, context.attack[0])}!`);
        if (completelyBurns(defender)) {
            // note: the life-saved case is hypothetical because life-saving
            // doesn't work for golems
            if (seen)
                await publish(`${monsterName(defender, { state, capitalized: true })} ${wornMonsterLifeSaver(defender)
                    ? 'is totally engulfed in flames' : 'burns completely'}!`);
            const death = await context.killDefender({ damageType: AD_FIRE, cause: null });
            return { damage: context.damage, nativeResult: death.nativeResult, done: true,
                heroDied: death.heroDied };
        }
        let damage = context.damage;
        if (monsterHasFireResistance(defender) || monsterCombatDefense(defender, AD_FIRE, state)) {
            if (seen)
                await publish(`The fire doesn't seem to burn ${monsterName(defender, { state })}!`);
            await shieldeff(defender.mx, defender.my, state);
            await applyMonsterGolemEffects(defender, AD_FIRE, damage, { state, publish });
            damage = 0;
        }
        damage += await destroyMonsterInventoryByElement(defender, 'fire', context.damage, {
            state, publish, random, rollOne, visible: canSeeMonster(defender),
        });
        await igniteItems(defender.minvent, {
            state, publish, random, visible: canSeeMonster(defender),
        });
        return continueResult(damage);
    }
}

// mhitu-branch call context shared by the cold and electric owners.
export interface HeroDefenderElementContext {
    state: PlayingGameState;
    attacker: Monster;
    /** Precomposed mhitu.c:hitmsg() line for the attacking slot. */
    hitMessage: string | null;
    /** mhitm_data.damage on entry: hitmu()'s declared damage roll. */
    damage: number;
    publish: MessagePublisher;
    die: DeathHandler;
    random: typeof rn2;
    rollOne: typeof rnd;
    calls: MonsterCallLog;
}

// One call of mhitm_adtyping(… AD_COLD …): the union member names the actor
// that C compares against &gy.youmonst.
export type MhitmAdColdCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderElementContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// One call of mhitm_adtyping(… AD_ELEC …).
export type MhitmAdElecCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderElementContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

export interface MhitmAdElementResult {
    /** mhm->damage after the branch. */
    damage: number;
    nativeResult: number;
    done: boolean;
    heroDied: boolean;
    /** Hero defender only: the destruction left the hero at zero hit
     *  points, so hitmu() must skip its ordinary damage tail and finish
     *  the fatal attack through mdamageu(magr, 1) instead. */
    heroAtZeroHitPoints?: boolean;
}

function elementContinueResult(damage: number): MhitmAdElementResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

// C uhitm.c:mhitm_ad_cold().
export async function mhitmAdCold(call: MhitmAdColdCall): Promise<MhitmAdElementResult> {
    if ('magr' in call) {
        /* uhitm: the hero attacks a monster with cold */
        const mdef = call.defender;
        const { state, publish, random, rollOne } = call.context;
        // mhitm_mgc_atk_negated(magr, mdef, TRUE): the hero cannot be
        // cancelled, so the rn2(10) probe always runs.
        if (await mhitm_mgc_atk_negated(state.u, mdef, { state, random })) {
            if (canSeeMonster(mdef))
                await publish(`${monsterName(mdef, { state, capitalized: true })} avoids harm.`);
            return elementContinueResult(0);
        }
        const blind = heroIsBlind(state);
        if (!blind)
            await publish(`${monsterName(mdef, { state, capitalized: true })} is covered in frost!`);
        let damage = call.context.damage;
        if (monsterHasColdResistance(mdef) || monsterCombatDefense(mdef, AD_COLD, state)) {
            await shieldeff(mdef.mx, mdef.my, state);
            if (!blind)
                await publish(`The frost doesn't chill ${monsterName(mdef, { state })}!`);
            await applyMonsterGolemEffects(mdef, AD_COLD, damage, { state, publish });
            damage = 0;
        }
        damage += await destroyMonsterInventoryByElement(mdef, 'cold', call.context.damage, {
            state, publish, random, rollOne, visible: canSeeMonster(mdef),
        });
        return elementContinueResult(damage);
    } else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with cold */
        const { state, attacker, hitMessage, publish, die, random, rollOne, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage) await publish(hitMessage);
        const cancelled = !!attacker.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magic_negation(state.u, state);
        let damage = call.context.damage;
        if (cancelled) {
            // no message if attacker has been cancelled
            damage = 0;
        } else if (negated) {
            damage = 0;
            await publish('You avoid harm.');
        } else {
            await publish("You're covered in frost!");
            if (state.u.coldResistance) {
                await publish("The frost doesn't seem cold!");
                monstersObserveHeroResistance(M_SEEN_COLD, state);
                damage = 0;
            } else {
                monstersForgetHeroResistance(M_SEEN_COLD, state);
            }
        }
        if (!negated) {
            const attackerLevel = attacker.m_lev ?? MONSTER_LEVEL[attacker.mnum] ?? 0;
            if (attackerLevel > recordRandom(random, calls, 20)) {
                const items = await destroyColdInventory(call.context.damage, {
                    state, publish, random, rollOne, die,
                });
                if (items.heroDied)
                    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: true };
                // The frost itself can finish the hero; hitmu() then reports
                // the fatal attack instead of applying this damage again.
                const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
                if ((state.u?.[hitPoints] ?? 1) <= 0)
                    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
                        heroAtZeroHitPoints: true };
            }
        }
        return elementContinueResult(damage);
    } else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        const { state, visible, publish, random, rollOne } = context;
        if (await mhitm_mgc_atk_negated(attacker, defender, { verbose: true, state, visible, publish, random }))
            return elementContinueResult(0);
        const seen = visible && canSeeMonster(defender);
        if (seen)
            await publish(`${monsterName(defender, { state, capitalized: true })} is covered in frost!`);
        let damage = context.damage;
        if (monsterHasColdResistance(defender) || monsterCombatDefense(defender, AD_COLD, state)) {
            if (seen)
                await publish(`The frost doesn't seem to chill ${monsterName(defender, { state })}!`);
            await shieldeff(defender.mx, defender.my, state);
            await applyMonsterGolemEffects(defender, AD_COLD, damage, { state, publish });
            damage = 0;
        }
        damage += await destroyMonsterInventoryByElement(defender, 'cold', context.damage, {
            state, publish, random, rollOne, visible: canSeeMonster(defender),
        });
        return elementContinueResult(damage);
    }
}

// C uhitm.c:mhitm_ad_elec().
export async function mhitmAdElec(call: MhitmAdElecCall): Promise<MhitmAdElementResult> {
    if ('magr' in call) {
        /* uhitm: the hero attacks a monster with electricity */
        const mdef = call.defender;
        const { state, publish, random, rollOne } = call.context;
        // mhitm_mgc_atk_negated(magr, mdef, TRUE): the hero cannot be
        // cancelled, so the rn2(10) probe always runs.
        if (await mhitm_mgc_atk_negated(state.u, mdef, { state, random })) {
            if (canSeeMonster(mdef))
                await publish(`${monsterName(mdef, { state, capitalized: true })} avoids harm.`);
            return elementContinueResult(0);
        }
        const blind = heroIsBlind(state);
        if (!blind)
            await publish(`${monsterName(mdef, { state, capitalized: true })} is zapped!`);
        let damage = call.context.damage;
        if (monsterHasShockResistance(mdef) || monsterCombatDefense(mdef, AD_ELEC, state)) {
            if (!blind)
                await publish(`The zap doesn't shock ${monsterName(mdef, { state })}!`);
            await applyMonsterGolemEffects(mdef, AD_ELEC, damage, { state, publish });
            await shieldeff(mdef.mx, mdef.my, state);
            damage = 0;
        }
        damage += await destroyMonsterInventoryByElement(mdef, 'electric', call.context.damage, {
            state, publish, random, rollOne, visible: canSeeMonster(mdef),
        });
        return elementContinueResult(damage);
    } else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with electricity */
        const { state, attacker, hitMessage, publish, die, random, rollOne, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage) await publish(hitMessage);
        const cancelled = !!attacker.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magic_negation(state.u, state);
        let damage = call.context.damage;
        if (cancelled) {
            // no message if attacker has been cancelled
            damage = 0;
        } else if (negated) {
            damage = 0;
            await publish('You avoid harm.');
        } else {
            await publish('You get zapped!');
            if (state.u.shockResistance) {
                await publish("The zap doesn't shock you!");
                monstersObserveHeroResistance(M_SEEN_ELEC, state);
                damage = 0;
            } else {
                monstersForgetHeroResistance(M_SEEN_ELEC, state);
            }
        }
        if (!negated) {
            const attackerLevel = attacker.m_lev ?? MONSTER_LEVEL[attacker.mnum] ?? 0;
            if (attackerLevel > recordRandom(random, calls, 20)) {
                const items = await destroyElectricInventory(call.context.damage, {
                    state, publish, random, rollOne, die,
                });
                if (items.heroDied)
                    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: true };
                // The shock itself can finish the hero; hitmu() then reports
                // the fatal attack instead of applying this damage again.
                const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
                if ((state.u?.[hitPoints] ?? 1) <= 0)
                    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
                        heroAtZeroHitPoints: true };
            }
        }
        return elementContinueResult(damage);
    } else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        const { state, visible, publish, random, rollOne } = context;
        if (await mhitm_mgc_atk_negated(attacker, defender, { verbose: true, state, visible, publish, random }))
            return elementContinueResult(0);
        const seen = visible && canSeeMonster(defender);
        if (seen)
            await publish(`${monsterName(defender, { state, capitalized: true })} gets zapped!`);
        let damage = context.damage;
        if (monsterHasShockResistance(defender) || monsterCombatDefense(defender, AD_ELEC, state)) {
            if (seen)
                await publish(`The zap doesn't shock ${monsterName(defender, { state })}!`);
            await shieldeff(defender.mx, defender.my, state);
            await applyMonsterGolemEffects(defender, AD_ELEC, damage, { state, publish });
            damage = 0;
        }
        damage += await destroyMonsterInventoryByElement(defender, 'electric', context.damage, {
            state, publish, random, rollOne, visible: canSeeMonster(defender),
        });
        return elementContinueResult(damage);
    }
}

// Local copies of the C mondata.h flags the status owners read.
const PM_RAVEN = MONSTER_NAME.indexOf('raven');
const LOW_BOOTS = 163;

// C mondata.c:can_blnd() for the hero's own contact attack; the monster
// defender twin lives with mhitm_ad_blnd's monster-versus-monster branch.
function naturalAttackCanBlind(
    monster: Monster, { state, attack }: HeroNaturalEffectContext,
): boolean {
    if (!monsterHasEyes(monster.mnum) || !monster.mcansee && !monster.mblinded)
        return false;
    if (heroSpecies(state) === PM_RAVEN && monster.mnum === PM_RAVEN) return false;
    const method = attack[0];
    if ([AT_EXPL, AT_BOOM, AT_GAZE, AT_MAGC, AT_BREA].includes(method))
        return !monsterResistsBlindingLight(monster, state);
    if ([AT_WEAP, AT_SPIT, AT_NONE].includes(method)) return false;
    if (method === AT_ENGL) return !monster.msleeping;
    if (method !== AT_CLAW) return true;
    if (state.u.uswallow) return false;
    return !(monster.minvent ?? []).some(object => (object.owornmask ?? 0) & W_ARMH
        && (OBJ_DESCR(object.otyp, state)) === 'visored helmet');
}

// mhitu-branch call context shared by the stun and enchantment owners.
export interface HeroDefenderStatusContext {
    state: PlayingGameState;
    attacker: Monster;
    /** Precomposed mhitu.c:hitmsg() line for the attacking slot. */
    hitMessage: string | null;
    /** mhitm_data.damage on entry: hitmu()'s declared damage roll. */
    damage: number;
    publish: MessagePublisher;
    random: typeof rn2;
    calls: MonsterCallLog;
}

export interface HeroDefenderDrliContext extends HeroDefenderStatusContext {
    die: DeathHandler;
}

export interface HeroDefenderBlndContext {
    state: PlayingGameState;
    attacker: Monster;
    /** mattk->aatyp, for can_blnd()'s contact rules. */
    attackType: AttackMethod;
    damage: number;
    publish: MessagePublisher;
    random: typeof rn2;
    calls: MonsterCallLog;
}

export interface HeroDefenderLegsContext {
    state: PlayingGameState;
    attacker: Monster;
    damage: number;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    calls: MonsterCallLog;
}

export interface MhitmAdStatusResult {
    /** mhm->damage after the branch. */
    damage: number;
    nativeResult: number;
    done: boolean;
    heroDied: boolean;
}

function statusContinueResult(damage: number): MhitmAdStatusResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

// One call of mhitm_adtyping(… AD_DRLI …); the monster-versus-monster arm
// also serves mhitm_ad_deth()'s redirected branch, as in C.
export type MhitmAdDrliCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderDrliContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// C uhitm.c:mhitm_ad_drli().
export async function mhitmAdDrli(call: MhitmAdDrliCall): Promise<MhitmAdStatusResult> {
    if ('magr' in call) {
        /* uhitm: the hero attacks a monster with life drainage */
        const mdef = call.defender;
        const { state, random, rollDice, publish } = call.context;
        // C's uhitm branch has no is_death shortcut: the full selection
        // gate applies even to the call mhitm_ad_deth() redirects here
        // (no hero form carries AD_DETH).
        if (random(3) || monsterHasDrainResistance(mdef)
            || monsterHasArtifactDefense(mdef, 'life-drain', state))
            return statusContinueResult(call.context.damage);
        // mhitm_mgc_atk_negated(magr, mdef, TRUE): the hero cannot be
        // cancelled, so the rn2(10) probe always runs.
        if (await mhitm_mgc_atk_negated(state.u, mdef, { state, random })) {
            if (canSeeMonster(mdef))
                await publish(`${monsterName(mdef, { state, capitalized: true })} avoids harm.`);
            return statusContinueResult(call.context.damage);
        }
        const damage = rollDice(2, 6); /* Stormbringer uses monhp_per_lvl
                                        * (usually 1d8) */
        await publish(`${monsterName(mdef, { state, capitalized: true })} becomes weaker!`);
        if (mdef.mhpmax - damage > mdef.m_lev) mdef.mhpmax -= damage;
        else if (mdef.mhpmax > mdef.m_lev) mdef.mhpmax = mdef.m_lev + 1;
        mdef.mhp -= damage;
        /* !m_lev: level 0 monster is killed regardless of hit points
           rather than drop to level -1; note: some non-living creatures
           (golems, vortices) are subject to life-drain */
        if (mdef.mhp <= 0 || !mdef.m_lev) {
            await publish(`${monsterName(mdef, { state, capitalized: true })} ${monsterIsNonliving(mdef.mnum) ? 'expires' : 'dies'}!`);
            await finishHeroMonsterKillOutcome(mdef, mdef.mx, mdef.my, {
                showKillMessage: false, publish,
            });
        } else mdef.m_lev--;
        // damage has already been inflicted; unlike hitting with
        // Stormbringer, the wounded hero doesn't heal any from the drained
        // life.
        return statusContinueResult(0);
    } else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with life drainage */
        const { state, attacker, hitMessage, publish, die, random, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage) await publish(hitMessage);
        if (recordRandom(random, calls, 3) === 0 && !heroHasDrainResistance(state)) {
            // mhitm_mgc_atk_negated(magr, mdef, TRUE), which owns the
            // "You avoid harm." line; a cancelled attacker returns quietly.
            const negated = await mhitm_mgc_atk_negated(attacker, state.u, {
                state, random: limit => recordRandom(random, calls, limit), publish, verbose: true,
            });
            // unlike hitting with Stormbringer, the wounded attacker doesn't
            // heal any from the drained life
            if (!negated && await loseHeroExperience('life drainage', { die, publish }))
                return { damage: call.context.damage, nativeResult: M_ATTK_MISS,
                    done: false, heroDied: true };
        }
        return statusContinueResult(call.context.damage);
    } else {
        /* mhitm: monster versus monster; mhitm_ad_deth() redirects here
           for Death's touch */
        const { attacker, defender, context } = call;
        const { state, visible, random, rollDice, publish } = context;
        const isDeath = context.attack[1] === AD_DETH;
        let damage = context.damage;
        if (isDeath
            || (random(3) === 0
                && !(monsterHasDrainResistance(defender)
                    || monsterCombatDefense(defender, AD_DRLI, state))
                && !await mhitm_mgc_atk_negated(attacker, defender, {
                    state, visible, random, publish, verbose: true,
                }))) {
            if (!isDeath) /* Stormbringer uses monhp_per_lvl (1d8) */
                damage = rollDice(2, 6);
            if (visible && canSpotMonster(defender))
                await publish(`${monsterName(defender, { state, capitalized: true })} becomes weaker!`);
            if (defender.mhpmax - damage > defender.m_lev) defender.mhpmax -= damage;
            else if (defender.mhpmax > defender.m_lev)
                defender.mhpmax = defender.m_lev + 1;
            if (defender.m_lev === 0) /* automatic kill if drained past level 0 */
                damage = defender.mhp;
            else defender.m_lev--;
            // unlike hitting with Stormbringer, the wounded attacker doesn't
            // heal any from the drained life
        }
        return statusContinueResult(damage);
    }
}

// One call of mhitm_adtyping(… AD_BLND …).
export type MhitmAdBlndCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderBlndContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// C uhitm.c:mhitm_ad_blnd().
export async function mhitmAdBlnd(call: MhitmAdBlndCall): Promise<MhitmAdStatusResult> {
    if ('magr' in call) {
        /* uhitm: the hero attacks a monster with blinding contact */
        const mdef = call.defender;
        const { state, publish } = call.context;
        if (naturalAttackCanBlind(mdef, call.context)) {
            if (!heroIsBlind(state) && mdef.mcansee)
                await publish(`${monsterName(mdef, { state, capitalized: true })} is blinded.`);
            mdef.mcansee = 0;
            let damage = call.context.damage;
            damage += mdef.mblinded ?? 0;
            if (damage > 127) damage = 127;
            mdef.mblinded = damage;
        }
        return statusContinueResult(0);
    } else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with blinding contact */
        const { state, attacker, attackType, publish, random, calls } = call.context;
        if (heroCanBeBlindedByContact(attacker, attackType, state)) {
            if (!(!!state.blind || (state.u.blindTurns ?? 0) > 0))
                await publish(`${monsterName(attacker, { capitalized: true })} blinds you!`);
            // mhitm_ad_blnd() passes the full declared damage to
            // make_blinded(), which adds it to the current timeout even when
            // the hero is already blind.  The one-turn repeated-blindness
            // behavior in mhitu.c belongs to engulfing attacks, not ordinary
            // raven contact.
            await makeBlinded((state.u.blindTurns ?? 0) + call.context.damage, {
                state, talk: false,
            });
        }
        // mhm->damage = 0, but hitmu()'s knockback probe still consumes its
        // distance and chance draws even though a blinding claw cannot
        // knock the hero back.
        recordRandom(random, calls, 3);
        recordRandom(random, calls, 6);
        return statusContinueResult(0);
    } else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        await applyMonsterCombatBlindness(attacker, defender, context.attack, context);
        return statusContinueResult(0);
    }
}

// One call of mhitm_adtyping(… AD_ENCH …).
export type MhitmAdEnchCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderStatusContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// C uhitm.c:mhitm_ad_ench() (mhitu branch): the ring/amulet/blindfold
// rn2(5) fallback below runs only when some_armor() (do_wear.ts) finds
// nothing worn.
// C uhitm.c:mhitm_ad_ench().
export async function mhitmAdEnch(call: MhitmAdEnchCall): Promise<MhitmAdStatusResult> {
    if ('magr' in call) {
        /* uhitm: there's no msomearmor() function, so just do damage */
        return statusContinueResult(call.context.damage);
    } else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero's worn gear */
        const { state, attacker, hitMessage, publish, random, calls } = call.context;
        // mhitm_mgc_atk_negated(magr, mdef, FALSE) precedes hitmsg(); a
        // cancelled attacker returns without rolling.
        const negated = !!attacker.mcan
            || recordRandom(random, calls, 10) < 3 * magic_negation(state.u, state);
        // hitmsg(magr, mattk)
        if (hitMessage) await publish(hitMessage);
        // uncancelled is sufficient enough; please
        // don't make this attack less frequent
        if (!negated) {
            const target = some_armor(state, limit => recordRandom(random, calls, limit))
                ?? [
                    null,
                    state.uright ?? state.u?.uright,
                    state.uleft ?? state.u?.uleft,
                    state.uamul ?? state.u?.uamul,
                    state.ublindf ?? state.u?.ublindf,
                ][recordRandom(random, calls, 5)] ?? null;
            if (target && await drainObjectEnchantment(target, {
                state, random: limit => recordRandom(random, calls, limit),
            }))
                await publish(`${ownedObjectAction(target, 'seem', state)} less effective.`);
        }
        return statusContinueResult(call.context.damage);
    } else {
        /* mhitm: there's no msomearmor() function, so just do damage */
        return statusContinueResult(call.context.damage);
    }
}

// One call of mhitm_adtyping(… AD_STUN …).
export type MhitmAdStunCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderStatusContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// C uhitm.c:mhitm_ad_stun().
export async function mhitmAdStun(call: MhitmAdStunCall): Promise<MhitmAdStatusResult> {
    if ('magr' in call) {
        /* uhitm: the hero attacks a monster with a stunning blow */
        const mdef = call.defender;
        const { state, publish } = call.context;
        if (!heroIsBlind(state))
            await publish(`${monsterName(mdef, { state, capitalized: true })} ${staggerVerb(mdef.mnum)} for a moment.`);
        mdef.mstun = 1;
        // mhitm_ad_phys(); its uhitm branch never sets mhm->done.
        return mhitm_ad_phys({ magr: 'youmonst', defender: mdef, context: call.context });
    } else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with a stunning blow */
        const { state, attacker, hitMessage, publish, random, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage) await publish(hitMessage);
        let damage = call.context.damage;
        if (!attacker.mcan && recordRandom(random, calls, 4) === 0) {
            // make_stunned() receives the full pre-halving damage; only the
            // ordinary HP tail is reduced.
            await makeStunned((state.u.stunnedTurns ?? 0) + Math.max(0, damage), {
                state, publish,
            });
            damage = Math.trunc(damage / 2);
        }
        return statusContinueResult(damage);
    } else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        if (attacker.mcan) return statusContinueResult(context.damage);
        if (canSeeMonster(defender))
            await context.publish(`${monsterName(defender, { state: context.state, capitalized: true })} ${staggerVerb(defender.mnum)} for a moment.`);
        defender.mstun = 1;
        // mhitm_ad_phys(); its mhitm branch can finish the attack itself.
        return await context.applyPhysical();
    }
}

// One call of mhitm_adtyping(… AD_LEGS …).
export type MhitmAdLegsCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderLegsContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// C uhitm.c:mhitm_ad_legs().
export async function mhitmAdLegs(call: MhitmAdLegsCall): Promise<MhitmAdStatusResult> {
    if ('magr' in call) {
        /* uhitm: the #if 0 u.ucancelled probe is disabled upstream, so the
           branch reduces to mhitm_ad_phys(), whose uhitm branch never sets
           mhm->done. */
        return mhitm_ad_phys({ magr: 'youmonst', defender: call.defender, context: call.context });
    } else if ('mdef' in call) {
        /* mhitu: a xan pricks the hero's leg */
        const { state, attacker, publish, random, rollOne, calls } = call.context;
        const side = recordRandom(random, calls, 2) ? 'right' : 'left';
        const leg = heroLegName(state);
        const subject = monsterName(attacker, { capitalized: true });
        let damage = call.context.damage;
        // This case is too obvious to ignore, but Nethack is not in
        // general very good at considering height--most short monsters
        // still _can_ attack you when you're flying or mounted.
        const airborneHero = !!(
            state.u.usteed ||
            state.u.levitating ||
            state.u.levitation ||
            state.u.flying
        );
        const attackerFlies = monsterIsFlyer(attacker.mnum);
        if (airborneHero && !attackerFlies) {
            await publish(`${subject} tries to reach your ${side} ${leg}!`);
            damage = 0;
        } else if (attacker.mcan) {
            await publish(`${subject} nuzzles against your ${side} ${leg}!`);
            damage = 0;
        } else {
            const boots = state.uarmf || state.u.uarmf;
            if (boots) {
                if (recordRandom(random, calls, 2) !== 0
                    && [LOW_BOOTS, IRON_SHOES].includes(boots.otyp)) {
                    await publish(`${subject} pricks the exposed part of your ${side} ${leg}!`);
                } else if (recordRandom(random, calls, 5) === 0) {
                    await publish(`${subject} pricks through your ${side} boot!`);
                } else {
                    await publish(`${subject} scratches your ${side} boot!`);
                    damage = 0;
                    return statusContinueResult(damage);
                }
            } else {
                await publish(`${subject} pricks your ${side} ${leg}!`);
            }
            // set_wounded_legs(side, rnd(60 - ACURR(A_DEX)))
            const durationSides = 60 - currentAttribute(A_DEX, state);
            const duration = rollOne(durationSides);
            calls.push(`rnd(${durationSides})`);
            await woundHeroLegs(side, duration, state, { publish });
            // exercise(A_STR, FALSE); exercise(A_DEX, FALSE)
            await exerciseAttribute(A_STR, false, state);
            await exerciseAttribute(A_DEX, false, state);
        }
        return statusContinueResult(damage);
    } else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        if (attacker.mcan) return statusContinueResult(0);
        return await context.applyPhysical();
    }
}

export interface HeroDefenderSeduContext {
    state: PlayingGameState;
    attacker: Monster;
    /** The mhitm_data port for hitmu()'s current slot. */
    attack: HeroContactAttack;
    /** Precomposed mhitu.c:hitmsg() line; animals publish it here. */
    hitMessage: string | null;
    publish: MessagePublisher;
    random: typeof rn2;
    calls: MonsterCallLog;
}

type MhitmAdSeduCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderSeduContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// C uhitm.c:mhitm_ad_sedu().
export async function mhitm_ad_sedu(call: MhitmAdSeduCall): Promise<HeroNaturalEffectResult & { pagerOwned?: boolean }> {
    if ('magr' in call) {
        await steal_it(call.defender, call.context);
        const heroDied = !!call.context.state.program_state.gameover;
        return { ...effectResult(0, M_ATTK_MISS, heroDied), done: heroDied };
    } else if ('mdef' in call) {
        const { state, attacker, attack, hitMessage, publish, random, calls } = call.context;
        const draw = (limit: number): number => {
            calls.push(`rn2(${limit})`);
            return random(limit);
        };
        const animal = monsterIsAnimal(attacker);
        if (animal) {
            // C uhitm.c:4637-4642: hitmsg() precedes everything for animals;
            // a cancelled animal stops before steal().
            if (hitMessage) await publish(hitMessage);
            if (attacker.mcan) return { ...effectResult(attack.damage ?? 0), pagerOwned: false };
        } else if (MONSTER_ATTACKS[heroSpecies(state)]?.some(
            attack => attack[1] === AD_SEDU || attack[1] === AD_SSEX,
        )) {
            // C uhitm.c:4642-4656: a seductive hero only hears the thief's
            // remarks, and the thief leaves.
            const subject = monsterName(attacker, { state, capitalized: true });
            await plineWithContinuation(`${subject} ${heroIsDeaf(state)
                ? "says something but you can't hear it"
                : (attacker.minvent || attacker.inventory || []).length ? 'brags about the goods some dungeon explorer provided'
                    : 'makes some remarks about how difficult theft is lately'}.`);
            if (!await reportMonsterTeleportRestriction(attacker, { state }))
                await randomMonsterRelocation(attacker, { calls, flags: RLOC_MSG });
            attack.attackerDone = true;
            attack.contactDone = true;
            attack.nativeResult = M_ATTK_AGR_DONE;
            return { ...effectResult(attack.damage ?? 0), pagerOwned: true };
        } else if (attacker.mcan) {
            // C uhitm.c:4656-4669: a cancelled seducer fails to charm, then
            // usually teleports away.
            if (!heroIsBlind(state)) {
                const subject = monsterName(attacker, { state,
                    capitalized: true, adjective: 'plain' });
                await plineWithContinuation(`${subject} tries to ${state.flags.female
                    ? 'charm' : 'seduce'} you, but you seem ${state.flags.female
                    ? 'unaffected' : 'uninterested'}.`);
            }
            if (draw(3)) {
                if (!await reportMonsterTeleportRestriction(attacker, { state }))
                    await randomMonsterRelocation(attacker, { calls, flags: RLOC_MSG });
                attack.attackerDone = true;
                attack.contactDone = true;
                attack.nativeResult = M_ATTK_AGR_DONE;
            }
            return { ...effectResult(attack.damage ?? 0), pagerOwned: false };
        }
        const theft = await stealFromHero(attacker, random, calls);
        let pagerOwned = true;
        let stolenName: string | undefined;
        switch (theft.outcome) {
        case 'petrified':
            attack.nativeResult = M_ATTK_AGR_DIED;
            attack.contactDone = true;
            return { ...effectResult(attack.damage ?? 0), pagerOwned: true };
        case 'nothing-to-steal':
            break;
        case 'refused':
            if (!theft.fled) return { ...effectResult(attack.damage ?? 0), pagerOwned: false };
            pagerOwned = false;
            break;
        case 'stole':
            if (heroHasInvoluntaryDelay(state))
                return { ...effectResult(attack.damage ?? 0), pagerOwned: true };
            stolenName = theft.stolenName ?? undefined;
            break;
        case 'hero-died':
        case 'vanished':
            return { ...effectResult(attack.damage ?? 0), pagerOwned: true };
        case 'too-far':
        case 'busy':
        case 'gone':
        case 'armor-removal':
            return { ...effectResult(attack.damage ?? 0), pagerOwned: false };
        }
        const game = requireInitializedGame();
        if (animal) {
            if (stolenName && canSeeMonster(attacker))
                await plineWithContinuation(`${monsterName(attacker, { state: game,
                    capitalized: true })} tries to run away with ${stolenName}.`);
        } else if (!await reportMonsterTeleportRestriction(attacker, { state: game })) {
            const relocation = await randomMonsterRelocation(attacker, {
                calls, flags: RLOC_MSG,
            });
            if (relocation && 'died' in relocation && relocation.died) return { ...effectResult(attack.damage ?? 0), pagerOwned };
        }
        const flight = await makeMonsterFlee(attacker, { announce: false });
        if (flight.heroDied) return { ...effectResult(attack.damage ?? 0), pagerOwned };
        attack.attackerDone = true;
        attack.contactDone = true;
        attack.nativeResult = M_ATTK_AGR_DONE;
        return { ...effectResult(attack.damage ?? 0), pagerOwned };
    } else {
        const { attacker, defender, context } = call;
        if (attacker.mcan) return effectResult(context.damage);
        const object = (defender.minvent || defender.inventory || [])
            .find(candidate => !attacker.mtame || !candidate.cursed);
        if (!object) return effectResult(0);
        const { state, publish, visible, random, finishDeath } = context;
        const nymph = MONSTER_SYMBOL[attacker.mnum] === S_NYMPH;
        const victimName = monsterName(defender, { state, suppressSaddle: false });
        if (state.u.usteed === defender && ((object.owornmask ?? 0) & W_SADDLE)) {
            const dismount = await dismountHero(DISMOUNT_POLY, { state, random, announce: publish });
            if (dismount.died) return { ...effectResult(0), done: true, heroDied: true };
        }
        await removeObjectFromMonsterInventory(defender, object, state, { publish });
        if (state.program_state.gameover) return { ...effectResult(0), done: true, heroDied: true };
        // C doname() records the appearance it names while the hero can see.
        if (visible) observeObjectForNaming(object, { state });
        const description = visible ? await inventoryItemDescription(object) : '';
        // add_to_minv retains ownership without mpickobj's pickup side effects.
        await linkObjectToMonsterInventory(attacker, object, { state });
        const thiefName = monsterName(attacker, { state, capitalized: true });
        if (visible && canSeeMonster(defender))
            await publish(`${thiefName} steals ${description} from ${victimName}!`);
        await updateMonsterWeaponAfterPolymorph(defender, state, { publish });
        defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
        const touch = await monsterSelfTouch(defender, { state, publish, finishDeath, creditHero: false });
        if (touch.heroDied) return { ...effectResult(0), done: true, heroDied: true };
        if (defender.mhp <= 0) {
            const growth = await context.growAttacker(defender);
            return {
                damage: context.damage,
                nativeResult: M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED),
                done: true, heroDied: growth.heroDied,
            };
        }
        if (nymph) return escapeAfterTheft(attacker, thiefName, context);
        return effectResult(0);
    }
}

const S_EYE = 5;
const S_LIGHT = 25;

type PhysicalActor = Hero | Monster;

export interface KnockbackAttack {
    attackType: number;
    damageType: number;
}

export interface KnockbackOptions {
    state?: GameState;
    random?: (limit: number) => number;
    publish?: MessagePublisher;
    weaponUsed?: boolean;
    hit?: boolean;
    finishMonsterDeath?: HurtleDeathHandler | undefined;
    finishLiquidDeath?: HurtleLiquidDeathHandler | undefined;
    nameMonster?: (monster: Monster) => string;
    wakeDefender?: (() => Promise<{ heroDied?: boolean } | void>) | undefined;
}

export interface KnockbackOutcome {
    knocked: boolean;
    moved?: boolean;
    heroDied?: boolean;
    defenderDied?: boolean;
    aggressorDied?: boolean;
    defenderLeftLevel?: boolean;
}

// Shared actor comparison with &gy.youmonst in the uhitm.c effect functions.
function isHeroActor(actor: PhysicalActor, state: GameState): actor is Hero {
    return actor === state.u;
}

// Shared actor->data lookup; the hero uses u.umonnum (monst.h and you.h).
function species(actor: PhysicalActor, state: GameState): number {
    if (!isHeroActor(actor, state)) return actor.mnum;
    requireInitializedHero(actor);
    return actor.umonnum;
}

// Shared uwep/MON_WEP() expression (decl.h and monst.h:MON_WEP).
function wieldedWeapon(actor: PhysicalActor, state: GameState): GameObject | null | undefined {
    return isHeroActor(actor, state) ? state.uwep : monsterWieldedWeapon(actor);
}

// C uhitm.c:m_is_steadfast().
export function m_is_steadfast(actor: PhysicalActor, state: GameState): boolean {
    requirePlayingGame(state);
    const mnum = species(actor, state);
    const floating = isHeroActor(actor, state)
        ? actor.levitating || actor.levitation || actor.flying
        : (monsterIsFlyer(mnum))
            || [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[mnum] ?? -1);
    if (floating || Is_airlevel(state.u.uz)
        || (Is_waterlevel(state.u.uz)
            && !isPoolAt(state.u.ux, state.u.uy, state))) return false;
    if (artifactById(wieldedWeapon(actor, state)?.oartifact)?.name === 'Giantslayer')
        return true;
    const carried = isHeroActor(actor, state) ? state.inventory : actor.minvent ?? [];
    return carried.some(object => object.otyp === LOADSTONE)
        || (actor === state.u.usteed
            && state.inventory.some(object => object.otyp === LOADSTONE));
}

// C uhitm.c:mhitm_knockback().
export async function mhitm_knockback(attacker: PhysicalActor, defender: PhysicalActor, attack: KnockbackAttack, {
    state = game, random = rn2, publish = plineWithContinuation,
    weaponUsed = false, hit = true, finishMonsterDeath, finishLiquidDeath,
    nameMonster = monster => monsterName(monster, {
        state, article: 'your',
        suppressSaddle: !!MGIVENNAME(monster) || monster === state.u.usteed,
    }), wakeDefender,
}: KnockbackOptions = {}): Promise<KnockbackOutcome> {
    requirePlayingGame(state);
    const distance = random(3) ? 1 : 2;
    const weapon = weaponUsed ? wieldedWeapon(attacker, state) : null;
    const chance = artifactById(weapon?.oartifact)?.name === 'Ogresmasher' ? 2 : 6;
    if (random(chance) !== 0) return { knocked: false };
    if (attack.damageType !== AD_PHYS
        || ![AT_CLAW, AT_KICK, AT_BUTT, AT_WEAP].includes(attack.attackType))
        return { knocked: false };

    const attackerForm = species(attacker, state);
    if ((MONSTER_ATTACKS[attackerForm] || []).some(([method, damage]) =>
        [AT_ENGL, AT_HUGS].includes(method) || [AD_STCK, AD_WRAP].includes(damage)))
        return { knocked: false };

    const attackerMonster = isHeroActor(attacker, state) ? null : attacker;
    const defenderMonster = isHeroActor(defender, state) ? null : defender;
    const heroAttacks = attackerMonster === null;
    const heroTarget = defenderMonster === null;
    let movingHero = heroTarget;
    const x = defenderMonster?.mx ?? state.u.ux;
    const y = defenderMonster?.my ?? state.u.uy;
    const dx = Math.sign(x - (attackerMonster?.mx ?? state.u.ux));
    const dy = Math.sign(y - (attackerMonster?.my ?? state.u.uy));
    if (heroTarget) {
        requirePlayingGame(game);
        const { ux, uy } = game.u;
        if (!isok(ux + dx, uy + dy) || !heroTestMove(ux + dx, uy + dy))
            return { knocked: false };
    } else {
        if (!isok(x + dx, y + dy)) return { knocked: false };
        const doorway = state.level.at(x, y);
        // C tests (defx - magr->mx && defy - magr->my); youmonst.mx/my stay
        // zero, so a hero can never knock a monster out of a real doorway.
        const fromX = attackerMonster?.mx ?? 0;
        const fromY = attackerMonster?.my ?? 0;
        // C hack.c:doorless_door(): a Rogue-level doorway has no door but
        // still blocks diagonal knockback.
        if (x - fromX && y - fromY && doorway?.typ === DOOR && !doorlessDoor(doorway))
            return { knocked: false };
    }

    let target: Monster | null = defenderMonster;
    let dismount = false;
    if (heroTarget && state.u.usteed) {
        const saddle = (state.u.usteed.minvent ?? []).find(object => (object.owornmask ?? 0) & W_SADDLE);
        if (saddle?.cursed) {
            target = state.u.usteed;
            movingHero = false;
        } else dismount = true;
    }
    if ((attackerMonster && (attackerMonster.dead || attackerMonster.mhp <= 0))
        || (target && (target.dead || target.mhp <= 0))) return { knocked: false };
    const attackerSize = MONSTER_SIZE[attackerForm];
    const defenderForm = species(target ?? state.u, state);
    const defenderSize = MONSTER_SIZE[defenderForm];
    if (attackerSize === undefined || defenderSize === undefined)
        throw new Error(`Knockback requires known species sizes (${attackerForm}, ${defenderForm}).`);
    if (attackerSize <= defenderSize + 1) return { knocked: false };
    if (weapon && (isFlimsyObject(weapon) || !isBluntWeapon(weapon)))
        return { knocked: false };
    if (monsterIsUnsolid({ mnum: attackerForm })
        || ((heroAttacks || movingHero) && !hit)) return { knocked: false };

    if (m_is_steadfast(target ?? state.u, state)) {
        if (movingHero || target === state.u.usteed) {
            await publish(state.u.usteed
                ? `You and ${nameMonster(state.u.usteed)} don't budge.` : "You don't budge.");
        } else if (target && canSeeMonster(target)) {
            await publish(`${monsterName(target, { state, capitalized: true })} doesn't budge.`);
        }
        return { knocked: false };
    }

    const openPath = movingHero
        ? defenderSize < 4 && goodPosition(x + dx, y + dy, { kind: 'hero' }, {
            state, gpflags: MM_IGNOREWATER | MM_IGNORELAVA, random,
        })
        : target && willMonsterHurtle(target, state, x + dx, y + dy, random);
    const how = dismount ? 'out of your saddle' : openPath ? 'backward' : 'back';
    if (movingHero || (target && canSeeMonster(target))) {
        const subject = attackerMonster ? monsterName(attackerMonster, { state, capitalized: true }) : 'You';
        let object = target ? nameMonster(target) : 'you';
        if (heroTarget && target) object = `you and ${nameMonster(target)}`;
        const strength = random(2) ? 'forceful' : 'powerful';
        const blow = random(2) ? 'blow' : 'strike';
        await publish(`${subject} ${heroAttacks ? 'knock' : 'knocks'} ${object} ${how} with a ${strength} ${blow}!`);
    } else if (heroAttacks && target) {
        await publish(formatFeltMessage(`${monsterName(target, { state, augmentIt: true })} be knocked ${how}!`, state));
    }

    // C uhitm.c:mhitm_knockback() calls unstuck(), which also gives a
    // holder its re-hold cooldown.
    if ((heroAttacks || movingHero) && state.u.ustuck)
        await releaseHeroFromMonster(state.u.ustuck, { state, publish });
    let moved;
    const level = state.level;
    if (movingHero) {
        if (dismount) {
            state.u.dx = dx;
            state.u.dy = dy;
            await dismountHero(DISMOUNT_KNOCKED, { state, random, announce: publish });
        } else await hurtleHero(dx, dy, distance, finishMonsterDeath ? { finishMonsterDeath } : {});
        moved = state.u.ux !== x || state.u.uy !== y;
        // A fatal hurtle ends the game inside C's hurtle(); nothing follows.
        if (state.program_state.gameover) return { knocked: true, moved, heroDied: true, defenderDied: true };
        if (attackerMonster) setMonsterApparentHeroPosition(attackerMonster, state, random);
        if (!state.u.stunned && !((state.u.stunnedTurns ?? 0) > 0) && random(4) === 0) {
            await makeStunned(distance + 1, { state, publish });
        }
    } else {
        if (!target) throw new Error('Monster knockback requires a monster target.');
        const result = await hurtleMonster(target, dx, dy, distance, {
            state, announce: publish, nameMonster,
            wakeMonster: wakeDefender,
            finishLiquidDeath, finishMonsterDeath,
            monsterMoving: !heroAttacks, random,
        });
        if (result.heroDied)
            return { knocked: true, moved: result.moved, heroDied: true };
        moved = result.moved;
        if (!target.dead && target.mhp > 0 && random(4) === 0) {
            target.mstun = 1;
            if (target === state.u.usteed)
                if (attackerMonster) setMonsterApparentHeroPosition(attackerMonster, state, random);
        }
    }
    return {
        knocked: true, moved,
        defenderDied: heroTarget ? !!state.program_state.gameover : !!target && (!!target.dead || target.mhp <= 0),
        aggressorDied: !!attackerMonster && (!!attackerMonster.dead || attackerMonster.mhp <= 0),
        defenderLeftLevel: level !== state.level
            || (target !== null && !heroTarget && target !== state.u.usteed && !state.level.monsters.includes(target)),
    };
}

// C uhitm.c:mhitm_mgc_atk_negated().
export async function mhitm_mgc_atk_negated(attacker: Hero | Monster, defender: Hero | Monster, {
    state = game, random = rn2, verbose = false, visible = true, publish = plineWithContinuation,
}: { state?: GameState; random?: typeof rn2; verbose?: boolean; visible?: boolean; publish?: MessagePublisher } = {}): Promise<boolean> {
    if (attacker !== state.u && attacker.mcan) return true;
    const armpro = magic_negation(defender, state);
    const negated = random(10) < 3 * armpro;
    if (negated && verbose) {
        if (defender === state.u) await publish('You avoid harm.');
        else if ('mnum' in defender && visible && canSeeMonster(defender))
            await publish(`${monsterName(defender, { state, capitalized: true })} avoids harm.`);
    }
    return negated;
}

// Native uhitm.c monster-vs-monster acid and erosion; mhitm_ad_fire(),
// mhitm_ad_cold() and mhitm_ad_elec() live above with their other
// actor branches.
export async function applyMonsterElementEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const type = context.attack[1];
    if (type === AD_FIRE) return await mhitmAdFire({ attacker, defender, context });
    if (type === AD_COLD) return await mhitmAdCold({ attacker, defender, context });
    if (type === AD_ELEC) return await mhitmAdElec({ attacker, defender, context });
    if (type === AD_RUST || type === AD_CORR || type === AD_DCAY)
        return await erosionContact(attacker, defender, type, context);
    if (type === AD_ACID) return await acidContact(attacker, defender, context);
    throw new RangeError(`Unsupported monster elemental damage type: ${type}`);
}

async function erosionContact(
    attacker: Monster, defender: Monster, type: typeof AD_RUST | typeof AD_CORR | typeof AD_DCAY,
    context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    // Unlike elemental cancellation, cancelled erosion retains rolled damage.
    if (attacker.mcan) return damageResult(context.damage);
    const { state, visible, publish, random } = context;
    const species = MONSTER_NAME[defender.mnum];
    if (type === AD_RUST && species === 'iron golem'
        || type === AD_DCAY && (species === 'wood golem' || species === 'leather golem')) {
        if (visible && canSeeMonster(defender))
            await publish(`${monsterName(defender, { state, capitalized: true })} ${wornMonsterLifeSaver(defender)
                ? 'starts to fall' : 'falls'} to pieces!`);
        return await killGolem(type, context);
    }
    await erodeArmor(defender, type === AD_RUST ? 'rust' : type === AD_CORR ? 'corrosion' : 'rot', {
        state, publish, random,
    });
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    return damageResult(0);
}

async function acidContact(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (attacker.mcan) return damageResult(0);
    const { state, visible, publish, random } = context;
    const resisted = monsterHasAcidResistance(defender)
        || monsterCombatDefense(defender, AD_ACID, state);
    if (visible && canSeeMonster(defender)) {
        const subject = monsterName(defender, { state, capitalized: true });
        const liquid = displayLiquidName('acid', state);
        await publish(`${subject} is covered in ${liquid}${resisted ? ', but it seems harmless.' : '!'}`);
        if (!resisted) await publish(`It burns ${monsterName(defender, { state })}!`);
    }
    if (!random(30)) await erodeArmor(defender, 'corrosion', { state, publish, random });
    if (!random(6)) await damageObjectWithAcid(monsterWieldedWeapon(defender), { state, publish, random });
    return damageResult(resisted ? 0 : context.damage);
}

async function killGolem(
    type: typeof AD_RUST | typeof AD_DCAY, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const death = await context.killDefender({ damageType: type, cause: null });
    return { damage: context.damage, nativeResult: death.nativeResult, done: true, heroDied: death.heroDied };
}

function damageResult(damage: number): MonsterCombatEffectResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

// Native uhitm.c:mhitm_ad_sedu()/sgld(), monster attacking monster.
const S_NYMPH = 14;

export async function applyMonsterTheftEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    return context.attack[1] === AD_SGLD
        ? stealGold(attacker, defender, context) : mhitm_ad_sedu({ attacker, defender, context });
}

async function stealGold(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const result = effectResult(0);
    if (attacker.mcan) return result;
    const gold = (defender.minvent || defender.inventory || [])
        .find(object => object.oclass === COIN_CLASS);
    if (!gold) return result;
    const { state, visible, publish } = context;
    unlinkMonsterObject(defender, gold);
    await linkObjectToMonsterInventory(attacker, gold, { state });
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const thiefName = monsterName(attacker, { state, capitalized: true });
    if (visible && canSeeMonster(defender))
        await publish(`${thiefName} steals some gold from ${monsterName(defender, { state })}.`);
    return escapeAfterTheft(attacker, thiefName, context);
}

// Shared teleport-and-disappear tail of mhitm_ad_sgld() and mhitm_ad_sedu().
async function escapeAfterTheft(
    attacker: Monster, before: string, { state, publish, visible, random, rollOne }: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (await reportMonsterTeleportRestriction(attacker, { state, publish })) return effectResult(0);
    const spotted = canSpotMonster(attacker);
    const relocation = await randomMonsterRelocation(attacker, { state, random, rollOne, flags: RLOC_NOMSG });
    if (state.program_state.gameover || relocation?.died)
        return { ...effectResult(0), nativeResult: M_ATTK_AGR_DONE, done: true, heroDied: true };
    if (visible && spotted && !canSpotMonster(attacker))
        await publish(`${before} suddenly disappears!`);
    return { ...effectResult(0), nativeResult: M_ATTK_AGR_DONE };
}

// C uhitm.c:mhitm_ad_dren/deth/pest/famn/dise/curs(), monster defenders;
// mhitm_ad_drli() lives above with its other actor branches and
// receives mhitm_ad_deth()'s redirected call, as in C.

const S_FUNGUS = 32;
const PM_GHOUL = MONSTER_NAME.indexOf('ghoul');
const PM_GREMLIN = MONSTER_NAME.indexOf('gremlin');
const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');

type DrainDamageType = typeof AD_DREN | typeof AD_DETH
    | typeof AD_DISE | typeof AD_PEST | typeof AD_FAMN | typeof AD_CURS;

export async function applyMonsterDrainEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const damageType = context.attack[1];
    if (!isDrainDamageType(damageType))
        throw new Error(`Unsupported monster drain effect ${damageType}`);
    const result: MonsterCombatEffectResult = {
        damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
    };
    switch (damageType) {
    case AD_DETH:
        if (monsterIsUndead(defender.mnum) && result.damage > 1) {
            result.damage = context.rollOne(Math.trunc(result.damage / 2));
        }
        // C mhitm_ad_deth() simulates Death's touch by redirecting to
        // mhitm_ad_drli(), whose mhitm branch lives above.
        result.damage = (await mhitmAdDrli({
            attacker, defender, context: { ...context, damage: result.damage },
        })).damage;
        return result;
    case AD_DREN:
        await drainEnergy(attacker, defender, context);
        result.damage = 0;
        return result;
    case AD_DISE:
    case AD_PEST:
        if (MONSTER_SYMBOL[defender.mnum] === S_FUNGUS || defender.mnum === PM_GHOUL
            || monsterCombatDefense(defender, AD_DISE, context.state)) {
            result.damage = 0;
        }
        return result;
    case AD_FAMN:
        if (!(carnivorous(defender.mnum) || herbivorous(defender.mnum) || metallivorous(defender.mnum))) result.damage = 0;
        return result;
    case AD_CURS:
        return curseDefender(attacker, defender, context, result);
    }
}

function isDrainDamageType(damageType: DamageType): damageType is DrainDamageType {
    return damageType === AD_DREN || damageType === AD_DETH
        || damageType === AD_DISE || damageType === AD_PEST || damageType === AD_FAMN
        || damageType === AD_CURS;
}

async function drainEnergy(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<void> {
    const { state, visible, random, rollDice, publish } = context;
    if (await mhitm_mgc_atk_negated(attacker, defender, {
        state, visible, random, publish, verbose: false,
    }) || random(4)) return;
    await drainMonsterEnergy(defender, {
        state, publish, rollDice,
        giveMessage: visible && canSpotMonster(defender) && context.attack[0] !== AT_ENGL,
    });
}

async function curseDefender(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
    result: MonsterCombatEffectResult,
): Promise<MonsterCombatEffectResult> {
    const { state, visible, random, rollDice, publish, finishDeath, growAttacker } = context;
    if (attacker.mnum === PM_GREMLIN && !sessionIsNight(state.datetime)) return result;
    if (attacker.mcan || random(10)) return result;

    defender.mcan = 1;
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    if (isWereMonster(defender) && !isHumanWereMonster(defender)) {
        // The curse calls were_change, so an unprotected beast still has
        // only its ordinary one-in-thirty chance to revert.
        await wereChange(defender, state, random, { publish });
        if (state.program_state.gameover) return { ...result, heroDied: true };
    }
    if (defender.mnum === PM_CLAY_GOLEM) {
        if (visible && canSeeMonster(defender)) {
            const name = possessiveName(monsterName(defender, { state }));
            await publish(`Some writing vanishes from ${name} head!`);
            await publish(`${monsterName(defender, { state, capitalized: true })} is destroyed!`);
        }
        const death = await finishDeath(defender, { random, rollDice, publish });
        result.done = true;
        result.heroDied = !!death.heroDied;
        if (death.survived) return result;
        result.nativeResult = M_ATTK_DEF_DIED;
        if (result.heroDied) return result;
        if (defender.mtame && !visible) {
            await publish('You have a strangely sad feeling for a moment, then it passes.');
        }
        const growth = await growAttacker(defender);
        if (!growth.survived) result.nativeResult |= M_ATTK_AGR_DIED;
        result.heroDied = growth.heroDied;
        return result;
    }
    if (!heroIsDeaf(state)) {
        if (!visible) await publishHeardMessage('laughter.', publish, state);
        else if (canSeeMonster(attacker)) {
            await publish(`${monsterName(attacker, { state, capitalized: true })} chuckles.`);
        }
    }
    return result;
}

// Native uhitm.c:mhitm_ad_tlpt()/poly()/slim() and mhitm.c:mon_poly().

export async function applyMonsterTransformEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const damageType = context.attack[1];
    if (damageType === AD_TLPT) return teleportDefender(attacker, defender, context);
    if (damageType === AD_POLY) return polymorphDefender(attacker, defender, context);
    if (damageType === AD_SLIM) return slimeDefender(attacker, defender, context);
    throw new RangeError(`Unsupported transformation attack ${damageType}`);
}

async function teleportDefender(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, publish, visible, random, rollOne } = context;
    const result = transformationResult(context.damage);
    if (attacker.mcan || context.damage >= defender.mhp
        || await reportMonsterTeleportRestriction(defender, { state, publish })) return result;
    if (await mhitm_mgc_atk_negated(attacker, defender, { verbose: true, state, publish, visible, random })) {
        if (visible) await publish(`${monsterName(defender, { state, capitalized: true })} is not affected.`);
        return result;
    }
    const spotted = canSpotMonster(defender);
    const before = visible && spotted ? monsterName(defender, { state, capitalized: true }) : '';
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const relocation = await randomMonsterRelocation(defender, { state, random, rollOne, flags: RLOC_NOMSG });
    if (relocation?.died || state.program_state.gameover) return { ...result, done: true, heroDied: true };
    if (visible && spotted && !canSpotMonster(defender) && defender !== state.u.usteed)
        await publish(`${before} suddenly disappears!`);
    if (result.damage >= defender.mhp) {
        if (defender.mhp === 1) defender.mhp++;
        result.damage = defender.mhp - 1;
    }
    return result;
}

async function polymorphDefender(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, publish, visible, random, rollOne, finishDeath } = context;
    const negated = await mhitm_mgc_atk_negated(attacker, defender, {
        state, publish, visible, random, verbose: false,
    }) || !!attacker.mspec_used;
    if (context.damage >= defender.mhp || negated) return transformationResult(context.damage);

    const oldSpecies = defender.mnum;
    const before = monsterName(defender, { state, capitalized: true });
    let damage = context.damage;
    if (monsterHasMagicResistance(defender)) {
        if (visible) await showPolymorphResistance(defender, context);
    } else if (monsterResistsEffect(defender, 12, random)) {
        await showPolymorphResistance(defender, context);
    } else if (random(25) === 0 && (defender.cham ?? NON_PM) === NON_PM
        && (defender.mcan || is_shapeshifter(defender.mnum))) {
        if (visible) await publish(`${before} shudders!`);
        defender.mhp -= damage + Math.trunc((defender.mhpmax + 1) / 2);
        damage = 0;
        if (defender.mhp <= 0) {
            // mon_poly's system shock uses monkilled but never grow_up.
            const death = await finishMonsterKilled(defender, state, {
                damageType: AD_RBRE, cause: '', publish, random, rollDice: context.rollDice,
            });
            if (death.heroDied) return { ...transformationResult(0), done: true, heroDied: true };
        }
    } else {
        const change = await changeMonsterForm(defender, null, state, {
            publish, finishDeath, creditHero: false,
        });
        if (change?.heroDied) return { ...transformationResult(0), done: true, heroDied: true };
        if (change) {
            if (visible) await announcePolymorph(defender, before, context);
            damage = 0;
            if ((monsterCanTeleport(attacker.mnum))
                && !await reportMonsterTeleportRestriction(attacker, { state, publish })) {
                const relocation = await randomMonsterRelocation(attacker, { state, random, rollOne, flags: RLOC_MSG });
                if (relocation?.died || state.program_state.gameover)
                    return { ...transformationResult(0), done: true, heroDied: true };
            }
        } else if (visible && state.flags.verbose) {
            await publish('Nothing happens.');
        }
    }
    if (defender.mnum !== oldSpecies) attacker.mspec_used = (attacker.mspec_used ?? 0) + rollOne(2);
    // mon_poly consumes this attack even when resistance left its damage
    // unchanged; the common hit-point subtraction must not run afterward.
    return {
        damage, nativeResult: M_ATTK_HIT | (defender.mhp <= 0 ? M_ATTK_DEF_DIED : 0),
        done: true, heroDied: false,
    };
}

async function showPolymorphResistance(defender: Monster, { state, publish }: MonsterCombatEffectContext): Promise<void> {
    await shieldeff(defender.mx, defender.my, state);
    if (cansee(defender.mx, defender.my))
        await publish(`${monsterName(defender, { state, capitalized: true })} resists!`);
}

async function announcePolymorph(defender: Monster, before: string, { state, publish }: MonsterCombatEffectContext): Promise<void> {
    const wasSeen = before.toLowerCase() !== 'it';
    if (canSpotMonster(defender)) {
        const description = namelessMonsterName(defender, {
            state, article: 'a', suppressIt: true, suppressInvisible: true,
        });
        const transformation = state.flags.verbose || !wasSeen ? ' undergoes a freakish metamorphosis and' : '';
        await publish(`${before}${transformation} turns into ${description}.`);
    } else if (wasSeen) {
        await publish(`${before} undergoes a freakish metamorphosis and disappears.`);
    }
}

async function slimeDefender(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, visible, publish, random, rollDice, rollOne, finishDeath } = context;
    const result = transformationResult(context.damage);
    if (await mhitm_mgc_atk_negated(attacker, defender, {
        state, visible, publish, random, verbose: false,
    }) || random(4) !== 0 || monsterIsSlimeproof(defender)) return result;
    const cure = await munslime(defender, { state, byHero: false, publish, random, rollDice, rollOne });
    if (cure.heroDied) return { ...result, done: true, heroDied: true };
    if (!cure.cured && defender.mhp > 0) {
        const change = await changeMonsterForm(defender, PM_GREEN_SLIME, state, {
            showMessage: visible && canSeeMonster(defender), publish, finishDeath, creditHero: false,
        });
        if (change?.heroDied) return { ...result, done: true, heroDied: true };
        defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
        result.nativeResult = M_ATTK_HIT;
    }
    if (attacker.mhp <= 0) result.nativeResult |= M_ATTK_AGR_DIED;
    if (defender.mhp <= 0) result.nativeResult |= M_ATTK_DEF_DIED;
    result.damage = 0;
    // Unlike polymorph, sliming retains the common knockback/zero-damage path,
    // even when the defender's cure killed one or both participants.
    return result;
}

function transformationResult(damage: number): MonsterCombatEffectResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

// Poison delivered by monster attacks. C uhitm.c:mhitm_really_poison() and
// mhitm_ad_drst()'s hero branch; mhitu.c:mpoisons_subj() composes the reason.
export function poisonAttackAttribute(damageType: DamageType): typeof A_STR | typeof A_DEX | typeof A_CON | null {
    if (damageType === AD_DRST) return A_STR;
    if (damageType === AD_DRDX) return A_DEX;
    if (damageType === AD_DRCO) return A_CON;
    return null;
}

export async function poisonHeroFromMonster(monster: Monster, attackType: AttackMethod, {
    attribute = A_STR, fatal = 30, chance = 1,
    state = game, random = rn2, publish = plineWithContinuation, ...options
}: Omit<HeroPoisonOptions, 'reason' | 'killer' | 'attribute'> & {
    chance?: number; attribute?: number;
} = {}) {
    if (chance > 1 && random(chance) !== 0) return { died: false };
    const subject = canSpotMonster(monster)
        ? possessiveName(monsterName(monster, { state, capitalized: true })) : 'Its';
    return poisonHero({
        ...options, state, random, publish, attribute, fatal,
        reason: `${subject} ${mpoisons_subj(monster, attackType)}`,
        killer: monsterTypeName(monster.mnum, !!monster.female),
    });
}

// C uhitm.c:mhitm_really_poison(): the visible-attacker poison message, the
// resistant-defender notice, and the deadly 6+rn2(10) damage live here.
export async function poisonMonsterFromAttack(attacker: Monster, defender: Monster, attackType: AttackMethod, damage: number, {
    visible, state = game, random = rn2, publish = plineWithContinuation,
}: { visible: boolean; state?: GameState; random?: (limit: number) => number; publish?: MessagePublisher }): Promise<number> {
    const attackerSpotted = canSpotMonster(attacker);
    const defenderSpotted = canSpotMonster(defender);
    if (visible && attackerSpotted) {
        await publish(`${possessiveName(monsterName(attacker, { state, capitalized: true }))} ${
            mpoisons_subj(attacker, attackType)} was poisoned!`);
    }
    if (monsterHasPoisonResistance(defender)) {
        if (visible && attackerSpotted && defenderSpotted) {
            const target = monsterName(defender, { state });
            await publish(`The poison doesn't seem to affect ${target}.`);
        }
        return damage;
    }
    damage += 6 + random(10);
    if (damage >= defender.mhp && visible && defenderSpotted)
        await publish('The poison was deadly...');
    return damage;
}

export interface MonsterBrainAttackOptions {
    state?: GameState;
    visible: boolean;
    notOnHead?: boolean;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    publish?: MessagePublisher;
    finishDeath: MonsterDeathHandler;
}

interface HeroDefenderBrainContext {
    state: PlayingGameState;
    attacker: Monster;
    attack: HeroContactAttack;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
}

type MhitmAdDrinCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderBrainContext }
    | { attacker: Monster; defender: Monster; damage: number; context: MonsterBrainAttackOptions };

// C uhitm.c:mhitm_ad_drin().
export async function mhitm_ad_drin(call: MhitmAdDrinCall): Promise<HeroNaturalEffectResult> {
    if ('magr' in call) {
        const monster = call.defender;
        const context = call.context;
        const { state, publish, random, target } = context;
        const result: HeroNaturalEffectResult = {
            damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
        };
        if (target.x !== monster.mx || target.y !== monster.my || !monsterHasHead(monster)) {
            await publish(`${monsterName(monster, { state, capitalized: true })} doesn't seem harmed.`);
            result.damage = 0;
            result.skipBrainDrain = true;
            if (!heroIsUnchanging(state) && monster.mnum === PM_GREEN_SLIME && !heroIsSliming(state)) {
                await publish("You suck in some slime and don't feel very well.");
                await setHeroSlimingTimeout(10, { state });
            }
            return result;
        }
        if (await monsterSlipsFromHeroGrip(monster, { head: true, state, publish, random }))
            return result;

        const helmet = monster.minvent?.find(object => (object.owornmask ?? 0) & W_ARMH);
        if (helmet && random(8)) {
            const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
            const kind = objectIsHardHelmet(helmet) ? 'helm' : 'hat';
            await publish(`${owner} ${kind} blocks your attack to ${monsterPossessive(monster, { state, random })} head.`);
            return result;
        }

        const amulet = monster.minvent?.find(object => (object.owornmask ?? 0) & W_AMUL);
        await eat_brains({ kind: 'hero-attacker', monster, context, result });
        if (amulet?.otyp === AMULET_OF_LIFE_SAVING
            && !monster.minvent?.some(object => (object.owornmask ?? 0) & W_AMUL))
            result.skipBrainDrain = true;
        return result;
    } else if ('mdef' in call) {
        const { state, attacker: monster, attack, publish, random, rollOne } = call.context;
        const hero = state.u;
        const baseDamage = attack.damage;
        if (baseDamage === undefined) throw new Error('Brain drain requires rolled contact damage');
        if (!monsterHasHead({ mnum: heroSpecies(state) })) {
            await publish("You don't seem harmed.");
            attack.skipBrainDrain = true;
            return { ...effectResult(attack.damage ?? baseDamage, M_ATTK_MISS, !!attack.heroDied),
                skipBrainDrain: !!attack.skipBrainDrain };
        }
        const helmet = state.uarmh ?? hero.uarmh;
        if (helmet?.greased && (!helmet.cursed || random(3))) {
            await publish(`${monsterName(monster, { state, capitalized: true })} grabs you, but cannot hold onto your greased ${objectCombatName(helmet, { state })}!`);
            if (!random(2)) {
                await publish('The grease wears off.');
                helmet.greased = false;
            }
            return { ...effectResult(attack.damage ?? baseDamage, M_ATTK_MISS, !!attack.heroDied),
                skipBrainDrain: !!attack.skipBrainDrain };
        }
        if (helmet && random(8)) {
            await publish(`Your ${armorSimpleName(helmet, state)} blocks the attack to your head.`);
            return { ...effectResult(attack.damage ?? baseDamage, M_ATTK_MISS, !!attack.heroDied),
                skipBrainDrain: !!attack.skipBrainDrain };
        }
        // Brain damage precedes the meal and bypasses negative AC. Blocked
        // tentacles instead leave their ordinary damage for hitmu's common tail.
        const damage = propertyIsActive('halfPhysicalDamage', state) || hero.halfPhysicalDamage
            ? Math.trunc((baseDamage + 1) / 2) : baseDamage;
        attack.damage = 0;
        if (await mdamageu(monster, damage, { state, publish })) {
            attack.heroDied = true;
            return { ...effectResult(attack.damage ?? baseDamage, M_ATTK_MISS, !!attack.heroDied),
                skipBrainDrain: !!attack.skipBrainDrain };
        }
        if (helmet?.otyp !== DUNCE_CAP) {
            const mortality = hero.umortality ?? 0;
            const eaten = await eat_brains({ kind: 'hero-defender', monster, attack, state, publish, rollOne });
            if ((hero.umortality ?? 0) > mortality) attack.skipBrainDrain = true;
            if (!eaten || state.program_state.gameover) return { ...effectResult(attack.damage ?? baseDamage, M_ATTK_MISS, !!attack.heroDied),
                skipBrainDrain: !!attack.skipBrainDrain };
        }
        const change = adjustAttribute(A_INT, -rollOne(2), state);
        const message = attributeChangeMessage(A_INT, change, state);
        if (message && (change.changed || change.blockedByDunceCap || state.flags.verbose))
            await publish(message);
        if (!random(5)) {
            loseHeroSpellMemory({ state });
            attack.skipBrainDrain = true;
        }
        if (!random(5)) {
            await drainHeroWeaponSkills(rollOne(2), state);
            attack.skipBrainDrain = true;
        }
        return { ...effectResult(attack.damage ?? baseDamage, M_ATTK_MISS, !!attack.heroDied),
                skipBrainDrain: !!attack.skipBrainDrain };
    } else {
        const { attacker, defender, damage } = call;
        const { state = game, visible, notOnHead = false, random = rn2, rollOne = rnd,
            publish = plineWithContinuation, finishDeath } = call.context;
        if (notOnHead || !monsterHasHead(defender)) {
            if (visible && canSpotMonster(defender)) {
                await publish(`${monsterName(defender, { state, capitalized: true })} doesn't seem harmed.`);
            }
            return { damage: 0, nativeResult: M_ATTK_MISS, skipBrainDrain: true, done: false, heroDied: false };
        }
        if (((defender.misc_worn_check ?? 0) & W_ARMH) && random(8)) {
            if (visible && canSpotMonster(attacker) && canSeeMonster(defender)) {
                const defenderName = possessiveName(monsterName(defender, { state, capitalized: true }));
                const attackerName = possessiveName(monsterName(attacker, { state }));
                const whoseHead = monsterPossessive(defender, { state, random });
                await publish(`${defenderName} helmet blocks ${attackerName} attack to ${whoseHead} head.`);
            }
            return { damage, nativeResult: M_ATTK_MISS, skipBrainDrain: false, done: false, heroDied: false };
        }

        const amulet = (defender.minvent ?? defender.inventory ?? []).find(object => (object.owornmask ?? 0) & W_AMUL);
        const lifeSaving = amulet?.otyp === AMULET_OF_LIFE_SAVING;
        const result = await eat_brains({
            kind: 'monster-defender', attacker, defender, damage,
            context: { state, visible, random, rollOne, publish, finishDeath },
        });
        return { damage: result.damage, nativeResult: result.hitFlags, done: false,
            heroDied: result.heroDied, skipBrainDrain: lifeSaving && !(defender.minvent ?? defender.inventory ?? []).some(object => (object.owornmask ?? 0) & W_AMUL) };
    }
}

// ─── C uhitm.c:m_slips_free()/mhitm_ad_stck()/mhitm_ad_wrap(), hero attacker (from hero_natural_grip.ts) ───

// Hero stick and wrap attacks. C uhitm.c:mhitm_ad_stck(), mhitm_ad_wrap().

const PM_BARBED_DEVIL = MONSTER_NAME.indexOf('barbed devil');
const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');

export async function applyHeroNaturalGrip(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    let damage = context.damage;
    if (context.attack[1] === AD_STCK) {
        await stickToMonster(monster, context);
    } else if (context.attack[1] === AD_WRAP) {
        damage = await wrapMonster(monster, context);
    } else {
        throw new RangeError(`Unsupported hero grip damage type ${context.attack[1]}`);
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

async function stickToMonster(monster: Monster, {
    state, publish, random,
}: HeroNaturalEffectContext): Promise<void> {
    const negated = await mhitm_mgc_atk_negated(state.u, monster, { state, random });
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (negated || monsterSpeciesSticks(monster.mnum) || distance > 2) return;
    setHeroGrip(monster, state);
    if (heroSpecies(state) === PM_BARBED_DEVIL) {
        const target = monsterName(monster, {
            state, article: monster.mtame ? 'your' : 'the',
            suppressSaddle: !!MGIVENNAME(monster) || state.u.usteed === monster,
        });
        await publish(`Your barbs stick to ${target}!`);
    }
}

async function wrapMonster(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
    const { state, publish, random, damage, attack, target } = context;
    if (monsterSpeciesSticks(monster.mnum)) return 0;
    const species = heroSpecies(state);
    const symbol = MONSTER_SYMBOL[species];
    const coils = monsterIsSlithy(species) && (symbol === S_SNAKE || symbol === S_NAGA);
    // The pinned source uses !notonhead here, even though hmonas rejects
    // worm-tail hugs before this effect. Retain that branch polarity.
    const tailMiss = target.x === monster.mx && target.y === monster.my;
    if (!state.u.ustuck && !tailMiss && random(10) === 0) {
        if (await monsterSlipsFromHeroGrip(monster, { head: false, state, publish, random }))
            return 0;
        await publish(`You ${coils ? 'coil' : 'swing'} yourself around ${monsterName(monster, { state })}!`);
        setHeroGrip(monster, state);
        return damage;
    }
    if (state.u.ustuck === monster && !tailMiss) {
        if (isPoolAt(state.u.ux, state.u.uy, state) && !(cant_drown(monster.mnum))) {
            await publish(`You drown ${monsterName(monster, { state })}...`);
            // damageum owns subtraction, life saving, and hero kill credit.
            return monster.mhp;
        }
        if (attack[0] === AT_HUGS)
            await publish(`${monsterName(monster, { state, capitalized: true })} is being crushed.`);
        return damage;
    }
    if (state.flags.verbose) {
        const name = monsterName(monster, { state });
        const targetName = coils && !tailMiss ? name
            : `${possessiveName(name)} ${tailMiss ? 'tail' : monsterLegName(monster.mnum)}`;
        await publish(`You brush against ${targetName}.`);
    }
    return 0;
}

interface HeroGripSlipContext {
    head: boolean;
    state: PlayingGameState;
    publish: MessagePublisher;
    random: typeof rn2;
}

// C m_slips_free(): head attacks inspect only the helmet; body grabs inspect
// the outermost clothing. A covered greased item offers no protection.
export async function monsterSlipsFromHeroGrip(
    monster: Monster, { head, state, publish, random }: HeroGripSlipContext,
): Promise<boolean> {
    const layers = head ? [W_ARMH] : [W_ARMC, W_ARM, W_ARMU];
    const armor = layers.map(mask => monster.minvent?.find(object => (object.owornmask ?? 0) & mask))
        .find(object => object !== undefined);
    if (!armor || (!armor.greased && armor.otyp !== OILSKIN_CLOAK)) return false;
    if (armor.cursed && random(3) === 0) return false;
    const target = possessiveName(monsterName(monster, { state }));
    const name = armor.greased || objectTypeKnown(armor, state)
        ? objectName(armor, state) : armorSimpleName(armor, state);
    await publish(`You ${head ? 'grab, but cannot hold onto' : 'slip off of'} ${target} ${armor.greased ? 'greased' : 'slippery'} ${name}!`);
    if (armor.greased && random(2) === 0) {
        await publish('The grease wears off.');
        armor.greased = false;
    }
    return true;
}
// C uhitm.c:mhitm_ad_wrap() against the hero, and mhitu.c:u_slip_free().
const S_NAGA = 40;
const S_SNAKE = 45;

export async function resolveMonsterWrapping(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<void> {
    const hero = state.u;
    if ((monster.mcan && hero.ustuck !== monster) || heroFormSticks(state)) {
        attack.damage = 0;
        return;
    }
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const coils = monsterIsSlithy(monster.mnum) && (symbol === S_SNAKE || symbol === S_NAGA);
    if (!hero.ustuck && random(10) === 0) {
        if (await u_slip_free(monster, attack.attackType, attack.damageType, state, random, publish)) {
            attack.damage = 0;
            return;
        }
        setHeroGrip(monster, state);
        await publish(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} ${coils ? 'coils' : 'swings'} itself around you!`, { urgent: true });
        return;
    }
    if (hero.ustuck !== monster) {
        attack.damage = 0;
        if (state.flags.verbose) {
            await publish(`${monsterName(monster, { state, capitalized: true })} brushes against ${coils ? 'you' : `your ${heroLegName(state)}`}.`);
        }
        return;
    }
    if (isPoolAt(monster.mx, monster.my, state) && !heroSurvivesWrappingUnderwater(state)) {
        await publish(`${monsterName(monster, { state, capitalized: true })} drowns you...`, { urgent: true });
        const terrain = state.level.requireAt(monster.mx, monster.my).typ;
        const medusa = state.medusa_level;
        const onMedusa = medusa && medusa.dnum === hero.uz.dnum && medusa.dlevel === hero.uz.dlevel;
        const moat = terrain !== POOL && terrain !== WATER && !onMedusa && !levelIsWaterLevel(state);
        const species = withIndefiniteArticle(monsterTypeName(monster.mnum, !!monster.female));
        const killer = `${moat ? 'moat' : 'pool of water'} by ${species}`;
        attack.heroDied = await finishHeroDeath({
            killer, deathType: DROWNING, deathVerb: 'drowned', deathLineShown: true,
            deathCause: `drowned in ${withIndefiniteArticle(killer)}`,
        });
        return;
    }
    if (attack.attackType === AT_HUGS) await publish('You are being crushed.');
}

function heroSurvivesWrappingUnderwater(state: PlayingGameState): boolean {
    return !!(state.u.swimming || state.u.amphibious || state.u.breathless || state.u.magicalBreathing
        || (monsterIsAmphibious(heroSpecies(state)) || monsterIsBreathless(heroSpecies(state)))
        || propertyIsActive('swimming', state) || propertyIsActive('magicalBreathing', state));
}

// Monster-versus-monster status attacks from uhitm.c:mhitm_adtyping();
// mhitm_ad_blnd(), mhitm_ad_stun(), mhitm_ad_legs() and mhitm_ad_ench()
// live above with their other actor branches.
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const STATUS_DAMAGE = [
    AD_HALU, AD_PLYS, AD_SLEE, AD_SLOW, AD_CONF,
    AD_WERE, AD_HEAL, AD_STCK, AD_WRAP,
] as const;

function isStatusDamage(type: DamageType): type is (typeof STATUS_DAMAGE)[number] {
    return STATUS_DAMAGE.some(candidate => candidate === type);
}

export async function applyMonsterStatusEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, publish, visible, random, rollOne, attack } = context;
    const type = attack[1];
    if (!isStatusDamage(type))
        throw new RangeError(`Unsupported monster status damage type ${type}`);
    let damage = context.damage;
    switch (type) {
    case AD_HALU:
        if (!attacker.mcan && hasEyes(defender) && defender.mcansee) {
            if (visible && canSeeMonster(defender))
                await publish(`${monsterName(defender, { state, capitalized: true })} looks ${defender.mconf ? 'more ' : ''}confused.`);
            defender.mconf = 1;
            clearWaiting(defender);
        }
        damage = 0;
        break;
    case AD_PLYS:
        if (defender.mcanmove && random(3) === 0
            && !await mhitm_mgc_atk_negated(attacker, defender, { state, visible, publish, random, verbose: true })) {
            if (visible && canSpotMonster(defender)) {
                const name = monsterName(defender, { state, capitalized: true });
                await publish(`${name} is frozen by ${monsterName(attacker, { state })}.`);
            }
            paralyzeMonster(defender, rollOne(10));
        }
        break;
    case AD_SLEE:
        // The pinned branch tries sleep twice. The first timed sleep normally
        // immobilizes the defender, so the second call rejects it. Retain the
        // resulting absence of a message, wait reset, and released grip.
        if (!defender.msleeping
            && await sleepContact(defender, rollOne(10), context)
            && await sleepContact(defender, rollOne(10), context)) {
            if (visible && canSpotMonster(defender)) {
                const name = monsterName(defender, { state, capitalized: true });
                await publish(`${name} is put to sleep by ${monsterName(attacker, { state })}.`);
            }
            clearWaiting(defender);
            if (monsterIsHelpless(defender) && state.u.ustuck === defender
                && !heroFormSticks(state) && !state.u.uswallow) {
                await publish(`${possessiveName(monsterName(defender, { state, capitalized: true }))} grip relaxes.`);
                await releaseHeroFromMonster(defender, { state, publish, rollOne });
            }
        }
        break;
    case AD_SLOW: {
        const blocked = await mhitm_mgc_atk_negated(attacker, defender, { state, visible, publish, random, verbose: false });
        if (!monsterCombatDefense(defender, AD_SLOW, state) && !blocked && defender.mspeed !== MSLOW) {
            const speed = adjustMonsterSpeed(defender, -1);
            // mon_adjust_speed() announces the change before mhitm_ad_slow() does.
            const message = canSeeMonster(defender)
                ? monsterSpeedMessage(speed, monsterName(defender, { state, capitalized: true }), state)
                : null;
            if (message) await publish(message);
            clearWaiting(defender);
            if (speed.changed && visible && canSpotMonster(defender))
                await publish(`${monsterName(defender, { state, capitalized: true })} slows down.`);
        }
        break;
    }
    case AD_CONF:
        if (!attacker.mcan && !defender.mconf && !attacker.mspec_used) {
            if (visible && canSeeMonster(defender))
                await publish(`${monsterName(defender, { state, capitalized: true })} looks confused.`);
            defender.mconf = 1;
            clearWaiting(defender);
        }
        break;
    case AD_WERE:
    case AD_HEAL:
        return context.applyPhysical();
    case AD_STCK:
        if (await mhitm_mgc_atk_negated(attacker, defender, { state, visible, publish, random, verbose: false })) damage = 0;
        break;
    case AD_WRAP:
        if (attacker.mcan) damage = 0;
        if (!damage && (canSeeMonster(attacker) || canSeeMonster(defender))) {
            const name = monsterName(attacker, { state, capitalized: true, augmentIt: true });
            await publish(`${name} brushes against ${monsterName(defender, { state, augmentIt: true })}.`);
        }
        break;
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

interface MonsterCombatBlindnessOptions {
    state?: GameState;
    visible: boolean;
    publish?: MessagePublisher;
    rollDice?: typeof d;
}

export async function applyMonsterCombatBlindness(
    attacker: Monster, defender: Monster, attack: AttackTuple,
    { state = game, visible, publish = plineWithContinuation, rollDice = d }: MonsterCombatBlindnessOptions,
): Promise<void> {
    if (!canBlindThroughContact(attacker, defender, attack, state)) return;
    if (visible && defender.mcansee && canSpotMonster(defender)) {
        let message = `${monsterName(defender, { state, capitalized: true })} is blinded`;
        if (defender.mnum === PM_ARCHON && canSeeMonster(defender))
            message += ` by ${possessiveName(monsterName(attacker, { state }))} radiance`;
        await publish(`${message}.`);
    }
    defender.mblinded = Math.min(127, (defender.mblinded ?? 0) + rollDice(attack[2], attack[3]));
    defender.mcansee = 0;
    clearWaiting(defender);
}

// C can_blnd() with no object: claws can extend temporary blindness, while
// light attacks are resisted by a defender which is already blind.
function canBlindThroughContact(attacker: Monster, defender: Monster, attack: AttackTuple, state: GameState): boolean {
    if (!hasEyes(defender) || (!defender.mcansee && !defender.mblinded)) return false;
    if (attacker.mnum === PM_RAVEN && defender.mnum === PM_RAVEN) return false;
    switch (attack[0]) {
    case AT_EXPL: case AT_BOOM: case AT_GAZE: case AT_MAGC: case AT_BREA:
        return !attacker.mcan && !monsterResistsBlindingLight(defender, state);
    case AT_WEAP: case AT_SPIT: case AT_NONE:
        return false;
    case AT_ENGL:
        return !defender.msleeping;
    case AT_CLAW:
        return !(defender.minvent ?? []).some(object =>
            ((object.owornmask ?? 0) & W_ARMH)
            && (OBJ_DESCR(object.otyp, state)) === 'visored helmet');
    case AT_TUCH: case AT_STNG:
        return !attacker.mcan;
    case AT_BITE: case AT_KICK: case AT_BUTT: case AT_HUGS: case AT_TENT:
        return true;
    }
}

function hasEyes(monster: Monster): boolean {
    return monsterHasEyes(monster.mnum);
}

function clearWaiting(monster: Monster): void {
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
}

async function sleepContact(defender: Monster, duration: number, context: MonsterCombatEffectContext): Promise<boolean> {
    if (monsterResistsSleep(defender) || monsterCombatDefense(defender, AD_SLEE, context.state)) {
        await shieldeff(defender.mx, defender.my, context.state);
        return false;
    }
    return await putMonsterToSleep(defender, duration);
}

// C uhitm.c:mhitm_ad_deth(), hero branch.
export async function resolveDeathTouchContact(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2, rollDice: typeof d,
): Promise<void> {
    if (monsterIsUndead(heroSpecies(state))) {
        attack.damage = Math.trunc(((attack.damage ?? 0) + 1) / 2);
        await publish('Was that the touch of death?');
        return;
    }
    const outcome = random(20);
    if (outcome >= 17 && !state.u.antimagic) {
        attack.heroDied = await touchHeroWithDeath(monster, state, publish, rollDice);
        attack.damage = 0;
    } else if (outcome >= 5) {
        await publish(formatFeltMessage('your life force draining away...', state));
        attack.permanentDamage = true;
    } else {
        if (state.u.antimagic) await shieldeff(state.u.ux, state.u.uy, state);
        await publish("Lucky for you, it didn't work!");
        attack.damage = 0;
    }
}

// C uhitm.c:shade_miss(), the monster-attacker and thrown halves; the
// hero-attacker wording lives in hero_physical_messages.ts. Called from
// mhitm.c:hitmm(), mhitm_ad_phys()'s mhitm branch, and mthrowu.c:thrwmm().
// Native mdamagem() makes a second, independent dmgval probe for AD_PHYS.
// The caller supplies that probe's stricter visibility (both actors seen).
interface MonsterShadeContactOptions {
    state?: GameState;
    visible: boolean;
    publish?: MessagePublisher;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
    thrown?: boolean;
}

export async function rejectMonsterShadeContact(
    aggressor: Monster, defender: Monster, weapon: GameObject | null,
    { state = game, visible, publish = plineWithContinuation, rollOne = rnd, rollDice = d, thrown = false }: MonsterShadeContactOptions,
): Promise<boolean> {
    if (!monsterIsShade(defender)
        || weapon && rollPhysicalWeaponDamage(weapon, defender, { state, rollOne, rollDice }) !== 0) return false;
    if (visible && (cansee(defender.mx, defender.my) || canSenseMonster(defender))) {
        const what = !weapon || objectCanTouchShade(weapon, state) ? 'attack' : objectCombatName(weapon, { state });
        const target = monsterName(defender, { state });
        const subject = thrown ? capitalizedDefiniteName(what, state)
            : `${possessiveName(monsterName(aggressor, { state, capitalized: true }))} ${what}`;
        await publish(`${subject} ${verbForSubject(what, 'pass')} harmlessly through ${target}.`);
        if (!canSpotMonster(defender)) await map_invisible(defender.mx, defender.my);
    }
    defender.msleeping = 0;
    return true;
}

const IRON = 11, METAL = 12, SILVER = 14;
const PUDDINGS = new Set(['black pudding', 'brown pudding'].map(name => MONSTER_NAME.indexOf(name)));
const ROPE_GOLEM = MONSTER_NAME.indexOf('rope golem');
const PM_PURPLE_WORM = MONSTER_NAME.indexOf('purple worm');
const PM_SHRIEKER = MONSTER_NAME.indexOf('shrieker');

interface HeroDefenderPhysicalContext {
    state: PlayingGameState;
    attacker: Monster;
    attack: HeroContactAttack;
    calls: MonsterCallLog;
    publish: MessagePublisher;
    random: RandomBelow;
    rollOne: RollOne;
    rollDice: RollDice;
    hitMessage?: () => Promise<string | null>;
    die?: DeathHandler;
}

type MhitmAdPhysCall =
    | { magr: 'youmonst'; defender: Monster; context: HeroNaturalEffectContext }
    | { mdef: 'youmonst'; context: HeroDefenderPhysicalContext }
    | { attacker: Monster; defender: Monster; context: MonsterCombatEffectContext };

// C uhitm.c:mhitm_ad_phys().
export async function mhitm_ad_phys(call: MhitmAdPhysCall): Promise<HeroNaturalEffectResult> {
    if ('magr' in call) {
        const monster = call.defender;
        const { state, attack, specialDamage } = call.context;
        let damage = call.context.damage;
        if (monsterIsShade(monster)) damage = 0;
        damage += specialDamage;
        if (attack[0] === AT_WEAP) return effectResult(0);
        if ([AT_KICK, AT_CLAW, AT_TUCH, AT_HUGS].includes(attack[0])) {
            if (monsterIsThickSkinned(monster))
                damage = attack[0] === AT_KICK ? 0 : Math.trunc((damage + 1) / 2);
            const bonus = state.u.udaminc ?? 0;
            if (bonus > 0) damage += bonus;
            else if (damage > 0) damage = Math.max(1, damage + bonus);
        }
        return effectResult(damage);
    } else if ('mdef' in call) {
        const { state, attacker: monster, attack, calls, publish, random, rollOne, rollDice,
            hitMessage, die } = call.context;
        let damage = attack.damage ?? 0;
        if (attack.attackType === AT_HUGS && !heroFormSticks(state)) {
            const holder = state.u.ustuck;
            const draw = (limit: number) => recordRandom(random, calls, limit);
            if (!holder && draw(2)) {
                if (await u_slip_free(monster, attack.attackType, attack.damageType, state, draw, publish)) return effectResult(0);
                setHeroGrip(monster, state);
                await publish(`${monsterName(monster, { state, capitalized: true })} grabs you!`);
            } else if (holder === monster) {
                await exerciseAttribute(A_STR, false, state);
                await publish(`You are being ${monster.mnum === ROPE_GOLEM ? 'choked' : 'crushed'}.`);
            }
            // A failed capture still deals the rolled hug damage. Another holder
            // prevents capture and crushing prose, but does not protect against it.
            return effectResult(damage);
        } else {
            const weapon = attack.attackType === AT_WEAP ? monsterWieldedWeapon(monster) : null;
            if (weapon) {
                const poisoned = (attack.roll ?? 0) <= 5
                    && (weapon.opoisoned || isPermanentlyPoisonedObject(weapon));
                if (weapon.otyp === CORPSE && touchPetrifies(weapon.corpsenm)) {
                    await publish(`${monsterSentenceSubject(monster)} hits you with the ${MONSTER_NAME[weapon.corpsenm ?? -1]} corpse.`);
                    if (await startHeroPetrificationFromMonster(monster, state)) {
                        attack.damage = 0;
                        attack.effect = 'petrifying-corpse';
                        attack.contactDone = true;
                        return { ...effectResult(0, M_ATTK_HIT), done: true };
                    }
                    damage = 1;
                }
                damage += rollPhysicalWeaponDamageAgainstHero(weapon, state, {
                    rollOne: range => { calls.push(`rnd(${range})`); return rollOne(range); },
                    rollDice: (count, sides) => { calls.push(`d(${count},${sides})`); return rollDice(count, sides); },
                });
                const gloves = (monster.minvent || []).find(object => (object.owornmask ?? 0) & W_ARMG);
                if (gloves?.otyp === GAUNTLETS_OF_POWER) damage += 3 + random(4);
                damage = Math.max(1, damage);
                const artifact = await applyArtifactHit(weapon, 'hero', damage, {
                    state, attacker: monster, dieRoll: attack.roll ?? 0, publish, random, rollOne,
                });
                if (artifact.heroDied) return { ...effectResult(0, M_ATTK_MISS, true), done: true };
                damage = artifact.damage;
                attack.specialMessage = artifact.specialMessage;
                if (hitMessage) {
                    const message = await hitMessage();
                    if (message) await publish(message);
                }
                if (!damage) return effectResult(0);
                if (objectMaterial(weapon, state) === SILVER && heroHatesSilver(state)) {
                    await publish('The silver sears your flesh!');
                    await exerciseAttribute(A_CON, false, state);
                }
                // Native calculates this trial reduction for every armed physical hit.
                // The shared hitmu() tail rolls its own reduction if division did not occur.
                let reducedDamage = damage;
                if (state.u.uac < 0) reducedDamage -= rollOne(-state.u.uac);
                reducedDamage = Math.max(1, reducedDamage);
                if (state.u.halfPhysicalDamage) reducedDamage = Math.trunc((reducedDamage + 1) / 2);
                if (state.u.mh - reducedDamage > 1 && PUDDINGS.has(state.u.umonnum)
                    && [IRON, METAL].includes(objectMaterial(weapon, state))) {
                    if (reducedDamage > 1) await exerciseAttribute(A_STR, false, state);
                    state.u.mh -= reducedDamage;
                    state.context.botl = true;
                    if (await cloneHeroMonsterForm(state))
                        await publish(`You divide as ${monsterName(monster, { state })} hits you!`);
                    damage = 0;
                }
                await erodeAttackingWeapon(state.u, weapon, { state, random, publish });
                if (poisoned) {
                    const poison = await poisonHeroFromMonster(monster, attack.attackType, {
                        attribute: A_STR, fatal: 10, state, random, rollOne, rollDice, publish,
                        ...(die ? { die } : {}),
                    });
                    if (poison.died) return { ...effectResult(0, M_ATTK_MISS, true), done: true };
                }
            } else if (hitMessage) {
                const message = await hitMessage();
                if (message) await publish(message);
            }
        }
        return effectResult(damage);
    } else {
        const { attacker: aggressor, defender, context } = call;
        const { state, visible, dieRoll, publish, random, rollOne, rollDice } = context;
        const hitOnHead = !context.notOnHead;
        let damage = context.damage;
        // hitmm's contact weapon is null for a claw. This later physical-damage
        // phase deliberately rereads the held weapon, as mhitm_ad_phys does.
        const weapon = context.attack[0] === AT_WEAP || context.attack[0] === AT_CLAW
            ? monsterWieldedWeapon(aggressor) ?? null : null;
        let nativeResult = M_ATTK_MISS;
        if (await rejectMonsterShadeContact(aggressor, defender, weapon, {
            state, visible: canSeeMonster(aggressor) && canSeeMonster(defender),
            publish, rollOne, rollDice,
        })) {
            damage = 0;
        } else if (context.attack[0] === AT_KICK && monsterIsThickSkinned(defender)) {
            damage = 0;
        } else if (weapon) {
            if (weapon.otyp === CORPSE && touchPetrifies(weapon.corpsenm)) {
                const stone = await petrifyMonsterDefender(defender, {
                    state, visible: visible && canSeeMonster(defender), publish, rollOne,
                    finishDeath: async (monster, options) => {
                        const outcome = await context.finishDeath(monster, options);
                        if (!outcome.survived && !outcome.heroDied && monster === defender)
                            return { ...outcome, heroDied: (await context.growAttacker(defender)).heroDied };
                        return outcome;
                    },
                });
                if (stone.heroDied)
                    return { damage: 0, done: true,
                        nativeResult: aggressor.mhp <= 0 || aggressor.dead ? M_ATTK_AGR_DIED : M_ATTK_MISS, heroDied: true };
                if (stone.stopped) {
                    if (!stone.survived && defender.mtame && !visible)
                        await publish('You have a peculiarly sad feeling for a moment, then it passes.');
                    return { damage: 0, done: true,
                        nativeResult: (stone.survived ? M_ATTK_MISS : M_ATTK_DEF_DIED)
                            | (aggressor.mhp <= 0 || aggressor.dead ? M_ATTK_AGR_DIED : M_ATTK_MISS), heroDied: false };
                }
                damage = stone.damage;
            }
            damage += rollPhysicalWeaponDamage(weapon, defender, { state, rollOne, rollDice });
            const gloves = (aggressor.minvent || []).find(object => (object.owornmask ?? 0) & W_ARMG);
            if (gloves?.otyp === GAUNTLETS_OF_POWER) damage += 3 + random(4);
            damage = Math.max(1, damage);
            if (weapon.oartifact) {
                const artifact = await applyArtifactHit(weapon, defender, damage, {
                    attacker: aggressor, state,
                    publish, random, rollOne, dieRoll, hitOnHead,
                });
                if (artifact.heroDied)
                    return { damage: 0, done: true,
                        nativeResult: nativeResult | (aggressor.mhp <= 0 || aggressor.dead ? M_ATTK_AGR_DIED : M_ATTK_MISS), heroDied: true };
                damage = artifact.damage;
                if (!artifact.specialMessage) {
                    await showMonsterArtifactFallbackHit(aggressor, defender, { state, visible, publish });
                    nativeResult |= M_ATTK_HIT;
                }
                if (defender.dead || defender.mhp <= 0) {
                    nativeResult = M_ATTK_DEF_DIED;
                    const growth = await context.growAttacker(defender);
                    if (!growth.survived) nativeResult |= M_ATTK_AGR_DIED;
                    if (aggressor.mhp <= 0 || aggressor.dead) nativeResult |= M_ATTK_AGR_DIED;
                    return { damage, done: true, nativeResult, heroDied: growth.heroDied };
                }
            }
            if (damage) await erodeAttackingWeapon(defender, weapon, { state, random, publish });
            if ((weapon.opoisoned || isPermanentlyPoisonedObject(weapon)) && random(4) === 0) {
                damage = await poisonMonsterFromAttack(aggressor, defender, context.attack[0], damage, {
                    state, visible, random, publish,
                });
            }
        } else if (aggressor.mnum === PM_PURPLE_WORM && defender.mnum === PM_SHRIEKER) {
            if (damage >= defender.mhp && defender.mhp > 1) damage = defender.mhp - 1;
        }
        if (aggressor.mhp <= 0 || aggressor.dead) nativeResult |= M_ATTK_AGR_DIED;
        return { damage, done: false, nativeResult, heroDied: false };
    }
}

// C uhitm.c:mhitm_ad_heal(), against the hero.
export function nurseContactMode(monster: Monster, state: PlayingGameState): 'hit' | 'heal' | 'cooperate' {
    if (monster.mcan || (Upolyd(state.u) && touchPetrifies(heroSpecies(state)))) return 'hit';
    const weapon = state.uwep || state.u.uwep;
    const armed = weapon && (weapon.oclass === WEAPON_CLASS || isWeaponTool(weapon));
    const armored = state.uarmu || state.uarm || state.uarmc || state.uarms
        || state.uarmg || state.uarmf || state.uarmh;
    if (!armed && !armored) return 'heal';
    return state.urole.key === 'healer' ? 'cooperate' : 'hit';
}

export async function resolveNurseContact(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2, rollOne: typeof rnd, rollDice: typeof d,
): Promise<void> {
    const mode = nurseContactMode(monster, state);
    if (mode === 'hit') return;
    if (mode === 'cooperate') {
        if (!heroIsDeaf(state) && state.moves % 5 === 0)
            await publish('"Doc, I can\'t help you unless you cooperate."');
        attack.damage = 0;
        return;
    }
    await publish(`${monsterName(monster, { state, capitalized: true })} hits!  (I hope you don't mind.)`);
    const hero = state.u;
    let goAway = false;
    if (Upolyd(hero)) {
        hero.mh += rollOne(7);
        if (random(7) === 0) {
            hero.mhmax++;
            goAway = random(13) === 0;
        }
        hero.mh = Math.min(hero.mh, hero.mhmax);
    } else {
        hero.uhp += rollOne(7);
        if (random(7) === 0) {
            if (hero.uhpmax < 5 * hero.ulevel + rollDice(2 * hero.ulevel, 10)) {
                hero.uhpmax++;
                hero.uhppeak = Math.max(hero.uhppeak, hero.uhpmax);
            }
            goAway = random(13) === 0;
        }
        hero.uhp = Math.min(hero.uhp, hero.uhpmax);
    }
    if (random(3) === 0) await exerciseAttribute(A_STR, true, state);
    if (random(3) === 0) await exerciseAttribute(A_CON, true, state);
    if (heroIsSick(state)) cureHeroSickness(state);
    state.context.botl = true;
    if (goAway) {
        await removeMonsterFromGame(monster);
        attack.contactDone = true;
        attack.nativeResult = M_ATTK_DEF_DIED;
        return;
    }
    if (random(33) === 0) {
        if (!await reportMonsterTeleportRestriction(monster, { state, publish }))
            await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
        await makeMonsterFlee(monster, { state, turns: rollDice(3, 6), first: true,
            announce: false, publish, random, rollOne });
        attack.contactDone = true;
        attack.nativeResult = M_ATTK_HIT | M_ATTK_DEF_DIED;
        return;
    }
    attack.damage = 0;
}

// Monster-versus-monster digestion. C uhitm.c:mhitm_ad_dgst() and the
// post-death meal effects in mhitm.c:mdamagem() (finishMonsterDigestion in
// mhitm.ts).
const PM_FAMINE = MONSTER_NAME.indexOf('Famine');
const PM_PESTILENCE = MONSTER_NAME.indexOf('Pestilence');

export async function applyMonsterDigestionEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, publish, random, rollDice } = context;
    requireLiveGame(state);
    const species = defender.mnum;
    if (monsterIsRider(defender)) {
        if (context.visible && canSeeMonster(attacker)) {
            const fate = species === PM_FAMINE ? 'belches feebly, shrivels up and dies'
                : species === PM_PESTILENCE ? 'coughs spasmodically and collapses'
                    : 'vomits violently and drops dead';
            await publish(`${monsterName(attacker, { state, capitalized: true })} ${fate}!`);
        }
        const death = await context.finishDeath(attacker, { publish, random, rollDice });
        const died = attacker.mhp <= 0;
        const heroDied = !!death.heroDied || !!state.program_state.gameover;
        if (!heroDied && died && attacker.mtame && !context.visible)
            await publish('You have a queasy feeling for a moment, then it passes.');
        return { damage: context.damage, nativeResult: died ? M_ATTK_AGR_DIED : M_ATTK_MISS,
            done: true, heroDied };
    }

    if (state.flags.verbose && !heroIsDeaf(state)) await publish('"Burrrrp!"');
    await wakeMonstersNearWithMessages(attacker.mx, attacker.my, 4, state, publish);
    const damage = defender.mhp;
    const amulet = wornMonsterLifeSaver(defender);
    if (amulet)
        await destroyObjectFromMonsterInventory(defender, amulet, state, { silently: true, publish });

    // This check precedes the lethal damage. A gas spore explodes inside
    // the eater here, and a pet's meal never creates a map corpse.
    const previousSwallower = state._monsterSwallower;
    state._monsterSwallower = attacker;
    let corpse;
    try {
        corpse = await resolveMonsterCorpseChance(defender, { state, publish, random, rollDice });
    } finally {
        state._monsterSwallower = previousSwallower;
    }
    if (corpse.heroDied)
        return { damage, nativeResult: M_ATTK_MISS, done: true, heroDied: true };
    if (corpse.leavesRemains && attacker.mhp > 0 && attacker.mtame && !attacker.isminion
        && !((state.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE)) {
        const pet = attacker.edog;
        if (!pet) throw new Error(`Digesting pet ${attacker.m_id} has no feeding state`);
        const meal = await mksobj(CORPSE, false, false);
        set_corpsenm(meal, species);
        let nutrition = petFoodNutrition(attacker, meal);
        deallocateObject(meal, state);
        if ((attacker.meating ?? 0) > 1)
            attacker.meating = Math.trunc(((attacker.meating ?? 0) + 3) / 4);
        if (nutrition > 1) nutrition = Math.trunc(nutrition / 2);
        pet.hungrytime += nutrition;
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

// A monster's passive response when the hero or an object strikes it.
// C ref: uhitm.c passive() and passive_obj().
interface PassiveOptions {
    hit?: boolean;
    defenderSurvived?: boolean;
    attackType?: AttackMethod;
    weapon?: GameObject | null;
    weaponWasDestroyed?: boolean;
    state?: GameState;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollDice?: (count: number, sides: number) => number;
    die?: DeathHandler;
}

interface PassiveContext {
    monster: Monster;
    damageType: DamageType;
    damage: number;
    hit: boolean;
    attackType: AttackMethod;
    weapon: GameObject | null;
    weaponWasDestroyed: boolean;
    state: GameState;
    publish: MessagePublisher;
    random: (limit: number) => number;
    die: DeathHandler | undefined;
}


// ─── C uhitm.c:mhitm_adtyping(), monster arm (from mhitm.ts) ───

// C uhitm.c:mhitm_adtyping(), the monster-versus-monster arm; native
// mdamagem() (mhitm.c:1059) calls it right after the attacker-petrify gate.
// The hero-attacker arm lives in hero_natural_damage.ts and the per-adtyp
// owners keep their mhitm_ad_* branches in uhitm.ts.
export async function applyMonsterCombatEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    switch (context.attack[1]) {
    case AD_PHYS: return context.applyPhysical();
    case AD_FIRE: case AD_COLD: case AD_ELEC: case AD_ACID: case AD_RUST: case AD_CORR: case AD_DCAY:
        return applyMonsterElementEffect(attacker, defender, context);
    case AD_HALU: case AD_PLYS: case AD_SLEE: case AD_SLOW: case AD_CONF:
    case AD_WERE: case AD_HEAL: case AD_STCK: case AD_WRAP:
        return applyMonsterStatusEffect(attacker, defender, context);
    // C uhitm.c:mhitm_ad_drli/blnd/ench/stun/legs() own their mhitm
    // branches in uhitm.ts.
    case AD_DRLI: return mhitmAdDrli({ attacker, defender, context });
    case AD_BLND: return mhitmAdBlnd({ attacker, defender, context });
    case AD_ENCH: return mhitmAdEnch({ attacker, defender, context });
    case AD_STUN: return mhitmAdStun({ attacker, defender, context });
    case AD_LEGS: return mhitmAdLegs({ attacker, defender, context });
    case AD_DREN: case AD_DETH: case AD_PEST: case AD_FAMN: case AD_DISE: case AD_CURS:
        return applyMonsterDrainEffect(attacker, defender, context);
    case AD_SEDU: case AD_SITM: case AD_SSEX: case AD_SGLD:
        return applyMonsterTheftEffect(attacker, defender, context);
    case AD_TLPT: case AD_POLY: case AD_SLIM:
        return applyMonsterTransformEffect(attacker, defender, context);
    case AD_DGST: return applyMonsterDigestionEffect(attacker, defender, context);
    case AD_DRIN: return mhitm_ad_drin({ attacker, defender, damage: context.damage, context });
    case AD_STON: return petrifyingEffect(attacker, defender, context);
    case AD_DRST: case AD_DRDX: case AD_DRCO: {
        let damage = context.damage;
        if (!await mhitm_mgc_atk_negated(attacker, defender, { ...context, verbose: false })
            && context.random(8) === 0)
            damage = await poisonMonsterFromAttack(attacker, defender, context.attack[0], damage, context);
        return effectResult(damage);
    }
    case AD_SAMU: case AD_MAGM: case AD_DISN: case AD_SPC1: case AD_SPC2:
    case AD_CLRC: case AD_SPEL: case AD_RBRE:
        return effectResult(0);
    }
}

async function petrifyingEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (attacker.mcan) return effectResult(context.damage);
    const stone = await petrifyMonsterDefender(defender, {
        ...context, visible: context.visible && canSeeMonster(defender),
    });
    if (stone.heroDied) return effectResult(0, M_ATTK_MISS, true);
    let nativeResult = M_ATTK_MISS;
    let heroDied = false;
    if (!stone.survived) {
        if (defender.mtame && !context.visible)
            await context.publish('You have a peculiarly sad feeling for a moment, then it passes.');
        const growth = await context.growAttacker(defender);
        nativeResult = M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED);
        heroDied = growth.heroDied;
    }
    return { damage: 0, nativeResult, done: stone.stopped, heroDied };
}

export function effectResult(damage: number, nativeResult = M_ATTK_MISS, heroDied = false): MonsterCombatEffectResult {
    return { damage, nativeResult, heroDied, done: false };
}

// ─── C uhitm.c:damageum()/mhitm_adtyping(), hero arm/demonpet() (from hero_natural_damage.ts) ───

// C uhitm.c:damageum() and the hero-attacker branches of mhitm_adtyping();
// the mhitm_ad_fire(), mhitm_ad_cold(), mhitm_ad_elec(), mhitm_ad_drli(),
// mhitm_ad_blnd(), mhitm_ad_ench(), mhitm_ad_stun() and mhitm_ad_legs()
// branches live in uhitm.ts with those functions' other actor branches.

const S_TROLL = 46;
const BLUE_DRAGON_SCALES = OBJECT_NAMES.indexOf('blue dragon scales');
const BLUE_DRAGON_SCALE_MAIL = OBJECT_NAMES.indexOf('blue dragon scale mail');
const GREEN_DRAGON_SCALES = OBJECT_NAMES.indexOf('green dragon scales');
const GREEN_DRAGON_SCALE_MAIL = OBJECT_NAMES.indexOf('green dragon scale mail');

interface HeroNaturalDamageOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    target?: Position;
}

export async function resolveHeroNaturalDamage(
    monster: Monster, attack: AttackTuple, specialDamage: number,
    {
        state = game, publish = plineWithContinuation, random = rn2,
        rollDice = d, rollOne = rnd, target = { x: monster.mx, y: monster.my },
    }: HeroNaturalDamageOptions = {},
): Promise<HeroNaturalDamageResult> {
    requirePlayingGame(state);
    const context: HeroNaturalEffectContext = {
        state, publish, random, rollDice, rollOne, target, attack, specialDamage,
        damage: rollDice(attack[2], attack[3]),
    };
    if (await summonDemonPet(context))
        return { nativeResult: M_ATTK_MISS, heroDied: !!state.program_state.gameover };

    const effect = await applyNaturalEffect(monster, context);
    const result: HeroNaturalDamageResult = {
        nativeResult: effect.nativeResult, heroDied: effect.heroDied,
    };
    if (effect.skipBrainDrain !== undefined) result.skipBrainDrain = effect.skipBrainDrain;
    if (effect.heroDied || effect.done) return result;

    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    monster.mhp -= effect.damage;
    if (monster.dead || monster.mhp <= 0) {
        const death: HeroMonsterKillOptions = { publish };
        const weapon = state.uwep || state.u.uwep;
        death.noRevive = (attack[0] === AT_WEAP || attack[0] === AT_CLAW)
            && MONSTER_SYMBOL[monster.mnum] === S_TROLL
            && artifactById(weapon?.oartifact, state)?.enumName === 'TROLLSBANE';
        if (monster.mtame && !cansee(monster.mx, monster.my)) {
            await publish(formatFeltMessage('embarrassed for a moment.', state));
            death.showKillMessage = false;
        } else if (!state.flags.verbose) {
            await publish('You destroy it!');
            death.showKillMessage = false;
        }
        // Zero means that the effect already dispatched the native death.
        if (effect.damage) await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, death);
        return { ...result, nativeResult: M_ATTK_DEF_DIED, heroDied: !!state.program_state.gameover };
    }
    return { ...result, nativeResult: M_ATTK_HIT };
}

async function applyNaturalEffect(monster: Monster, context: HeroNaturalEffectContext): Promise<HeroNaturalEffectResult> {
    const { state, publish, attack, random, rollOne } = context;
    let damage = context.damage;
    switch (attack[1]) {
    case AD_STUN: {
        // C uhitm.c:mhitm_ad_stun() uhitm branch now owns the stun attack.
        const stun = await mhitmAdStun({ magr: 'youmonst', defender: monster, context });
        damage = stun.damage;
        break;
    }
    case AD_PHYS:
    case AD_WERE:
    case AD_HEAL:
        damage = (await mhitm_ad_phys({ magr: 'youmonst', defender: monster, context })).damage;
        break;
    case AD_LEGS: {
        // C uhitm.c:mhitm_ad_legs() uhitm branch reduces to mhitm_ad_phys().
        const legs = await mhitmAdLegs({ magr: 'youmonst', defender: monster, context });
        damage = legs.damage;
        break;
    }
    case AD_FIRE: {
        // C uhitm.c:mhitm_ad_fire() uhitm branch now owns the fire attack.
        const fire = await mhitmAdFire({ magr: 'youmonst', defender: monster, context });
        damage = fire.damage;
        break;
    }
    case AD_COLD: {
        // C uhitm.c:mhitm_ad_cold() uhitm branch now owns the cold attack.
        const cold = await mhitmAdCold({ magr: 'youmonst', defender: monster, context });
        damage = cold.damage;
        break;
    }
    case AD_ELEC: {
        // C uhitm.c:mhitm_ad_elec() uhitm branch now owns the electric attack.
        const electric = await mhitmAdElec({ magr: 'youmonst', defender: monster, context });
        damage = electric.damage;
        break;
    }
    case AD_ACID:
        if (monsterHasAcidResistance(monster) || monsterHasArtifactDefense(monster, 'acid', state)) damage = 0;
        break;
    case AD_RUST:
    case AD_CORR:
    case AD_DCAY:
        await erodeNaturalTarget(monster, context);
        damage = 0;
        break;
    case AD_CURS:
        await curseNaturalTarget(monster, context);
        damage = 0;
        break;
    case AD_DETH:
        if (monsterIsUndead(monster.mnum) && damage > 1)
            damage = rollOne(Math.trunc(damage / 2));
        // C uhitm.c:mhitm_ad_deth() redirects its hero branch to
        // mhitm_ad_drli(), which lives in uhitm.ts.
        damage = (await mhitmAdDrli({
            magr: 'youmonst', defender: monster, context: { ...context, damage },
        })).damage;
        break;
    case AD_DRLI:
        // C uhitm.c:mhitm_ad_drli() uhitm branch now owns the drain attack.
        damage = (await mhitmAdDrli({ magr: 'youmonst', defender: monster, context })).damage;
        break;
    case AD_DREN:
        if (!await mhitm_mgc_atk_negated(context.state.u, monster, { ...context, verbose: false }) && !random(4))
            await drainMonsterEnergy(monster, context);
        damage = 0;
        break;
    case AD_DRST:
    case AD_DRDX:
    case AD_DRCO:
        damage = await poisonNaturalTarget(monster, context);
        break;
    case AD_PLYS:
        if (!random(3) && damage < monster.mhp && !await mhitm_mgc_atk_negated(context.state.u, monster, { ...context, verbose: true })) {
            if (!heroIsBlind(state)) await publish(`${subject(monster, context)} is frozen by you!`);
            paralyzeMonster(monster, rollOne(10));
        }
        break;
    case AD_SLEE:
        await sleepNaturalTarget(monster, context);
        break;
    case AD_SLOW:
        await slowNaturalTarget(monster, context);
        break;
    case AD_BLND: {
        // C uhitm.c:mhitm_ad_blnd() uhitm branch now owns the blinding.
        const blnd = await mhitmAdBlnd({ magr: 'youmonst', defender: monster, context });
        damage = blnd.damage;
        break;
    }
    case AD_CONF:
        if (!monster.mconf) {
            if (canSeeMonster(monster)) await publish(`${subject(monster, context)} looks confused.`);
            monster.mconf = 1;
        }
        break;
    case AD_TLPT:
        damage = await teleportNaturalTarget(monster, context);
        break;
    case AD_STON:
        await petrifyNaturalTarget(monster, context);
        damage = 0;
        break;
    case AD_SGLD:
    case AD_SITM:
    case AD_SEDU:
    case AD_SSEX:
        return applyHeroNaturalTheft(monster, context);
    case AD_DRIN:
        return mhitm_ad_drin({ magr: 'youmonst', defender: monster, context });
    case AD_STCK:
    case AD_WRAP:
        return applyHeroNaturalGrip(monster, context);
    case AD_POLY:
        return applyHeroNaturalPolymorph(monster, context);
    case AD_SLIM:
        return applyHeroNaturalSliming(monster, context);
    case AD_DISE:
    case AD_PEST:
        if (MONSTER_SYMBOL[monster.mnum] === S_FUNGUS || speciesIs(monster, 'ghoul')
            || wearsDragonDefense(monster, 'green dragon', GREEN_DRAGON_SCALES, GREEN_DRAGON_SCALE_MAIL))
            damage = 0;
        break;
    case AD_FAMN:
        if (!((carnivorous(monster.mnum) || herbivorous(monster.mnum)) || metallivorous(monster.mnum))) damage = 0;
        break;
    case AD_ENCH: {
        // C uhitm.c:mhitm_ad_ench() uhitm branch has no armor selection.
        const ench = await mhitmAdEnch({ magr: 'youmonst', defender: monster, context });
        damage = ench.damage;
        break;
    }
    case AD_DGST:
    case AD_HALU:
    case AD_SAMU:
    case AD_MAGM:
    case AD_DISN:
    case AD_SPC1:
    case AD_SPC2:
    case AD_CLRC:
    case AD_SPEL:
    case AD_RBRE:
        damage = 0;
        break;
    }
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: !!state.program_state.gameover };
}

// C uhitm.c:demonpet().
async function summonDemonPet(context: HeroNaturalEffectContext): Promise<boolean> {
    const { state, random, publish } = context;
    const species = heroSpecies(state);
    if (!(monsterIsDemon(species)) || random(13)
        || state.uwep || state.u.uwep || species === MONSTER_NAME.indexOf('amorous demon')
        || species === MONSTER_NAME.indexOf('balrog')) return false;
    await publish('Some hell-p has arrived!');
    const summonedSpecies = !random(6) ? normalDemon(state.u.ualign.type) : null;
    const pet = await makemonNear(summonedSpecies ?? species, state.u.ux, state.u.uy);
    if (pet) await tameMonster(pet, null, { state });
    exerciseWisdom(true, state);
    return true;
}

async function erodeNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { attack, state, publish, random } = context;
    if (attack[1] === AD_RUST && speciesIs(monster, 'iron golem')
        || attack[1] === AD_DCAY && (speciesIs(monster, 'wood golem') || speciesIs(monster, 'leather golem'))) {
        await publish(`${subject(monster, context)} ${wornMonsterLifeSaver(monster) ? 'starts to fall' : 'falls'} to pieces!`);
        await killNaturalTarget(monster, context);
    }
    if (!state.program_state.gameover)
        await erodeArmor(monster, attack[1] === AD_RUST ? 'rust' : attack[1] === AD_CORR ? 'corrosion' : 'rot', { state, publish, random });
}

async function curseNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { state, publish, random } = context;
    if (!sessionIsNight(state.datetime) || random(10) || monster.mcan) return;
    if (speciesIs(monster, 'clay golem')) {
        if (!heroIsBlind(state))
            await publish(`Some writing vanishes from ${possessiveName(monsterName(monster, { state }))} head!`);
        await killNaturalTarget(monster, context);
    } else {
        monster.mcan = 1;
        await publish('You chuckle.');
    }
}

async function poisonNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
    const { state, attack, random, publish } = context;
    let damage = context.damage;
    if (await mhitm_mgc_atk_negated(context.state.u, monster, { ...context, verbose: false }) || random(8)) return damage;
    const weapon = state.uwep || state.u.uwep;
    const method = attack[0];
    const noun = method === AT_WEAP ? weapon?.opoisoned ? 'weapon' : 'attack'
        : method === AT_TUCH ? 'contact' : method === AT_GAZE ? 'gaze' : method === AT_BITE ? 'bite' : 'sting';
    await publish(`Your ${noun} was poisoned!`);
    if (monsterHasPoisonResistance(monster)) {
        await publish(`The poison doesn't seem to affect ${monsterName(monster, { state })}.`);
    } else if (!random(10)) {
        await publish('Your poison was deadly...');
        damage = monster.mhp;
    } else damage += 6 + random(10);
    return damage;
}

async function sleepNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { state, publish, rollOne } = context;
    if (monster.msleeping || await mhitm_mgc_atk_negated(context.state.u, monster, { ...context, verbose: false })) return;
    const duration = rollOne(10);
    if (monsterResistsSleep(monster) || monsterHasArtifactDefense(monster, 'sleep', state)) {
        await shieldeff(monster.mx, monster.my, state);
        return;
    }
    if (!await putMonsterToSleep(monster, duration)) return;
    if (!heroIsBlind(state)) await publish(`${subject(monster, context)} is put to sleep by you!`);
    if (state.u.ustuck === monster && !state.u.uswallow && !heroFormSticks(state)) {
        await publish(`${possessiveName(subject(monster, context))} grip relaxes.`);
        await releaseHeroFromMonster(monster, { state, publish, rollOne });
    }
}

async function slowNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const blocked = await mhitm_mgc_atk_negated(context.state.u, monster, { ...context, verbose: false });
    if (blocked || monster.mspeed === MSLOW
        || wearsDragonDefense(monster, 'blue dragon', BLUE_DRAGON_SCALES, BLUE_DRAGON_SCALE_MAIL)) return;
    const speed = adjustMonsterSpeed(monster, -1);
    // mon_adjust_speed() announces the change before mhitm_ad_slow() does.
    const seen = canSeeMonster(monster);
    const message = seen ? monsterSpeedMessage(speed, subject(monster, context), context.state) : null;
    if (message) await context.publish(message);
    if (speed.changed && seen)
        await context.publish(`${subject(monster, context)} slows down.`);
}

async function teleportNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<number> {
    const { state, publish } = context;
    let damage = Math.max(1, context.damage);
    if (await mhitm_mgc_atk_negated(context.state.u, monster, { ...context, verbose: true })) {
        await publish(`${subject(monster, context)} is not affected.`);
        return damage;
    }
    const name = subject(monster, context);
    const wasSeen = canSeeMonster(monster) || !!state.u.uswallow && state.u.ustuck === monster;
    if (await teleportMonsterByHero(monster, { state, giveFeedback: false })
        && wasSeen && !(canSeeMonster(monster) || state.u.uswallow && state.u.ustuck === monster))
        await publish(`${name} suddenly disappears!`);
    if (damage >= monster.mhp) {
        if (monster.mhp === 1) monster.mhp++;
        damage = monster.mhp - 1;
    }
    return damage;
}

async function petrifyNaturalTarget(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    await petrifyMonsterFromContact(monster, {
        state: context.state, publish: context.publish, rollOne: context.rollOne, creditHero: true,
        finishDeath: (target, death) => finishHeroMonsterKillOutcome(target, target.mx, target.my, {
            ...death, publish: context.publish, showKillMessage: false,
            recordConduct: !death?.noCorpse,
        }),
    });
}

function wearsDragonDefense(monster: Monster, species: string, scales: number, mail: number): boolean {
    return speciesIs(monster, species) || (monster.minvent ?? []).some(object =>
        ((object.owornmask ?? 0) & W_ARM) && (object.otyp === scales || object.otyp === mail));
}

function speciesIs(monster: Monster, species: string): boolean {
    return MONSTER_NAME[monster.mnum] === species;
}

function subject(monster: Monster, { state }: HeroNaturalEffectContext): string {
    return monsterName(monster, { state, capitalized: true });
}

async function killNaturalTarget(monster: Monster, context: HeroNaturalEffectContext, options: HeroMonsterKillOptions = {}): Promise<void> {
    await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...options, showKillMessage: false, publish: context.publish,
    });
}

// ─── C uhitm.c:explum() (from hero_combat_explosion.ts) ───

// C uhitm.c:explum(). The attack caller announces the explosion and ends
// the hero's monster form after this effect, before passive retaliation.

interface HeroCombatExplosionOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: RandomBelow;
    rollDice?: RollDice;
}

export interface HeroCombatExplosionResult {
    nativeResult: number;
    heroDied: boolean;
}

export async function resolveHeroCombatExplosion(
    defender: Monster | null, attack: AttackTuple,
    { state = game, publish = plineWithContinuation, random = rn2, rollDice = d }: HeroCombatExplosionOptions = {},
): Promise<HeroCombatExplosionResult> {
    requirePlayingGame(state);
    const [, damageType, dice, sides] = attack;
    const damage = rollDice(dice, sides);

    if (damageType === AD_BLND) {
        if (defender && !monsterResistsBlindingLight(defender, state)) {
            await publish(`${monsterName(defender, { state, capitalized: true })} is blinded by your flash of light!`);
            defender.mblinded = Math.min((defender.mblinded ?? 0) + damage, 127);
            defender.mcansee = 0;
        }
    } else if (damageType === AD_HALU) {
        if (defender && monsterHasEyes(defender.mnum) && defender.mcansee) {
            await publish(`${monsterName(defender, { state, capitalized: true })} is affected by your flash of light!`);
            defender.mconf = 1;
        }
    } else if (damageType === AD_COLD || damageType === AD_FIRE || damageType === AD_ELEC) {
        const style = damageType === AD_COLD ? EXPL_FROSTY
            : damageType === AD_FIRE ? EXPL_FIERY : EXPL_MAGICAL;
        const blast = await explode(
            state.u.ux, state.u.uy, damageType - 1 + 20, damage, MON_EXPLODE, style,
            { state, publish, random, heroCaused: true },
        );
        const targetDied = defender !== null && defender.mhp <= 0;
        const nativeResult = targetDied ? M_ATTK_DEF_DIED : M_ATTK_HIT;
        if (blast.heroDied) return { nativeResult, heroDied: true };
        if (targetDied) return { nativeResult, heroDied: false };
    }

    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, 49, state, publish);
    return { nativeResult: M_ATTK_HIT, heroDied: false };
}

// ─── C uhitm.c:gulpum()/start_engulf()/end_engulf() (from hero_combat_engulf.ts) ───

// Hero-versus-monster engulfing and delayed digestion.
// C uhitm.c:gulpum()/start_engulf()/end_engulf(), eat.c:Finish_digestion().

interface HeroCombatEngulfOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
}

export interface HeroCombatEngulfResult {
    nativeResult: number;
    heroDied: boolean;
}

const MZ_HUGE = 4;
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const FLAMING_SPECIES = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander']
    .map(name => MONSTER_NAME.indexOf(name)));

// C uhitm.c:gulpum()
export async function resolveHeroCombatEngulf(defender: Monster, attack: AttackTuple, {
    state = game, publish = plineWithContinuation, random = rn2, rollDice = d,
}: HeroCombatEngulfOptions = {}): Promise<HeroCombatEngulfResult> {
    requirePlayingGame(state);
    const [, damageType, dice, sides] = attack;
    let damage = rollDice(dice, sides);
    const species = defender.mnum;
    const heroBody = { mnum: heroSpecies(state) };
    const digests = monsterDigests(heroBody);
    const enfolds = monsterEnfolds(heroBody);
    const expel = digests ? 'regurgitate' : enfolds ? 'release' : 'expel';
    if (!heroCanEngulf(defender, state)
        || (digests && state.u.uhunger >= 1500) || state.u.uswallow)
        return { nativeResult: M_ATTK_MISS, heroDied: false };

    if (!heroIsFlaming(state)) await snuffMonsterInventoryLights(defender, state, publish);
    if (monsterIsVampireShifter(defender)) {
        const change = await changeMonsterForm(defender, defender.cham, state, { publish });
        if (change?.heroDied) return { nativeResult: M_ATTK_MISS, heroDied: true };
        if (change) {
            await publish(`You ${digests ? 'swallow' : enfolds ? 'enclose' : 'engulf'} it, then ${expel} it.`);
            if (canSpotMonster(defender)) {
                await publish(`It turns into ${namelessMonsterName(defender, {
                    state, article: 'a', suppressIt: true, suppressInvisible: true,
                })}.`);
            } else await map_invisible(defender.mx, defender.my);
            return { nativeResult: M_ATTK_HIT, heroDied: false };
        }
    }

    const rider = monsterIsRider({ mnum: species });
    const fatal = (touchPetrifies(species) && !heroResistsStoning(state))
        || (damageType === AD_DGST && (rider || (species === PM_MEDUSA && !heroResistsStoning(state))));
    if (damageType === AD_DGST && (!state.u.slowDigestion || fatal))
        await eating_conducts(species, { state });
    if (fatal && !rider) {
        await publish(`You ${digests ? 'englut' : 'engulf'} ${monsterName(defender, { state })}.`);
        const rawName = monsterTypeName(species, !!defender.female);
        const name = (monsterHasProperName(species))
            ? rawName : withIndefiniteArticle(rawName);
        const death = await resolveImmediatePetrification({ state, publish,
            killer: `${digests ? 'swallowing' : enfolds ? 'enclosing' : 'engulfing'} ${name}${digests ? ' whole' : ''}` });
        return { nativeResult: M_ATTK_MISS, heroDied: death.died };
    }

    const display = await startHeroEngulfDisplay(defender, state, publish);
    if (damageType === AD_DGST && rider) {
        await publish('Unfortunately, digesting any of it is fatal.');
        await endHeroEngulfDisplay(display, state);
        const cause = `unwisely tried to eat ${monsterTypeName(species, !!defender.female)}`;
        const died = await finishHeroDeath({ killer: cause, deathCause: cause, deathType: DIED });
        return { nativeResult: M_ATTK_MISS, heroDied: died };
    }
    if (damageType === AD_DGST && !state.u.slowDigestion) {
        try {
            return await digestDefender(defender, species, state, { publish, random, rollDice });
        } finally {
            await endHeroEngulfDisplay(display, state);
        }
    }

    try {
        damage = await engulfDamage(defender, damageType, damage, state, { publish, random, rollDice });
    } finally {
        await endHeroEngulfDisplay(display, state);
    }
    defender.mhp -= damage;
    if (defender.mhp <= 0) {
        const death = await finishHeroMonsterKillOutcome(defender, defender.mx, defender.my, { publish });
        if (death.heroDied) return { nativeResult: death.killed ? M_ATTK_DEF_DIED : M_ATTK_MISS, heroDied: true };
        if (death.killed) return { nativeResult: M_ATTK_DEF_DIED, heroDied: false };
    }
    await publish(`You ${expel} ${monsterName(defender, { state })}!`);
    if (digests && (state.u.slowDigestion || monsterIsAnimal(heroBody)))
        await publish(`Obviously, you didn't like ${possessiveName(monsterName(defender, { state }))} taste.`);
    return { nativeResult: M_ATTK_MISS, heroDied: false };
}

function heroCanEngulf(defender: Monster, state: PlayingGameState): boolean {
    const hero = heroSpecies(state);
    const size = requireMonsterData(MONSTER_SIZE, defender.mnum);
    if (size >= MZ_HUGE || (requireMonsterData(MONSTER_SIZE, hero) < size
        && !monsterIsWhirly({ mnum: hero })) || defender.mtrapped) return false;
    if (!monsterPassesWalls(defender.mnum)
        && engulfSquareBlocked(state.level.at(defender.mx, defender.my), hero)) return false;
    return heroPassesWalls(state)
        || !engulfSquareBlocked(state.level.at(state.u.ux, state.u.uy), defender.mnum);
}

function engulfSquareBlocked(square: MapLocation | null, otherSpecies: number): boolean {
    return !square || IS_OBSTRUCTED(square.typ) || IS_TREE(square.typ)
        || (square.typ === DOOR && !!(square.doormask & (D_CLOSED | D_LOCKED)))
        || (square.typ === IRONBARS && !monsterIsWhirly({ mnum: otherSpecies }));
}

async function digestDefender(defender: Monster, species: number, state: PlayingGameState, {
    publish, random, rollDice,
}: Required<Pick<HeroCombatEngulfOptions, 'publish' | 'random' | 'rollDice'>>): Promise<HeroCombatEngulfResult> {
    const amulet = wornMonsterLifeSaver(defender);
    if (amulet) await destroyObjectFromMonsterInventory(defender, amulet, state, { silently: true, publish });
    await newuhs(false, { state });
    if (state.program_state.gameover) return { nativeResult: M_ATTK_MISS, heroDied: true };
    const previous = state._monsterSwallower;
    state._monsterSwallower = { kind: 'hero' };
    try {
        const death = await finishHeroMonsterKillOutcome(defender, defender.mx, defender.my, { noCorpse: true, publish });
        if (death.heroDied) return { nativeResult: M_ATTK_DEF_DIED, heroDied: true };
        if (!death.killed) {
            await publish(`You hurriedly regurgitate the sizzling in your ${heroStomachName(state)}.`);
            return { nativeResult: M_ATTK_DEF_DIED, heroDied: false };
        }
        const [weight, nutrition] = requireMonsterData(MONSTER_BODY_META, species);
        const corpse = await resolveMonsterCorpseChance(defender, { state, random, rollDice, publish });
        if (corpse.heroDied) return { nativeResult: M_ATTK_DEF_DIED, heroDied: true };
        const nutritious = corpse.leavesRemains && !((state.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE);
        let delay = nutritious ? 1 + (weight >> 8) : 0;
        if (nutritious) state.u.uhunger += Math.trunc((nutrition + 1) / 2);
        const doneMessage = `You totally digest ${monsterName(defender, { state })}.`;
        if (delay) {
            await publish(`You digest ${monsterName(defender, { state })}.`);
            if (state.u.slowDigestion) delay *= 2;
            nomul(-delay, state);
            state._helplessReason = 'digesting something';
            state._helplessDoneMessage = doneMessage;
            state._digestedMonsterSpecies = species;
            state._afterMove = { kind: 'finish-digestion' };
        } else await publish(doneMessage);
        if (species === PM_GREEN_SLIME) {
            if (delay) state._helplessDoneMessage = `The ${monsterTypeName(species, !!defender.female)} isn't sitting well with you.`;
            if (!heroIsUnchanging(state)) await setHeroSlimingTimeout(5, { state, publish });
        } else await exerciseAttribute(A_CON, true, state);
        return { nativeResult: M_ATTK_DEF_DIED, heroDied: false };
    } finally {
        state._monsterSwallower = previous;
    }
}

async function engulfDamage(defender: Monster, type: AttackTuple[1], damage: number, state: PlayingGameState, {
    publish, random, rollDice,
}: Required<Pick<HeroCombatEngulfOptions, 'publish' | 'random' | 'rollDice'>>): Promise<number> {
    const name = () => monsterName(defender, { state, capitalized: true });
    // Native gulpum leaves other damage types as the original physical roll.
    if (type !== AD_DGST && type !== AD_PHYS && type !== AD_ACID && type !== AD_BLND
        && type !== AD_ELEC && type !== AD_COLD && type !== AD_FIRE && type !== AD_DREN)
        return damage;
    switch (type) {
    case AD_DGST: return 0;
    case AD_PHYS:
        if (heroSpecies(state) === PM_FOG_CLOUD) {
            await publish(`${name()} is laden with your moisture.`);
            if ((monsterIsBreathless(defender.mnum) || monsterIsAmphibious(defender.mnum))
                && !FLAMING_SPECIES.has(defender.mnum)) {
                await publish(`${name()} seems unharmed.`);
                return 0;
            }
        } else await publish(`${name()} is ${monsterEnfolds({ mnum: heroSpecies(state) })
            ? 'being squashed' : 'pummeled with your debris'}!`);
        break;
    case AD_ACID:
        await publish(`${name()} is covered with your goo!`);
        if (monsterHasAcidResistance(defender)) {
            await publish(`It seems harmless to ${monsterName(defender, { state })}.`);
            return 0;
        }
        break;
    case AD_BLND:
        if (monsterHasEyes(defender.mnum)
            && (defender.mcansee || defender.mblinded) && !defender.msleeping) {
            if (defender.mcansee) await publish(`${name()} can't see in there!`);
            defender.mcansee = 0;
            defender.mblinded = Math.min(127, damage + (defender.mblinded ?? 0));
        }
        return 0;
    case AD_ELEC:
    case AD_COLD:
    case AD_FIRE:
        if (!random(2)) return 0;
        if (type === AD_ELEC) {
            await publish(`The air around ${monsterName(defender, { state })} crackles with electricity.`);
            if (monsterHasShockResistance(defender)) {
                await publish(`${name()} seems unhurt.`);
                damage = 0;
            }
        } else {
            const resists = type === AD_COLD ? monsterHasColdResistance(defender) : monsterHasFireResistance(defender);
            await publish(resists ? `${name()} seems mildly ${type === AD_COLD ? 'chilly' : 'hot'}.`
                : `${name()} is ${type === AD_COLD ? 'freezing to death' : 'burning to a crisp'}!`);
            if (resists) damage = 0;
        }
        await applyMonsterGolemEffects(defender, type, damage, { state, publish });
        break;
    case AD_DREN:
        if (!random(4)) await drainMonsterEnergy(defender, { state, publish, rollDice });
        return 0;
    }
    return damage;
}

interface EngulfDisplay { x: number; y: number; }

// C uhitm.c:start_engulf().
async function startHeroEngulfDisplay(defender: Monster, state: PlayingGameState, publish: MessagePublisher): Promise<EngulfDisplay> {
    const heroBody = { mnum: heroSpecies(state) };
    const digest = monsterDigests(heroBody);
    if (!heroIsInvisible(state)) {
        await map_location(state.u.ux, state.u.uy, true);
        const glyph = transientMonsterGlyph(heroBody);
        await show_glyph_cell(defender.mx, defender.my, glyph.ch, glyph.color, false, 0, glyph);
    }
    await publish(`You ${digest ? 'swallow' : monsterEnfolds(heroBody) ? 'enclose' : 'engulf'} ${monsterName(defender, { state })}${digest ? ' whole' : ''}!`);
    await flush_screen(1);
    await state.animationFrame?.();
    await state.animationFrame?.();
    return { x: defender.mx, y: defender.my };
}

// C uhitm.c:end_engulf().
async function endHeroEngulfDisplay(display: EngulfDisplay, state: PlayingGameState): Promise<void> {
    if (heroIsInvisible(state)) return;
    await newsym(display.x, display.y);
    await newsym(state.u.ux, state.u.uy);
}

// ─── C uhitm.c:steal_it()/theft_petrifies()/AD_SGLD/SEDU/SITM/SSEX hero arms (from hero_natural_theft.ts) ───

// Dispatch hero gold and item theft to their native effects.


export async function applyHeroNaturalTheft(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    if (context.attack[1] === AD_SGLD) await heroStealsGold(monster, context);
    else return mhitm_ad_sedu({ magr: 'youmonst', defender: monster, context });
    const heroDied = !!context.state.program_state.gameover;
    return { damage: 0, nativeResult: M_ATTK_MISS, done: heroDied, heroDied };
}

async function heroStealsGold(monster: Monster, { state, publish }: HeroNaturalEffectContext): Promise<void> {
    const gold = monsterGold(monster);
    if (gold) {
        unlinkMonsterObject(monster, gold);
        const canMerge = state.inventory.some(object => mergable(object, gold, state));
        const slots = state.inventory.filter(object => object.oclass !== COIN_CLASS).length;
        if (canMerge || slots < 52) {
            await addInventoryItem(gold, null, false);
            if (state.program_state.gameover) return;
            await publish('Your purse feels heavier.');
        } else {
            await publish(`You grab ${monsterName(monster, { state })}'s gold, but find no room in your knapsack.`);
            await dropObjectAtHero(gold, { state, publish });
            if (state.program_state.gameover) return;
        }
    }
    await exerciseAttribute(A_DEX, true, state);
}

// C uhitm.c:steal_it().
async function steal_it(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { state, publish, attack } = context;
    const inventory = monster.minvent || monster.inventory || [];
    const first = inventory[0];
    if (!first || first.oclass === COIN_CLASS && inventory.length === 1) return;

    let suit: GameObject | null = null;
    if (monster.mcanmove && heroSeductionCompatibility(monster, attack, state)) {
        const suits = inventory.filter(object => (object.owornmask ?? 0) & W_ARM);
        if (suits.length > 1) throw new Error(`Monster ${monster.m_id} wears multiple suits`);
        suit = suits[0] ?? null;
        if (suit) {
            inventory.splice(inventory.indexOf(suit), 1);
            inventory.push(suit);
        }
    }
    let gold = monsterGold(monster);
    if (suit) {
        const neuter = is_neuter(monster.mnum);
        const sameGender = !neuter && !!monster.female === !!state.u.mfemale;
        const name = monsterName(monster, { state });
        const subject = monsterSubjectPronoun(monster, { state });
        const possessive = monsterPossessive(monster, { state });
        if (sameGender && MONSTER_SYMBOL[state.u.umonnum] === S_NYMPH) {
            const capitalized = subject.charAt(0).toUpperCase() + subject.slice(1);
            await publish(`You charm ${name}.  ${capitalized} gladly hands over ${gold ? 'most of ' : ''}${possessive} possessions.`);
        } else {
            await publish(`You seduce ${name} and ${subject} starts to take off ${possessive} clothes.`);
        }
    }
    if (gold) unlinkMonsterObject(monster, gold);

    for (;;) {
        const object = (monster.minvent || monster.inventory || [])[0];
        if (!object) break;
        // Restore gold before any touch, artifact, or equipment effect can kill
        // either participant. Death and statues must retain the real inventory.
        if (gold) {
            await addObjectToMonsterInventory(monster, gold, state);
            gold = null;
        }
        if (!heroIsPolymorphed(state)) break;
        const wornMask = object.owornmask ?? 0;
        if (object.oartifact && !heroIsBlind(state)) findArtifact(object, { state });
        await removeObjectFromMonsterInventory(monster, object, state, { publish });
        if (state.program_state.gameover) return;
        if (object === suit) {
            const subject = monsterName(monster, { state, capitalized: true });
            const possessive = monsterPossessive(monster, { state });
            await publish(`${subject} finishes taking off ${possessive} suit.`);
        }
        const description = await inventoryItemDescription(object);
        const held = await holdAnotherObject(object, {
            state, publish, holdMessage: 'You steal: ',
            dropMessage: `You snatched but dropped ${description}.`,
        });
        if (held.heroDied) return;
        if (!held.object || held.object.where !== 'inventory') continue;
        if (await theft_petrifies(held.object, context)) break;

        if (wornMask & W_WEP) {
            await updateMonsterWeaponAfterPolymorph(monster, state, { publish });
        } else if (wornMask & W_ARMG) {
            const touch = await monsterSelfTouch(monster, {
                state, publish, creditHero: true,
                finishDeath: async (target, options) => finishHeroMonsterKillOutcome(
                    target, target.mx, target.my,
                    { ...options, showKillMessage: false, recordConduct: false, publish },
                ),
            });
            if (touch.heroDied || !touch.survived) break;
        }
        if (!suit) break;
        gold = monsterGold(monster);
        if (gold) unlinkMonsterObject(monster, gold);
    }
    if (gold) await addObjectToMonsterInventory(monster, gold, state);
}

// Shared coin lookup for steal_it() and the hero gold-theft effect.
function monsterGold(monster: Monster): GameObject | null {
    return (monster.minvent || monster.inventory || []).find(object => object.oclass === COIN_CLASS) ?? null;
}

// C uhitm.c:theft_petrifies().
async function theft_petrifies(object: GameObject, { state, publish }: HeroNaturalEffectContext): Promise<boolean> {
    if (state.uarmg || state.u.uarmg || object.otyp !== CORPSE
        || !touchPetrifies(object.corpsenm) || heroResistsStoning(state)) return false;
    await resolveImmediatePetrification({
        state, publish,
        killer: corpseName(object, { adjective: 'stolen', includeArticle: true }),
    });
    // Life saving does not resume this theft sequence.
    return true;
}

// ─── C uhitm.c:hmonas() (from hero_form_combat.ts) ───

// C uhitm.c:hmonas(). Each slot observes changes made by the preceding hit.

const S_KOBOLD = 11;
const S_ORC = 15;
const S_GNOME = 33;
const S_LICH = 38;
const S_MUMMY = 39;
const S_ZOMBIE = 52;

const PM_ROPE_GOLEM = MONSTER_NAME.indexOf('rope golem');

interface FormAttackSequence {
    state: PlayingGameState;
    monster: Monster;
    target: Position;
    results: number[];
    attempts: number;
    multipleWeapons: boolean;
    multipleHands: boolean;
    twoHits: number;
    oddClaw: boolean;
    weaponUsed: boolean;
    alternateWeapon: boolean;
    skipBrainDrain: boolean;
    confirmationOverridden: boolean;
}

type FormStrike =
    | { kind: 'skip' }
    | { kind: 'interrupted'; weapon: GameObject | null }
    | { kind: 'processed'; result: number; weapon: GameObject | null; heroDied: boolean; exploded?: boolean };

// C uhitm.c:hmonas()
export async function attackHeroInMonsterForm(monster: Monster, x: number, y: number, {
    confirmationOverridden = false,
}: { confirmationOverridden?: boolean } = {}): Promise<void> {
    requirePlayingGame(game);
    const results = Array<number>(6).fill(M_ATTK_MISS);
    let weaponCount = 0;
    let handCount = 0;
    for (let index = 0; index < results.length; index++) {
        const [method] = getmattk(game.u, monster, index, results, game);
        if (method === AT_WEAP) weaponCount++;
        if (method === AT_WEAP || method === AT_CLAW || method === AT_TUCH) handCount++;
    }
    const sequence: FormAttackSequence = {
        state: game, monster, target: { x, y }, results, attempts: 0,
        multipleWeapons: weaponCount > 1, multipleHands: handCount > 1,
        twoHits: 0, oddClaw: true, weaponUsed: false,
        alternateWeapon: false, skipBrainDrain: false, confirmationOverridden,
    };
    for (let index = 0; index < results.length; index++) {
        if (index > 0 && (monster.mhp <= 0
            || monsterAtPosition(game.level, x, y) !== monster)) continue;
        const attack = getmattk(game.u, monster, index, results, game);
        if (sequence.skipBrainDrain && attack[0] === AT_TENT && attack[1] === AD_DRIN) continue;
        const strike = await performFormAttack(sequence, attack, index);
        if (strike.kind === 'skip') continue;
        if (strike.kind === 'interrupted') {
            await dropCursedFormWeapon(strike.weapon, game);
            break;
        }
        results[index] = strike.result;
        if (strike.heroDied) return;
        if (strike.exploded) {
            game.u.mh = -1;
            if ((await returnHeroToHumanForm(game)).died) return;
        }
        const passive = await applyHeroContactPassive(monster, {
            hit: strike.result !== M_ATTK_MISS,
            defenderSurvived: strike.result !== M_ATTK_DEF_DIED,
            weapon: strike.weapon, attackType: attack[0], weaponWasDestroyed: false,
        });
        if (passive.heroDied) return;
        // Native knockback samples its chance even for an ineligible or missed
        // attack. Its owner, rather than this loop, decides whether it applies.
        const knockback = await mhitm_knockback(game.u, monster, {
            attackType: attack[0], damageType: attack[1],
        }, {
            weaponUsed: sequence.weaponUsed, hit: !!(strike.result & M_ATTK_HIT),
            nameMonster: target => monsterName(target),
            wakeDefender: () => wakeAttackedMonster(monster),
            finishMonsterDeath: (target, options) => finishHeroMonsterKillOutcome(target, target.mx, target.my, options),
            finishLiquidDeath: (target, options) => finishHeroLiquidMonsterDeath(target, options),
        });
        if (knockback.heroDied || knockback.knocked) break;
        if (await dropCursedFormWeapon(strike.weapon, game)) break;
        if (monster.mhp <= 0 || !Upolyd(game.u) || game.multi < 0
            || (game._helplessTurns ?? 0) > 0) break;
    }
}

async function performFormAttack(sequence: FormAttackSequence, attack: AttackTuple, index: number): Promise<FormStrike> {
    const { state, monster } = sequence;
    const method = attack[0];
    const species = heroSpecies(state);
    const symbol = MONSTER_SYMBOL[species];
    const primary = state.uwep || state.u.uwep;
    const clawUsesWeapon = method === AT_CLAW && primary
        && !heroHasNoHands(state) && !heroIsVerySmall(state) && !sequence.weaponUsed;
    const lichUsesWeapon = method === AT_TUCH && primary && symbol === S_LICH && !sequence.weaponUsed;
    const casterUsesWeapon = method === AT_MAGC
        && [S_KOBOLD, S_ORC, S_GNOME].includes(symbol ?? -1) && !sequence.weaponUsed;
    if (method === AT_WEAP || clawUsesWeapon || lichUsesWeapon || casterUsesWeapon)
        return performFormWeaponAttack(sequence, attack, index);

    switch (method) {
    case AT_CLAW: case AT_TUCH: case AT_KICK: case AT_BITE:
    case AT_STNG: case AT_BUTT: case AT_TENT:
        if (method === AT_KICK && state.u.utrap && state.u.utraptype === TT_PIT)
            return { kind: 'skip' };
        return performNaturalContact(sequence, attack);
    case AT_HUGS:
        return performHeroHug(sequence, attack, index);
    case AT_EXPL: {
        if ((await wakeAttackedMonster(monster)).heroDied)
            return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
        await plineWithContinuation('You explode!');
        const effect = await resolveHeroCombatExplosion(monster, attack);
        return { kind: 'processed', result: effect.nativeResult, weapon: null, heroDied: effect.heroDied, exploded: true };
    }
    case AT_ENGL:
        return performHeroEngulf(sequence, attack, index);
    case AT_MAGC: case AT_NONE: case AT_BOOM:
        return { kind: 'skip' };
    case AT_BREA: case AT_SPIT: case AT_GAZE:
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
    }
}

async function performFormWeaponAttack(sequence: FormAttackSequence, attack: AttackTuple, index: number): Promise<FormStrike> {
    const { state, monster, target } = sequence;
    sequence.oddClaw = !sequence.oddClaw;
    const primary = state.uwep || state.u.uwep;
    if (sequence.weaponUsed && (sequence.results[index - 1] ?? M_ATTK_MISS) > M_ATTK_MISS
        && primary && isBimanualObject(primary)) return { kind: 'skip' };
    sequence.weaponUsed = true;
    const secondary = state.uswapwep || state.u.uswapwep;
    let slot: 'uwep' | 'uswapwep' | 'uarmg' = sequence.alternateWeapon && secondary ? 'uswapwep' : 'uwep';
    if (canAlternateFormWeapon(primary, secondary, state))
        sequence.alternateWeapon = !sequence.alternateWeapon;
    const weapon = state[slot] || state.u[slot] || null;
    if (!weapon) slot = 'uarmg';
    const chance = await findHeroMeleeHitThreshold(monster, AT_WEAP, weapon, { firstAttack: sequence.attempts++ === 0, state });
    maybeUnparalyzeMeleeDefender(monster);
    const dieRoll = rnd(20);
    if (sequence.multipleWeapons) sequence.twoHits++;
    const strike = await resolveHeroWeaponHit(monster, target.x, target.y, weapon, {
        attack, hit: chance.threshold > dieRoll || !!state.u.uswallow,
        threshold: chance.threshold, armorPenalty: chance.armorPenalty, dieRoll, twoHits: sequence.twoHits,
        confirmationOverridden: sequence.confirmationOverridden,
    });
    const passiveWeapon = state[slot] || state.u[slot] || null;
    if (strike.heroDied || !strike.survived)
        return { kind: 'processed', result: M_ATTK_DEF_DIED, weapon: passiveWeapon, heroDied: strike.heroDied };
    const forwardX = state.u.ux + (state.u.dx ?? target.x - state.u.ux);
    const forwardY = state.u.uy + (state.u.dy ?? target.y - state.u.uy);
    if (monsterAtPosition(state.level, forwardX, forwardY) !== monster)
        return { kind: 'interrupted', weapon: passiveWeapon };
    if (strike.hit && attack[1] !== AD_SPEL && attack[1] !== AD_PHYS)
        return applyNaturalDamage(sequence, attack, 0, passiveWeapon);
    return { kind: 'processed', result: strike.hit ? M_ATTK_HIT : M_ATTK_MISS, weapon: passiveWeapon, heroDied: false };
}

function canAlternateFormWeapon(primary: GameObject | null | undefined, secondary: GameObject | null | undefined, state: PlayingGameState): boolean {
    return !!(primary && secondary && (primary.oclass === WEAPON_CLASS || isWeaponTool(primary))
        && !isBimanualObject(primary) && !(state.uarms || state.u.uarms)
        && !secondary.oartifact && isTwoWeaponObject(secondary) && !isBimanualObject(secondary)
        && !(objectMaterial(secondary, state) === 14 && monsterSpeciesHatesSilver(heroSpecies(state))));
}

async function performNaturalContact(sequence: FormAttackSequence, attack: AttackTuple): Promise<FormStrike> {
    const { state, monster, target } = sequence;
    const chance = await findHeroMeleeHitThreshold(monster, attack[0], null, { firstAttack: sequence.attempts++ === 0, state });
    maybeUnparalyzeMeleeDefender(monster);
    const dieRoll = rnd(20);
    if (chance.threshold <= dieRoll && !state.u.uswallow) {
        const miss = await showHeroMeleeMiss(monster, attack, chance.threshold + chance.armorPenalty > dieRoll, { state });
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: miss.heroDied };
    }
    const compatibility = state.u.uswallow ? 0 : heroSeductionCompatibility(monster, attack, state);
    if (compatibility) {
        const sees = monster.mcansee && monsterHasEyes(monster.mnum);
        await plineWithContinuation(`You ${sees ? 'smile at' : 'talk to'} ${monsterName(monster)} ${compatibility === 2 ? 'engagingly' : 'seductively'}.`);
        return applyNaturalDamage(sequence, attack, 0);
    }
    if ((await wakeAttackedMonster(monster)).heroDied)
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
    const contact = naturalContactDamage(sequence, attack);
    if (monsterIsShade(monster) && contact.damage === 0) {
        let verb = naturalContactVerb(attack[0]);
        if (verb === 'hit' || (attack[0] === AT_CLAW && monsterIsHumanoid(monster.mnum))) verb = 'attack';
        await plineWithContinuation(`Your ${verb} ${verb === 'claws' || verb === 'tentacles' ? 'pass' : 'passes'} harmlessly through ${monsterName(monster)}.`);
    } else if (!await heroGrabMisses(monster, attack, target, { state })) {
        const name = monsterName(monster);
        await plineWithContinuation(attack[0] === AT_TENT ? `Your tentacles suck ${name}.`
            : `You ${attack[0] === AT_CLAW ? 'hit' : naturalContactVerb(attack[0])} ${name}.`);
        if (attack[0] !== AT_TENT && contact.silverMask && state.flags.verbose)
            await showHeroSilverContact(monster, contact.silverMask, { state });
        return applyNaturalDamage(sequence, attack, contact.damage);
    }
    return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
}

function naturalContactDamage(sequence: FormAttackSequence, attack: AttackTuple) {
    let mask = 0;
    if (attack[0] === AT_CLAW || attack[0] === AT_TUCH) {
        sequence.oddClaw = !sequence.oddClaw;
        mask = W_ARMG | (sequence.oddClaw || !sequence.multipleHands ? W_RINGL : 0)
            | (!sequence.oddClaw || !sequence.multipleHands ? W_RINGR : 0);
    } else if (attack[0] === AT_KICK) mask = W_ARMF;
    else if (attack[0] === AT_BUTT) mask = W_ARMH;
    return mask ? specialContactDamage(sequence.state.u, sequence.monster, mask, { state: sequence.state })
        : { damage: 0, silverMask: 0 };
}

function naturalContactVerb(method: AttackTuple[0]): string {
    switch (method) {
    case AT_CLAW: return 'claws';
    case AT_TUCH: return 'touch';
    case AT_TENT: return 'tentacles';
    case AT_KICK: return 'kick';
    case AT_BUTT: return 'head butt';
    case AT_BITE: return 'bite';
    case AT_STNG: return 'sting';
    case AT_NONE: case AT_HUGS: case AT_SPIT: case AT_ENGL: case AT_BREA:
    case AT_EXPL: case AT_BOOM: case AT_GAZE: case AT_WEAP: case AT_MAGC:
        return 'hit';
    }
}

async function performHeroHug(sequence: FormAttackSequence, originalAttack: AttackTuple, index: number): Promise<FormStrike> {
    const { state, monster, target } = sequence;
    const byHand = heroSpecies(state) === PM_ROPE_GOLEM;
    const primary = state.uwep || state.u.uwep;
    const tail = monster.mx !== target.x || monster.my !== target.y;
    if (monsterSpeciesSticks(monster.mnum) || state.u.uswallow || tail
        || (byHand && (primary || !monsterHasHead(monster)))) {
        if (byHand && primary && state.u.ustuck && !state.u.uswallow
            && !monsterSpeciesSticks(state.u.ustuck.mnum)) await releaseHeroGrip(state);
        return { kind: 'skip' };
    }
    if ((await wakeAttackedMonster(monster)).heroDied)
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
    const contact = specialContactDamage(state.u, monster,
        byHand ? W_ARMG | W_RINGL | W_RINGR : W_ARMC | W_ARM | W_ARMU, { state });
    let attack = originalAttack;
    let unconcerned = byHand && !monsterCanBeStrangled(monster);
    if (unconcerned) {
        attack = [attack[0], attack[1], 1, 1];
        if (contact.damage || monsterIsMindless(monster.mnum)
            || monster.mhp <= 1 + Math.max(state.u.udaminc ?? 0, 1)) unconcerned = false;
    }
    let applies = false;
    if (monsterIsShade(monster)) {
        const verb = byHand ? 'grasp' : 'hug';
        if (contact.damage) {
            await plineWithContinuation(`You ${verb} ${monsterName(monster)}${contact.damage > 4 ? '!' : '.'}`);
            applies = true;
        } else await plineWithContinuation(`Your ${verb} passes harmlessly through ${monsterName(monster)}.`);
    } else if (!await heroGrabMisses(monster, attack, target, { state })) {
        if (state.u.ustuck === monster) {
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} is being ${byHand ? 'throttled' : 'crushed'}${unconcerned ? " but doesn't seem concerned" : ''}.`);
            applies = true;
        } else if (index >= 2 && (sequence.results[index - 1] ?? M_ATTK_MISS) > M_ATTK_MISS
            && (sequence.results[index - 2] ?? M_ATTK_MISS) > M_ATTK_MISS) {
            if (state.u.ustuck) await releaseHeroGrip(state);
            await plineWithContinuation(`You grab ${monsterName(monster)}!`);
            setHeroGrip(monster, state);
            applies = true;
        }
    }
    if (applies) {
        if (contact.silverMask && state.flags.verbose) await showHeroSilverContact(monster, contact.silverMask, { state });
        return applyNaturalDamage(sequence, attack, contact.damage);
    }
    return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
}

async function performHeroEngulf(sequence: FormAttackSequence, attack: AttackTuple, index: number): Promise<FormStrike> {
    const { state, monster, target } = sequence;
    const chance = await findHeroMeleeHitThreshold(monster, attack[0], null, { firstAttack: sequence.attempts++ === 0, state });
    maybeUnparalyzeMeleeDefender(monster);
    if (chance.threshold <= rnd(20 + index)) {
        const miss = await showHeroMeleeMiss(monster, attack, false, { state });
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: miss.heroDied };
    }
    if ((await wakeAttackedMonster(monster)).heroDied)
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: true };
    if (monsterIsShade(monster)) {
        await plineWithContinuation(`Your attempt to surround ${monsterName(monster)} is harmless.`);
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
    }
    if (await heroGrabMisses(monster, attack, target, { state }))
        return { kind: 'processed', result: M_ATTK_MISS, weapon: null, heroDied: false };
    const effect = await resolveHeroCombatEngulf(monster, attack, { state });
    if (!effect.heroDied && effect.nativeResult === M_ATTK_DEF_DIED
        && [S_ZOMBIE, S_MUMMY].includes(MONSTER_SYMBOL[monster.mnum] ?? -1)
        && rn2(5) !== 0 && !state.u.sicknessResistance) {
        await plineWithContinuation(formatFeltMessage(`${state.u.sick ? 'very ' : ''}sick.`, state));
        effect.heroDied = await mdamageu(monster, rnd(8), { state });
    }
    return { kind: 'processed', result: effect.nativeResult, weapon: null, heroDied: effect.heroDied };
}

async function applyNaturalDamage(sequence: FormAttackSequence, attack: AttackTuple, specialDamage: number, weapon: GameObject | null = null): Promise<FormStrike> {
    const effect = await resolveHeroNaturalDamage(sequence.monster, attack, specialDamage, {
        state: sequence.state, target: sequence.target,
    });
    sequence.skipBrainDrain ||= !!effect.skipBrainDrain;
    return { kind: 'processed', result: effect.nativeResult, weapon, heroDied: effect.heroDied };
}

async function dropCursedFormWeapon(weapon: GameObject | null, state: PlayingGameState): Promise<boolean> {
    if (!weapon || !weapon.cursed || weapon !== (state.uswapwep || state.u.uswapwep)) return false;
    await dropSecondaryWeapon(state);
    return true;
}
export interface PassiveEffect {
    heroDied: boolean;
    splashed?: boolean;
    appliedDamage?: number;
    resisted?: boolean;
    transformed?: boolean;
    stopped?: boolean;
    reflected?: boolean;
    hallucinatedEscape?: boolean;
}

export interface HeroContactPassiveResult extends PassiveEffect {
    handled: boolean;
    damageType?: DamageType;
    damage?: number;
}

const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_ELEC = 0x10;
const MR_ACID = 0x40;
const MR_STONE = 0x80;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_STONE_GOLEM = MONSTER_NAME.indexOf('stone golem');

export async function applyHeroContactPassive(monster: Monster, {
    hit,
    defenderSurvived = !monster.dead && monster.mhp > 0,
    attackType = AT_WEAP,
    weapon = null,
    weaponWasDestroyed = false,
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
    die,
}: PassiveOptions = {}): Promise<HeroContactPassiveResult> {
    const attack = passiveAttack(monster);
    if (!attack) return { handled: false, heroDied: false };

    const damageType = attack[1];
    const damage = passiveDamage(monster.m_lev, attack, rollDice);
    const context: PassiveContext = {
        monster,
        damageType,
        damage,
        hit: !!hit,
        attackType,
        weapon,
        weaponWasDestroyed,
        state,
        publish,
        random,
        die,
    };
    const immediate = await applyImmediatePassive(context);
    if (immediate.heroDied || immediate.stopped) {
        return {
            handled: damageType !== AD_PHYS,
            damageType,
            damage,
            ...immediate,
        };
    }

    let surviving: Partial<PassiveEffect> = {};
    if (defenderSurvived && !monster.mcan && random(3) !== 0)
        surviving = await applySurvivingMonsterPassive(context);
    return {
        handled: damageType !== AD_PHYS,
        damageType,
        damage,
        ...immediate,
        ...surviving,
    };
}

async function applyImmediatePassive(context: PassiveContext): Promise<PassiveEffect> {
    if (context.damageType === AD_ACID)
        return applyAcidPassive(context);
    if ([AD_FIRE, AD_RUST, AD_CORR].includes(context.damageType))
        return applyEquipmentPassive(context);
    if (context.damageType === AD_STON)
        return applyStonePassive(context);
    if (context.damageType === AD_MAGM)
        return applyMagicMissilePassive(context);
    if (context.damageType === AD_ENCH)
        return applyEnchantmentPassive(context);
    return { heroDied: false };
}

async function applyAcidPassive({
    monster, damage, hit, attackType, weapon, state, publish, random, die,
}: PassiveContext): Promise<PassiveEffect> {
    let appliedDamage = 0;
    let heroDied = false;
    const splashed = hit && random(2) !== 0;

    if (splashed) {
        if (heroIsBlind(state) || state.flags?.verbose === false) {
            await publish('You are splashed!');
        } else {
            await publish(
                `You are splashed by ${possessiveName(displayedMonsterName(monster, { state }))} ${displayLiquidName('acid', state)}!`,
            );
        }

        if (heroResistsAcid(state)) {
            monstersObserveHeroResistance(M_SEEN_ACID, state);
        } else {
            appliedDamage = damage;
            heroDied = await damageHero(monster, damage, {
                state, publish, die,
            });
            monstersForgetHeroResistance(M_SEEN_ACID, state);
        }

        if (!heroDied && random(30) === 0) {
            await erodeArmor(state.u, 'corrosion', {
                state,
                publish,
                random,
            });
        }
    }

    const object = hit && weapon ? objectTouchedByAttack(state, attackType, weapon) : null;
    if (!heroDied && object && random(6) === 0) {
        await erodeObject(object, 'corrosion', {
            state,
            publish,
            random,
            verbose: attackType === AT_KICK,
        });
    }

    if (!heroDied) await exerciseAttribute(A_STR, false, state);
    return { splashed, appliedDamage, heroDied };
}

async function applyEquipmentPassive(context: PassiveContext): Promise<PassiveEffect> {
    const {
        monster, hit, attackType, weapon, state,
    } = context;
    if (!hit || monster.mcan || !weapon
        || ![AT_KICK, AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH]
            .includes(attackType)) return { heroDied: false };
    await applyMonsterPassiveToObject(monster, weapon, {
        carried: true,
        attackType,
        state,
    });
    return { heroDied: false };
}

async function applyStonePassive({
    monster, hit, attackType, weaponWasDestroyed, state, publish, die,
}: PassiveContext): Promise<PassiveEffect> {
    const wornMask = (state.inventory || []).reduce(
        (mask, object) => mask | (object.owornmask ?? 0), 0,
    );
    // hmonas turns a small caster's spell slot into a hand strike. Its
    // contact needs the same insulation as a claw, rather than a spell.
    const contactType = attackType === AT_MAGC ? AT_CLAW : attackType;
    if (!hit || contactIsProtected(
        contactType, wornMask, !!(state.uwep || state.u.uwep) || weaponWasDestroyed,
    ) || heroResists(state, 'stoneResistance', MR_STONE)) {
        return { heroDied: false };
    }
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const result = await polymonHero(PM_STONE_GOLEM);
        if (result.transformed || result.died)
            return { heroDied: !!result.died, transformed: result.transformed };
    }
    if (die) {
        await publish('You turn to stone...');
        const heroDied = await die({
            killer: passiveMonsterName(monster), deathVerb: 'turned to stone',
            deathLineShown: true, deathType: STONING,
        });
        return { heroDied, stopped: true };
    }
    return {
        heroDied: await finishMonsterAttackDeath(monster, { deathType: STONING }),
        stopped: true,
    };
}

async function applyMagicMissilePassive({
    monster, damage, state, publish, die,
}: PassiveContext): Promise<PassiveEffect> {
    if (heroResistsMagic(state)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        await publish('A hail of magic missiles narrowly misses you!');
        return { resisted: true, heroDied: false };
    }

    await publish('You are hit by magic missiles appearing from thin air!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    monstersForgetHeroResistance(M_SEEN_MAGR, state);
    return { resisted: false, appliedDamage: damage, heroDied };
}

async function applyEnchantmentPassive({
    monster, hit, attackType, weapon, state, random,
}: PassiveContext): Promise<PassiveEffect> {
    if (!hit) return { heroDied: false };
    const object = objectTouchedByEnchantment(
        state, attackType, weapon, random,
    );
    if (!object) return { heroDied: false };
    await applyMonsterPassiveToObject(monster, object, {
        carried: true,
        attackType,
        state,
        random,
    });
    return { heroDied: false };
}

async function applySurvivingMonsterPassive(context: PassiveContext): Promise<PassiveEffect> {
    if (context.damageType === AD_PLYS)
        return applyParalysisPassive(context);
    if (context.damageType === AD_COLD)
        return applyColdPassive(context);
    if (context.damageType === AD_STUN)
        return applyStunPassive(context);
    if (context.damageType === AD_FIRE)
        return applyFirePassive(context);
    if (context.damageType === AD_ELEC)
        return applyElectricPassive(context);
    return { heroDied: false };
}

async function applyParalysisPassive({
    monster, damage, state, publish, random,
}: PassiveContext): Promise<PassiveEffect> {
    if (monster.mnum !== PM_FLOATING_EYE) {
        if (heroHasFreeAction(state)) {
            await publish('You momentarily stiffen.');
            return { resisted: true, heroDied: false };
        }
        await publish(
            `You are frozen by ${displayedMonsterName(monster, { state })}!`,
        );
        freezeHero(state, damage, passiveParalysisReason(monster, state, false));
        await exerciseAttribute(A_DEX, false, state);
        return { stopped: true, heroDied: false };
    }

    if (!canSeeMonster(monster))
        return { heroDied: false };
    if (monster.mcansee !== 0) {
        // C evaluates ureflects()'s name argument even when nothing reflects.
        const reflectionOwner = possessiveName(displayedMonsterName(monster, { state, capitalized: true }));
        if (heroReflectsRay(state)) {
            const source = ureflects(state);
            await publish(
                `${reflectionOwner} gaze is reflected by your ${
                    source?.noun || 'body'
                }.`,
            );
            return { reflected: true, heroDied: false };
        }
        if (heroIsHallucinating(state) && random(4) !== 0) {
            const subject = displayedMonsterName(monster, { state, capitalized: true });
            const degree = random(2) === 0 ? '' : 'rather ';
            const reaction = random(2) === 0 ? 'numb' : 'stupefied';
            await publish(`${subject} looks ${degree}${reaction}.`);
            return { hallucinatedEscape: true, heroDied: false };
        }
        const owner = possessiveName(displayedMonsterName(monster, { state }));
        if (heroHasFreeAction(state)) {
            await publish(`You momentarily stiffen under ${owner} gaze!`);
            return { resisted: true, heroDied: false };
        }

        await publish(`You are frozen by ${owner} gaze!`);
        const duration = currentAttribute(A_WIS, state) > 12
            || random(4) !== 0 ? damage : 127;
        freezeHero(state, duration, passiveParalysisReason(monster, state, true));
        return { stopped: true, heroDied: false };
    }

    await publish(
        `${displayedMonsterName(monster, { state, capitalized: true, adjective: 'blind' })} cannot defend itself.`,
    );
    if (random(500) === 0) {
        changeHeroLuck(-1, state);
    }
    return { heroDied: false };
}

async function applyColdPassive(context: PassiveContext): Promise<PassiveEffect> {
    const {
        monster, damage, state, publish, random, die,
    } = context;
    if (!monsterNearHero(monster, state)) return { heroDied: false };
    if (heroResists(state, 'coldResistance', MR_COLD)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish(formatFeltMessage('a mild chill.', state));
        monstersObserveHeroResistance(M_SEEN_COLD, state);
        await applyHeroGolemEffects(AD_COLD, damage, { state, publish });
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_COLD, state);
    await publish('You are suddenly very cold!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    if (heroDied) return { appliedDamage: damage, heroDied };

    healMonster(monster, Math.trunc((damage + random(2)) / 2), Math.trunc((damage + 1) / 2));
    if ((monster.mhpmax ?? 0) > ((monster.m_lev ?? 0) + 1) * 8)
        await splitMonster(monster, state, { heatSource: 'hero', publish });
    return { appliedDamage: damage, heroDied: false };
}

async function applyStunPassive({ damage, state, publish }: PassiveContext): Promise<PassiveEffect> {
    const hero = state.u;
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0 || damage <= 0)
        return { heroDied: false };
    await makeStunned(damage, { state, publish });
    return { heroDied: false };
}

async function applyFirePassive({ monster, damage, state, publish, die }: PassiveContext): Promise<PassiveEffect> {
    if (!monsterNearHero(monster, state)) return { heroDied: false };
    if (heroResists(state, 'fireResistance', MR_FIRE)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish(formatFeltMessage('mildly warm.', state));
        monstersObserveHeroResistance(M_SEEN_FIRE, state);
        await applyHeroGolemEffects(AD_FIRE, damage, { state, publish });
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_FIRE, state);
    await publish('You are suddenly very hot!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    return { appliedDamage: damage, heroDied };
}

async function applyElectricPassive({ monster, damage, state, publish, die }: PassiveContext): Promise<PassiveEffect> {
    if (heroResists(state, 'shockResistance', MR_ELEC)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish(formatFeltMessage('a mild tingle.', state));
        monstersObserveHeroResistance(M_SEEN_ELEC, state);
        await applyHeroGolemEffects(AD_ELEC, damage, { state, publish });
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_ELEC, state);
    await publish('You are jolted with electricity!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    return { appliedDamage: damage, heroDied };
}

async function damageHero(monster: Monster, amount: number, { state, publish, die }: Pick<PassiveContext, 'state' | 'publish' | 'die'>): Promise<boolean> {
    if (!die) return mdamageu(monster, amount, { state, publish });
    return mdamageu(monster, amount, {
        state, publish, die: async victim => die({ killer: passiveMonsterName(victim) }),
    });
}

function heroResists(state: GameState, property: 'acidResistance' | 'coldResistance' | 'fireResistance' | 'shockResistance' | 'stoneResistance', mask: number): boolean {
    const hero = state.u;
    if (hero[property] || hasWornProperty(property, state)) return true;
    const form = heroMonsterForm(state);
    return form != null && ((MONSTER_RESISTS[form] ?? 0) & mask) !== 0;
}

function heroResistsAcid(state: GameState): boolean {
    return heroResists(state, 'acidResistance', MR_ACID);
}

function heroResistsMagic(state: GameState): boolean {
    const hero = state.u;
    if (hero.antimagic
        || hasWornProperty('antimagic', state)) return true;
    const form = heroMonsterForm(state);
    if (form == null) return false;
    const name = MONSTER_NAME[form];
    return name === 'baby gray dragon'
        || (MONSTER_ATTACKS[form] || []).some(
            attack => attack[1] === AD_MAGM,
        );
}

function objectTouchedByAttack(state: GameState, attackType: AttackMethod, weapon: GameObject | null): GameObject | null {
    if (attackType === AT_KICK)
        return weapon || state.uarmf || state.u?.uarmf || null;
    return [AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH].includes(attackType)
        ? weapon : null;
}

function objectTouchedByEnchantment(
    state: GameState, attackType: AttackMethod, weapon: GameObject | null,
    random: typeof rn2 = rn2,
): GameObject | null {
    if (attackType === AT_KICK) return weapon;
    if (attackType === AT_BITE || attackType === AT_BUTT
        || (attackType >= AT_STNG && attackType < AT_WEAP)) return null;
    if (weapon) return weapon;
    // C passive_obj() with no object picks the secondary weapon half the
    // time while dual-wielding, then the gloves.
    const secondary = state.uswapwep || state.u?.uswapwep || null;
    if (state.u.twoweap && secondary && random(2) === 0) return secondary;
    return state.uwep || state.u?.uwep || state.uarmg || state.u?.uarmg || null;
}

// C uhitm.c:passive() sets nomovemsg to You_can_move_again for the cube and
// clears it for the floating eye, which unmul() also turns into that message.
function freezeHero(state: GameState, turns: number, reason: MonsterHelplessnessReason): void {
    state._occupation = null;
    nomul(-Math.max(0, turns), state);
    state._helplessReason = reason;
    state._helplessDoneMessage = 'You can move again.';
}

function monsterNearHero(monster: Monster, state: GameState): boolean {
    return Math.max(
        Math.abs((monster.mx ?? 0) - (state.u?.ux ?? 0)),
        Math.abs((monster.my ?? 0) - (state.u?.uy ?? 0)),
    ) <= 1;
}

export function passiveAttack(monster: Pick<Monster, 'mnum'> | null | undefined): MonsterAttack | null {
    if (!monster) return null;
    return (MONSTER_ATTACKS[monster.mnum] || []).find(
        ([attackType]) => attackType === AT_NONE,
    ) || null;
}

export function passiveDamage(level: number, attack: MonsterAttack, rollDice: (count: number, sides: number) => number): number {
    const [, , dice, sides] = attack;
    if (dice > 0) return rollDice(dice, sides);
    if (sides > 0) return rollDice(level + 1, sides);
    return 0;
}

// Renamed from monsterName() when passive() moved here: uhitm.ts already
// imports the shared monster namer under that name.
function passiveMonsterName(monster: Monster): string {
    return monster.name || monsterTypeName(monster.mnum, !!monster.female);
}

function passiveParalysisReason(monster: Monster, state: GameState, gaze: boolean): MonsterHelplessnessReason {
    const species = namelessMonsterName(monster, {
        state, article: 'a', suppressIt: true, suppressInvisible: true,
        suppressHallucination: true, suppressSaddle: true,
    });
    return { monsterId: monster.m_id, text: `frozen by ${gaze ? `${possessiveName(species)} gaze` : species}` };
}

function isHeroDefender(defender: Hero | Monster, state: GameState): defender is Hero {
    return defender === state.u;
}

// passive_obj() also applies to the hero's current body after a missile hits.
// The caller still owns the object's eventual inventory or floor location.
export async function applyMonsterPassiveToObject(
    defender: Hero | Monster, object: GameObject, {
        carried = object.where === 'inventory', attackType = null, state = game,
        publish = plineWithContinuation, random = rn2,
    }: {
        carried?: boolean; attackType?: AttackMethod | null; state?: GameState;
        publish?: MessagePublisher; random?: typeof rn2;
    } = {},
): Promise<void> {
    const species = isHeroDefender(defender, state) ? heroSpecies(state) : defender.mnum;
    const passive = requireMonsterData(MONSTER_ATTACKS, species)
        .find(([method]) => method === AT_NONE);
    if (!passive) return;
    const type = passive[1];
    if (type === AD_ENCH) {
        if (defender.mcan) return;
        if (!await drainObjectEnchantment(object, { state, random, byHero: true })) return;
        if (carried) state._armorClassDirty = true;
        if (carried && (object.known || object.oclass === ARMOR_CLASS)) {
            observeObjectForNaming(object, { state });
            await publish(`${ownedObjectAction(object, 'seem', state)} less effective.`);
        }
        return;
    }

    let kind: ErosionKind;
    if (type === AD_FIRE) {
        if (random(6) !== 0 || defender.mcan
            || (attackType !== AT_KICK
                && MONSTER_NAME[species] === 'steam vortex')) return;
        kind = 'burn';
    } else if (type === AD_RUST || type === AD_CORR) {
        if (defender.mcan) return;
        kind = type === AD_RUST ? 'rust' : 'corrosion';
    } else if (type === AD_ACID) {
        if (random(6) !== 0) return;
        kind = 'corrosion';
    } else {
        return;
    }
    await erodeObject(object, kind, {
        state, publish, random, verbose: attackType === AT_KICK,
        position: isHeroDefender(defender, state)
            ? { x: defender.ux, y: defender.uy }
            : { x: defender.mx, y: defender.my },
    });
}

// C uhitm.c:mhitm_ad_were(), mhitm_ad_slee(), mhitm_ad_poly(), and mhitm_ad_tlpt().
// These effects resume after hitmsg(); polymorph negation precedes hitmsg().
interface ContactEffectOptions {
    state: PlayingGameState;
    publish: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
}

export async function resolveMonsterContactEffect(
    monster: Monster, attack: HeroContactAttack,
    { state, publish, random = rn2, rollOne = rnd, rollDice = d }: ContactEffectOptions,
): Promise<void> {
    attack.deferredSpecialContact = false;
    if (attack.damageType === AD_DRIN)
        await mhitm_ad_drin({ mdef: 'youmonst', context: { attacker: monster, attack, state, publish, random, rollOne } });
    else if (attack.damageType === AD_WERE)
        await infectHero(monster, state, publish, random);
    else if (attack.damageType === AD_SLEE)
        await sleepHero(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_POLY)
        await polymorphHeroOnContact(monster, attack, state, publish, rollOne);
    else if (attack.damageType === AD_TLPT)
        await teleportHeroOnContact(monster, attack, state, publish, random);
    else if (attack.damageType === AD_PLYS)
        await paralyzeHero(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_WRAP)
        await resolveMonsterWrapping(monster, attack, state, publish, random);
    else if (attack.damageType === AD_CURS)
        await curseHero(monster, state, publish, random);
    else if (attack.damageType === AD_HEAL)
        await resolveNurseContact(monster, attack, state, publish, random, rollOne, rollDice);
    else if (attack.damageType === AD_ACID)
        await splashHeroWithAcid(monster, attack, state, publish, random);
    else if (attack.damageType === AD_SLOW) {
        if (!attack.negated && heroHasRemovableSpeed(state) && random(4) === 0)
            await u_slow_down(state, publish);
    }
    else if (attack.damageType === AD_SGLD)
        await stealHeroGold(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_SSEX)
        await doseduce(monster, attack, state, publish, random, rollOne);
    else if (attack.damageType === AD_DISE) {
        if (!await diseasemu(monster, state, publish, random)) attack.damage = 0;
    }
    else if (attack.damageType === AD_PEST)
        await diseasemu(monster, state, publish, random);
    else if (attack.damageType === AD_DETH)
        await resolveDeathTouchContact(monster, attack, state, publish, random, rollDice);
    else if (attack.damageType === AD_SAMU) {
        if (random(20) === 0) await stealHeroQuestObject(monster, state, publish, random, rollOne);
    }
    else if (attack.damageType === AD_FAMN) {
        await exerciseAttribute(A_CON, false, state);
        if (state.u.uhs !== FAINTED) await morehungry(random(40) + 40, { state });
    }
    else if (attack.damageType === AD_CONF) {
        const duration = attack.damage ?? 0;
        if (!monster.mcan && random(4) === 0 && !monster.mspec_used) {
            monster.mspec_used = duration + random(6);
            await publish(state.u.confusionTurns ? 'You are getting even more confused.'
                : 'You are getting confused.');
            await makeConfused((state.u.confusionTurns ?? 0) + duration, { state, publish, talk: false });
        }
        attack.damage = 0;
    }
    else throw new Error(`Damage type ${attack.damageType} has no deferred contact effect`);
}

async function splashHeroWithAcid(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<void> {
    if (monster.mcan || random(3) !== 0) {
        attack.damage = 0;
        return;
    }
    const liquid = displayLiquidName('acid', state);
    const seesHero = (observer: Monster) => monsterHasLineOfSightToHero(observer, state);
    if (state.u.acidResistance) {
        await publish(`You're covered in ${liquid}, but it seems harmless.`);
        monstersObserveHeroResistance(M_SEEN_ACID, state, seesHero);
        attack.damage = 0;
    } else {
        await publish(`You're covered in ${liquid}!  It burns!`);
        await exerciseAttribute(A_STR, false, state);
        monstersForgetHeroResistance(M_SEEN_ACID, state, seesHero);
    }
}

// C uhitm.c:mhitm_ad_curs(). A daytime gremlin still makes contact, but
// only its nighttime curse can remove and retain a hero's intrinsic.
async function curseHero(
    monster: Monster, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<void> {
    if (monster.mnum === MONSTER_NAME.indexOf('gremlin') && !sessionIsNight(state.datetime)) return;
    if (monster.mcan || random(10) !== 0) return;
    if (!heroIsDeaf(state)) {
        if (heroIsBlind(state)) await publishHeardMessage('laughter.', publish, state);
        else await publish(`${monsterName(monster, { state, capitalized: true })} chuckles.`);
    }
    if (state.u.umonnum === MONSTER_NAME.indexOf('clay golem')) {
        await publish('Some writing vanishes from your head!');
        await returnHeroToHumanForm(state, { publish });
        return;
    }
    await grantMonsterIntrinsic(monster, await attrcurse({ publish }), state, publish);
}

// C uhitm.c:mhitm_ad_plys(). Existing helplessness skips the paralysis
// chance, but cancellation and Free action leave the contact damage intact.
async function paralyzeHero(
    monster: Monster, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2, rollOne: typeof rnd,
): Promise<void> {
    if (heroHasInvoluntaryDelay(state) || random(3) !== 0) return;
    if (await mhitm_mgc_atk_negated(monster, state.u, { state, publish, random, verbose: true })) return;
    if (heroHasFreeAction(state)) {
        await publish('You momentarily stiffen.');
        return;
    }
    await publish(heroIsBlind(state) ? 'You are frozen!'
        : `You are frozen by ${monsterName(monster, { state })}!`);
    nomul(-rollOne(10), state);
    state._helplessDoneMessage = 'You can move again.';
    state._helplessReason = {
        monsterId: monster.m_id,
        text: `paralyzed by ${namelessMonsterName(monster, {
            state, article: 'a', suppressIt: true, suppressInvisible: true,
            suppressHallucination: true, suppressSaddle: true,
        })}`,
    };
    await exerciseAttribute(A_DEX, false, state);
}

async function teleportHeroOnContact(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<void> {
    if (await mhitm_mgc_atk_negated(monster, state.u, { state, random })) {
        await publish('You are not affected.');
        return;
    }
    if (state.flags.verbose) {
        const controlled = heroControlsTeleport(state)
            && !state.u.stunned && !(state.u.stunnedTurns ?? 0)
            && !heroIsUnconscious(state);
        await publish(`Your position suddenly seems ${controlled ? '' : 'very '}uncertain!`);
    }
    await teleportHero({ chooseDestination: askTeleportDestination });
    const hp = Upolyd(state.u) ? 'mh' : 'uhp';
    const damage = attack.damage ?? 0;
    const half = !!state.u.halfPhysicalDamage;
    if ((half ? Math.trunc((damage - 1) / 2) : damage) < state.u[hp]) return;
    attack.damage = (state.u[hp] - 1) * (half ? 2 : 1);
    if (attack.damage < 1) {
        attack.damage = 1;
        if (state.u[hp] === 1) state.u[hp]++;
    }
}

async function infectHero(
    monster: Monster, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<void> {
    if (random(4) !== 0 || state.u.ulycn !== -1
        || heroHasProtectionFromShapeChangers(state)) return;
    const weapon = state.uwep || state.u.uwep;
    if (artifactById(weapon?.oartifact, state)?.defense === 'lycanthropy') return;
    if (await mhitm_mgc_atk_negated(monster, state.u, { state, publish, random, verbose: true })) return;
    await publish('You feel feverish.', { urgent: true });
    await exerciseAttribute(A_CON, false, state);
    setHeroLycanthropy(monster.mnum, state);
    await retouchEquipment(2, { state, publish });
}

async function sleepHero(
    monster: Monster, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2, rollOne: typeof rnd,
): Promise<void> {
    if (heroHasInvoluntaryDelay(state) || random(5) !== 0) return;
    if (await mhitm_mgc_atk_negated(monster, state.u, { state, publish, random, verbose: true })) return;
    const seesHero = (observer: Monster) => monsterHasLineOfSightToHero(observer, state);
    if (state.u.sleepResistance) {
        monstersObserveHeroResistance(M_SEEN_SLEEP, state, seesHero);
        return;
    }
    monstersForgetHeroResistance(M_SEEN_SLEEP, state, seesHero);
    const turns = rollOne(10);
    await stopHeroOccupation(state, publish);
    await putHeroToSleep(turns, { state, publish });
    await publish(heroIsBlind(state) ? 'You are put to sleep!'
        : `You are put to sleep by ${monsterName(monster, { state })}!`);
}

async function polymorphHeroOnContact(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, rollOne: typeof rnd,
): Promise<void> {
    const damage = attack.damage ?? 0;
    const physicalDamage = state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage;
    if (physicalDamage >= (Upolyd(state.u) ? state.u.mh : state.u.uhp)) return;
    if (attack.negated) {
        if (monster.mcan) await publish("You aren't transformed.");
        return;
    }
    const oldForm = state.u.umonnum;
    if (state.u.antimagic) {
        await shieldeff(state.u.ux, state.u.uy, state);
    } else if (!heroIsUnchanging(state)) {
        if (state.u.ulycn === -1) {
            await publish('You are subjected to a freakish metamorphosis.');
            await polymorphHero();
        } else if (state.u.umonnum !== state.u.ulycn) {
            await publish(formatFeltMessage('an unnatural urge coming on.', state));
            await applyHeroWereChange({ state, publish });
        } else {
            await publish(formatFeltMessage('a natural urge coming on.', state));
            await revertHeroWereForm({ state, publish });
        }
    }
    if (state.u.umonnum !== oldForm)
        monster.mspec_used = (monster.mspec_used ?? 0) + rollOne(2);
    // mhitm_ad_poly() marks this hit done even when resistance prevented
    // the body change. hitmu() still attempts knockback, then returns.
    attack.contactDone = true;
}


// ─── C uhitm.c:do_stone_u() (from stoning.ts) ───

const G_UNIQ = 0x1000;

// C uhitm.c:do_stone_u(). A successful golem transformation avoids the timer.
export async function startHeroPetrificationFromMonster(monster: Monster, state: GameState = game): Promise<boolean> {
    if (heroIsPetrifying(state) || heroResistsStoning(state)) return false;
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const transformed = await polymonHero(PM_STONE_GOLEM);
        if (transformed.transformed) return false;
    }
    const unique = !!(requireMonsterData(MONSTER_GENO, monster.mnum) & G_UNIQ);
    const properName = monsterHasProperName(monster.mnum);
    const name = monsterTypeName(monster.mnum, monster.female);
    return startHeroPetrification({
        state, killer: unique && !properName ? `the ${name}` : name,
        killerFormat: unique ? KILLED_BY : KILLED_BY_AN,
    });
}

// ─── C uhitm.c:mhitm_ad_ston() (from stoning.ts) ───

// C uhitm.c:mhitm_ad_ston(), after the ordinary hit message.
export async function applyMonsterStoningAttack(monster: Monster, {
    state = game, random = rn2, publish = plineWithContinuation,
}: { state?: GameState; random?: RandomBelow; publish?: MessagePublisher } = {}): Promise<boolean> {
    if (random(3) !== 0) return false;
    const spotted = canSpotMonster(monster);
    const hallucinating = heroIsHallucinating(state);
    const subject = () => !spotted ? 'It'
        : hallucinating ? randomDisplayMonsterSubject() : monsterSentenceSubject(monster);
    // C mon_nam(magr): the mid-sentence name; a given name stays as typed
    // instead of being decapitalized from the sentence subject.
    const target = () => monsterName(monster, { state });
    const deaf = heroIsDeaf(state);
    const hear = async (text: string): Promise<void> => {
        const message = formatHeardMessage(text, state);
        if (message) await publish(message);
    };
    if (monster.mcan) {
        if (!deaf) await hear(`a cough from ${target()}!`);
        return false;
    }
    const blind = heroIsBlind(state);
    if (hallucinating && !blind) {
        await hear('hissing.');
        await publish(`${subject()} appears to be blowing you a kiss...`);
    } else if (!deaf) {
        await hear(`${possessiveName(target())} hissing!`);
    } else if (!blind) {
        await publish(`${subject()} seems to grimace.`);
    }
    if (random(10) !== 0 && state.flags.moonphase !== NEW_MOON) return false;
    return startHeroPetrificationFromMonster(monster, state);
}

// ─── C uhitm.c:mhitm_ad_poly(), hero attacker (from hero_natural_polymorph.ts) ───

// C uhitm.c:mhitm_ad_poly() and mhitm.c:mon_poly(), for a hero attacker.

export async function applyHeroNaturalPolymorph(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    const { state, publish, random } = context;
    const negated = await mhitm_mgc_atk_negated(state.u, monster, { state, random });
    if (state.uwep || state.u.uwep || context.damage >= monster.mhp)
        return { damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
    if (negated) {
        await publish(`${monsterName(monster, { state, capitalized: true })} is not transformed.`);
        return { damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
    }

    const visible = canSeeMonster(monster)
        || Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy)) <= 1;
    const before = monsterName(monster, { state, capitalized: true });
    let damage = context.damage;
    let heroDied = false;
    if (monsterHasMagicResistance(monster)) {
        if (visible) await showHeroPolymorphResistance(monster, context);
    } else if (monsterResistsEffect(monster, 12, random)) {
        await showHeroPolymorphResistance(monster, context);
    } else if (random(25) === 0 && (monster.cham ?? NON_PM) === NON_PM
        && (monster.mcan || is_shapeshifter(monster.mnum))) {
        if (visible) await publish(`${before} shudders!`);
        monster.mhp -= damage + Math.trunc((monster.mhpmax + 1) / 2);
        damage = 0;
        if (monster.mhp <= 0) {
            const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
                noCorpse: true, publish,
            });
            heroDied = death.heroDied;
        }
    } else {
        const change = await changeMonsterForm(monster, null, state, {
            publish, creditHero: true,
            finishDeath: (victim, options) => finishHeroMonsterKillOutcome(
                victim, victim.mx, victim.my, {
                    ...options, showKillMessage: false, recordConduct: false, publish,
                },
            ),
        });
        if (change) {
            damage = 0;
            heroDied = change.heroDied;
            if (!heroDied && visible) {
                const wasSeen = before.toLowerCase() !== 'it';
                if (canSpotMonster(monster)) {
                    const description = namelessMonsterName(monster, {
                        state, article: 'a', suppressIt: true, suppressInvisible: true,
                    });
                    const transformation = state.flags.verbose || !wasSeen
                        ? ' undergoes a freakish metamorphosis and' : '';
                    await publish(`${before}${transformation} turns into ${description}.`);
                } else {
                    await publish(`${before} undergoes a freakish metamorphosis${wasSeen ? ' and disappears' : ''}.`);
                }
            }
            if (!heroDied && monsterCanTeleport(heroSpecies(state))) {
                const teleport = await teleportHero({ chooseDestination: askTeleportDestination });
                heroDied = teleport.died;
            }
        } else if (visible && state.flags.verbose) {
            await publish('Nothing happens.');
        }
    }

    // Once mon_poly ran, damageum skips its common HP subtraction even if
    // resistance or a failed shape change left the original damage intact.
    return {
        damage, nativeResult: M_ATTK_HIT | (monster.mhp <= 0 ? M_ATTK_DEF_DIED : 0),
        done: true, heroDied,
    };
}

async function showHeroPolymorphResistance(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    await shieldeff(monster.mx, monster.my, context.state);
    if (cansee(monster.mx, monster.my))
        await context.publish(`${monsterName(monster, { state: context.state, capitalized: true })} resists!`);
}

// ─── C uhitm.c:mhitm_ad_slim(), hero attacker (from hero_natural_sliming.ts) ───

// C uhitm.c:mhitm_ad_slim(), hero attacking a monster.

export async function applyHeroNaturalSliming(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    const { state, publish, random, rollDice, rollOne } = context;
    const normal: HeroNaturalEffectResult = {
        damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
    };
    if (await mhitm_mgc_atk_negated(state.u, monster, { state, random })
        || random(4) !== 0 || monsterIsSlimeproof(monster)) return normal;

    const cure = await munslime(monster, {
        state, byHero: true, publish, random, rollDice, rollOne,
    });
    if (cure.heroDied) return { ...normal, damage: 0, done: true, heroDied: true };
    if (!cure.cured && monster.mhp > 0) {
        await publish(`You turn ${monsterName(monster, { state })} into slime.`);
        const change = await changeMonsterForm(monster, PM_GREEN_SLIME, state, {
            showMessage: false, publish,
        });
        if (change?.heroDied) return { ...normal, damage: 0, done: true, heroDied: true };
    }
    if (monster.mhp <= 0)
        return { damage: context.damage, nativeResult: M_ATTK_DEF_DIED, done: true, heroDied: false };
    return { ...normal, damage: 0 };
}
// C uhitm.c:do_stone_mon(). A cure or life saving ends this hit.
export async function petrifyMonsterDefender(monster: Monster, {
    publish = plineWithContinuation,
    visible = canSeeMonster(monster),
    ...options
}: MonsterStoningCureOptions & PetrificationOptions & { visible?: boolean } = {}): Promise<MonsterDefenderPetrificationResult> {
    const cure = await munstone(monster, { ...options, publish });
    if (cure.consumed && cure.heroDied) return { heroDied: true };
    if (cure.consumed)
        return { survived: !cure.died, stopped: true, damage: 0, cure };
    const stoneForm = await turnGolemToStone(monster, publish);
    if (stoneForm?.heroDied) return { heroDied: true };
    if (stoneForm) return { survived: true, stopped: false, damage: 0 };
    if (monsterHasStoneResistance(monster))
        return { survived: true, stopped: false, damage: 1 };
    if (visible) await publish(`${monsterSubject(monster)} turns to stone!`);
    const result = await finishMonsterPetrification(monster, { ...options, publish });
    return { ...result, stopped: true, damage: 0 };
}

// ─── C uhitm.c:that_is_a_mimic()/stumble_onto_mimic() (from mimic.ts) ───

// Revealing a monster disguised as an object or dungeon feature.
// C refs: uhitm.c that_is_a_mimic() and stumble_onto_mimic(); monst.h
// is_door_mappear(). lock.c:stumble_on_door_mimic() lives in lock.ts.

const S_VERTICAL_CLOSED_DOOR = 15;
const S_HORIZONTAL_CLOSED_DOOR = 16;
const CLOSED_DOOR_APPEARANCES = new Set([
    S_VERTICAL_CLOSED_DOOR,
    S_HORIZONTAL_CLOSED_DOOR,
]);

// C that_is_a_mimic(): revelation alone neither wakes nor creates a hold.
export async function revealMimicIdentity(monster: Monster, {
    state = game, omitWait = false, publish = plineWithContinuation,
}: { state?: GameState; omitWait?: boolean; publish?: MessagePublisher } = {}): Promise<void> {
    const appearance = M_AP_TYPE(monster);
    let prefix = 'Wait!  That\'s ', identity = null;
    if (heroIsBlind(state)) {
        if (!state.u.telepathy) identity = 'a monster';
        else if (appearance === M_AP_MONSTER)
            identity = monsterName(monster, { state, article: 'a' });
    } else {
        const glyph = glyphAt(monster.mx, monster.my, state);
        if (glyph?.kind === 'terrain' && (appearance === M_AP_FURNITURE
            || appearance === M_AP_OBJECT && glyph.terrainName === 'trapped chest')) {
            prefix = `That ${glyph.terrainName} actually is `;
        } else if (glyph?.kind === 'object') {
            const description = await objectAtMonsterDescription(monster, state, { glyph });
            const singular = /^(?:a|an) /.test(description) || description === 'something';
            const name = description.replace(/^(?:a|an) /, '');
            prefix = `${singular ? 'That' : 'Those'} ${name} ${singular ? 'is' : 'are'} `;
        } else if (glyph?.kind === 'monster') {
            if (glyph.mnum === undefined) throw new Error('monster display glyph lacks its species');
            prefix = `Wait!  That ${monsterTypeName(glyph.mnum, monster.female)} is really `;
        }
        const seesInvisible = state.u.seeInvisible || (state.u.seeInvisibleTurns ?? 0) > 0;
        if (monster.minvis && !seesInvisible) identity = 'a monster';
        else if (appearance === M_AP_MONSTER)
            identity = monsterName(monster, { state, article: 'a', exact: true, called: true });
        else if (MONSTER_SYMBOL[monster.mnum] === 13
            && [M_AP_OBJECT, M_AP_FURNITURE].includes(appearance)
            && (monster.msleeping || monster.mfrozen))
            // BUG(per C): a paralyzed mimic is misclassified as sleeping.
            identity = monsterName(monster, {
                state, article: 'a', adjective: 'sleeping', suppressSaddle: false,
            });
        else
            identity = monsterName(monster, { state, article: 'a' });
    }
    if (identity) await publish(`${omitWait ? prefix.replace(/^Wait!  /, '') : prefix}${identity}!`);
    await revealMonsterAppearance(monster);
}

export function isObjectOrFurnitureMimic(monster: Monster | null | undefined, state: GameState = game): monster is Monster {
    return !!monster
        && [M_AP_OBJECT, M_AP_FURNITURE].includes(M_AP_TYPE(monster))
        && !(state.u?.protectionFromShapeChangers
            || state.protectionFromShapeChangers)
        && !canSenseMonster(monster)
        && glyphAt(monster.mx, monster.my, state)?.kind !== 'warning';
}

export function isDoorMimic(monster: Monster | null | undefined, state: GameState = game): boolean {
    return isObjectOrFurnitureMimic(monster, state)
        && hasDoorAppearance(monster);
}

// C is_door_mappear() tests only the disguise, regardless of perception.
export function hasDoorAppearance(monster: Monster | null | undefined): monster is Monster {
    return !!monster && M_AP_TYPE(monster) === M_AP_FURNITURE
        && monster.mappearance !== undefined && CLOSED_DOOR_APPEARANCES.has(monster.mappearance);
}

export async function revealMimic(
    monster: Monster | null | undefined,
    state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<boolean> {
    if (!isObjectOrFurnitureMimic(monster, state)) return false;

    await stumbleOntoMimic(monster, state, publish);
    return true;
}

// C stumble_onto_mimic(): callers establish the unrevealed appearance.
export async function stumbleOntoMimic(
    monster: Monster, state: GameState = game, publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    await revealMimicIdentity(monster, { state, publish });
    if (!state.u?.ustuck && !monster.mflee
        && requireMonsterData(MONSTER_ATTACKS, monster.mnum)
            .some(attack => attack[1] === AD_STCK)
        && Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1) {
        setHeroGrip(monster, state);
    }
    await wakeMonster(monster, { attacked: false });
    if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
}

// ─── C uhitm.c:nohandglow() (from confusing_touch.ts) ───

// Native uhitm.c:nohandglow() and hmon's surviving hand-to-hand target.

// C uhitm.c:nohandglow().
export async function confuseTouchedMonster(monster: Monster, { state = game }: { state?: GameState } = {}) {
    requirePlayingGame(state);
    if (!state.u.umconf || monster.mconf) return;
    const hands = makePlural(heroHandName(state));
    const unseen = heroIsBlind(state)
        || heroIsInvisible(state) && !propertyIsActive('seeInvisible', state);
    let message;
    if (state.u.umconf === 1) {
        message = unseen ? `Your ${hands} stop tingling.`
            : `Your ${hands} stop glowing ${displayColorName('red', state)}.`;
    } else {
        message = unseen ? `The tingling in your ${hands} lessens.`
            : `Your ${hands} no longer glow so brightly ${displayColorName('red', state)}.`;
    }
    await plineWithContinuation(message);
    state.u.umconf--;
    if (monsterResistsEffect(monster, state.u.ulevel)) return;
    monster.mconf = 1;
    if (!monster.mstun && !monster.msleeping && monster.mcanmove !== 0
        && !((monster.mfrozen ?? 0) > 0) && canSeeMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} appears confused.`);
    }
}
