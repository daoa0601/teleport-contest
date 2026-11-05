// Monster attacks against the hero: the mattacku() attack sequence, its
// hitmu()/mdamageu() damage and resume machinery, and slot presentation.
// C ref: mhitu.c.

import { WEAPON_CLASS, TOOL_CLASS } from './objclass.js';
import {
    objectBaseDirection, objectSkill, AMULET_OF_REFLECTION, CORPSE, EGG, OBJECT_NAMES,
    SHIELD_OF_REFLECTION, AKLYS, AMULET_OF_GUARDING, HEAVY_IRON_BALL, IRON_CHAIN,
    TIN_OPENER, TOWEL, GOLD_PIECE,
    BOULDER, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, LEASH, MAGIC_LAMP, OIL_LAMP, POT_OIL,
    TALLOW_CANDLE, WAX_CANDLE,
    objectPropertyName,
    a_can,
} from './object_data.js';
import { formatFeltMessage, formatHeardMessage } from './hero_speech.js';
import { game, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import { recordRandom } from './monster_action_types.js';
import type { HeroAttack, HeroAttackSequence, HeroAttackSlot, HeroContactAttack, MonsterMovementAction, MonsterCallLog, RandomBelow, RollDice, RollOne, AttackTuple, MonsterAttackInitiation, MonsterAttackPaging, MonsterDamageOptions, MonsterEngulfOptions, PublishMonsterMessage } from './monster_action_types.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DISN, AD_DISE, AD_DGST, AD_DRCO, AD_DREN, AD_DRIN, AD_DRLI, AD_DRST, AD_DRDX, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RBRE, AD_RUST, AD_SAMU, AD_SPC1, AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPEL, AD_SPC2, AD_SSEX, AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP } from './monster_attack_types.js';
import type { AttackMethod, DamageType } from './monster_attack_types.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, DISMOUNT_ENGULFED, DOOR, D_CLOSED, D_LOCKED, IRONBARS, IS_OBSTRUCTED, IS_TREE, IS_WATERWALL, KILLED_BY, KILLED_BY_AN, LARGEST_INT, M_AP_NOTHING, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, M_SEEN_FIRE, M_SEEN_MAGR, NEED_HTH_WEAPON, NEED_WEAPON, PIT, QBUFSZ, RLOC_MSG, SICK_NONVOMITABLE, SPIKED_PIT, STONING, BOLT_LIM, TT_WEB, Upolyd, W_ARMH, WATER, W_ACCESSORY, W_AMUL, W_ARMOR, W_WEP, AKLYS_LIM, P_AXE, P_DAGGER, P_LANCE, P_PICK_AXE, P_POLEARMS, P_SABER, P_SHORT_SWORD, P_WHIP, M_AP_OBJECT, is_pit } from './const.js';
import { plineWithContinuation, set_msg_xy } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { displayMessageWindow } from './tty_topline.js';
import { canSpotMonster, canSeeMonster, flush_screen, map_invisible, monsterVisible, newsym, senseWithTelepathy, shieldeff, swallowed } from './display.js';
import { cansee, couldsee, monsterHasLineOfSightToHero, vision_recalc } from './vision.js';
import { monsterName, monsterName as canonicalMonsterName, visibleMonsterSubject, randomDisplayMonsterSubject, displayLiquidName } from './do_name.js';
import { possessiveName, dist2 } from './hacklib.js';
import { monsterObjectPronoun, monsterSubjectPronoun, monstersForgetHeroResistance, monstersObserveHeroResistance, monsterPolymorphsWhenStoned, monsterPossessive, seenResistanceForDamage, monsterPossessive as perceivedPossessivePronoun, is_minion, is_orc, likes_gold, monsterDigests, monsterEnfolds, monsterHasNoLimbs, monsterHatesBlessings, monsterHasEyes, monsterHidesUnder, monsterIsAmorphous, monsterIsAmphibious, monsterIsAnimal, monsterIsDemon, monsterIsEel, monsterIsHider, monsterIsHuman, monsterIsSwimmer, monsterIsThickSkinned, monsterIsUndead, monsterIsUnsolid, monsterIsVampireShifter, monsterIsWhirly, monsterPassesWalls, monsterPerceives, monsterHasAcidResistance, monsterHasColdResistance, monsterHasFireResistance, monsterHasShockResistance, monsterHasStoneResistance } from './mondata.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SYMBOL, monsterTypeName, requireMonsterData } from './monster_data.js';
import { heroDetectsMonsters, heroIsBlind, heroIsDeaf, heroIsHallucinating, blindfolded, heroIsBlinded, setHeroBlindnessTurns } from './senses.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { armorSimpleName, armorSlotFor, heroHasDrainResistance, heroIsDisplaced, objectIsHardHelmet, stopDonning, removeHeroAccessory, wearHeroAccessory } from './do_wear.js';
import { monsterWieldedWeapon, wieldMonsterWeapon, weaponHitBonus } from './weapon.js';
import { isPolearm, isPermanentlyPoisonedObject, isMissileObject, isWeaponTool } from './object_properties.js';
import type { WeaponView } from './object_properties.js';
import { mhitmAdBlnd, mhitmAdCold, mhitmAdDrli, mhitmAdEnch, mhitmAdElec, mhitmAdFire, mhitmAdLegs, mhitm_ad_sedu, mhitmAdStun, mhitm_mgc_atk_negated, nurseContactMode, poisonAttackAttribute, poisonHeroFromMonster, resolveMonsterContactEffect, mhitm_ad_phys, mhitm_knockback, applyMonsterStoningAttack, startHeroPetrificationFromMonster, passiveDamage } from './uhitm.js';
import { isWeldedPrimary } from './wield.js';
import { applyArtifactHit, artifactById, monsterWieldsOrWearsDefense } from './artifacts.js';
import type { ArtifactDefenseQuery } from './artifacts.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { impossible } from './diagnostics.js';
import { createElementalMonsterExplosion } from './explosion.js';
import { makeConfused, makeHallucinated, makeStunned, startHeroSickness, makeBlinded, splitHeroMonsterForm } from './potion.js';
import { wakeMonstersNearWithMessages, finishEnvironmentalMonsterDeath, applyMonsterGolemEffects, paralyzeMonster } from './mon.js';
import type { MonsterDeathOptions, MonsterLiquidDeathContext } from './mon.js';
import { withIndefiniteArticle, objectDescription, observeObjectForNaming, objectCombatName, objectName, ownedObjectName, simpleObjectName, mimicObjectName, makePlural, objectNameIsPlural } from './objnam.js';
import { learnObjectType, observeObject, objectTypeKnown } from './o_init.js';
import { stopHeroOccupation } from './occupation.js';
import { finishHeroDeathAfterMonsterMessage, finishMonsterAttackDeath, finishHeroDeath } from './end.js';
import type { MonsterAttackDeathOptions, DeathHandler, FinishHeroDeathOptions } from './end.js';
import { adjustAttribute, currentAttribute, exerciseAttribute, loseHeroStrength } from './attrib.js';
import { adjustHeroAlignment } from './alignment.js';
import { heroHasHalfSpellDamage, drainObjectEnchantment, destroyInventoryByElement } from './zap.js';
import { applyHeroGolemEffects, polymonHero, returnHeroToHumanForm, heroFormSticks, heroSpecies, heroIsBreathless, heroPassesWalls } from './polyself.js';
import type { MonsterAttack } from './data_types.js';
import { d, rn2, rnd } from './rng.js';
import { completeMonsterOffensiveAction, completeMovedMonsterAction, presentMonsterPostMove, requirePerceivedHero, setMonsterApparentHeroPosition } from './monmove.js';
import { attackHeroWithRangedWeapon, resolveMonsterBreathAtHero, resolveMonsterSpitAtHero } from './mthrowu.js';
import { castmuSpellEffect, chooseMonsterSpell, MCF_INDIRECT, MONSTER_WIZARD_SPELLS, monsterCurseKind, monsterSpellUseless, resolveMonsterMagicRay } from './mcastu.js';
import { addObjectToMonsterInventory } from './steal.js';
import { heroIsFlaming, heroIsGreenSlime, heroIsNoncorporeal } from './polyself.js';
import { heroIsSliming, startHeroSliming } from './potion.js';
import { bot } from './botl.js';
import { burnArmorByFire, trapAt, erodeArmor, erodeAttackingWeapon, igniteItems, damageObjectWithAcid, drainHeroEnergy, petrifyMonsterImmediately, resetUtrap } from './trap.js';
import { getmattk } from './attack_selection.js';
import { heroHasInvoluntaryDelay, setMulti, resetOccupations } from './cmd.js';
import { endVoluntaryMultiTurn, burnAwayHeroSlime, stopRun, loseHeroHp, heroGoldAmount } from './hack.js';
import { attackMonsterWithMonster, monsterAttackStopsAggressor, petrifyMonsterAttacker } from './mhitm.js';
import { msummon } from './minion.js';
import { isWereMonster, isHumanWereMonster, transformWereMonster, summonWerePack, counterWereSpecies } from './were.js';
import { heroHasProtectionFromShapeChangers } from './polyself.js';
import { find_offensive } from './muse.js';
import { isPoolAt } from './dbridge.js';
import { recorderIsLeapDay, recorderLocalHour } from './calendar.js';
import { monsterSentenceSubject, sessionIsNight, monsterGrowlSound } from './ambient_sounds.js';
import { heroResistsStoning, touchPetrifies, contactIsProtected } from './stoning.js';
import type { Hero } from './hero_types.js';
import { setHeroGrip } from './mon.js';
import { heroHasConflict } from './hero_conflict.js';
import { woundHeroLegs } from './do.js';
import { staggerVerb } from './dothrow.js';
import { unplaceBallAndChain, moveSwallowedBallAndChain, placeBallAndChain } from './ball.js';
import { heroHairName, heroHandName } from './body_parts.js';
import { currency } from './invent.js';
import { gainExperienceLevel, loseHeroExperience } from './exper.js';
import { discoverHeroReflectionSource, ureflects, heroReflectsRay, mon_reflects } from './muse.js';

import { finishHeroMonsterKillOutcome, finishHeroMonsterKill } from './hero_monster_death.js';
import type { HeroMonsterKillOptions } from './hero_monster_death.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { detachHeroGold, heroGoldObject } from './hero_gold.js';
import { heroIsUnaware } from './senses.js';
import { inventoryItemDescription } from './invent.js';
import { linkObjectToMonsterInventory, unlinkObject } from './mkobj.js';
import { promptYesNo } from './query.js';
import { could_seduce } from './seduction_compatibility.js';
import { randomMonsterRelocation, reportMonsterTeleportRestriction, teleds, enexto } from './teleport.js';
import { advanceMonsterWormBody } from './worm.js';
import { monsterAtPosition, placeMonsterOnMap } from './steed.js';
import { findMonsterArmorClass } from './monworn.js';
import { ceilingName } from './terrain_name.js';
import { carriedObjectOwner } from './shk.js';
import { expelHero } from './hero_expulsion.js';
import { endObjectBurn } from './timeout.js';
import { releaseAllMonsterLeashes } from './apply.js';
import { heroHasEyes } from './body_parts.js';
import type { MapLocation } from './map_types.js';
import { dismountHero } from './steed.js';
import { encumber_msg } from './pickup.js';
import { hasIntrinsicProperty, hasInvokedProperty, hasPermanentIntrinsicProperty, propertyTimeout, removeIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { finishHeroHelplessness } from './allmain.js';

// Local copies of the C mondata.h flags and permonst indices the attack
// sequence reads (mhitu.c:calc_mattacku_vars/hitmu/gulpmu use them too).
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const PM_LEATHER_GOLEM = 253;
const PM_WOOD_GOLEM = 254;
const PM_IRON_GOLEM = 259;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const M1_NOEYES = 0x00001000;
const S_EEL = 57;
const S_MIMIC = 13;
const S_PIERCER = 16;
const PM_TRAPPER = MONSTER_NAME.indexOf('trapper');

// C mhitu.c:hitmsg(): the attacker's hit line, including the again-verb for
// consecutive identical attack slots. A missed slot is dispatched to
// missmu() below, as mattacku()'s switch chooses between them; effect
// branches that project their own prose return null here.
async function hitmsg(
    monster: Monster, attack: HeroContactAttack & HeroAttackSlot,
    previousAttack: (HeroAttack & HeroAttackSlot) | null = null,
    random: RandomBelow = rn2,
): Promise<string | null> {
    const game = requireInitializedGame();
    if (attack.specialMessage) return null;
    if (attack.effect === 'petrifying-corpse' || attack.effect === 'wrapping-natural') return null;
    if (attack.effect === 'physical-hug' || attack.effect === 'silent-physical-touch') return null;
    if (attack.effect === 'nurse-heal' || attack.effect === 'nurse-cooperate') return null;
    if (attack.effect === 'seduction-contact') return null;
    if (attack.effect === 'engulf' || attack.effect === 'engulf-tick'
        || attack.effect === 'engulf-refused') return null;
    if (attack.effect === 'item-theft' && !monsterIsAnimal(monster)) return null;
    if (attack.effect === 'failed-grab') {
        const subject = monsterName(monster, { capitalized: true });
        const verb = attack.damageType === AD_DGST ? 'gulp'
            : attack.damageType === AD_STCK ? 'adhere' : 'grab';
        return `${possessiveName(subject).slice(0, 99)} ${verb} attempt passes right through you!`;
    }
    if (!attack.hit) return missmu(monster, attack, game, random);
    const subject = monsterName(monster, { capitalized: true });
    if (attack.effect === 'pestilence-contact')
        return `${subject} reaches out, and you feel fever and chills.`;
    if (attack.effect === 'famine-contact')
        return `${subject} reaches out, and your body shrivels.`;
    if (attack.effect === 'death-contact')
        return `${subject} reaches out with its deadly touch.`;
    if (monster?.mnum === 116) {
        if (attack.effect === 'electric-natural')
            return `${subject} bites!`;
        return attack.effect === 'electric-avoided'
            ? `${subject} bites!  You avoid harm.`
            : `${subject} bites!  You get zapped!`;
    }
    const verb = attack.attackType === 16 ? 'tentacles suck your brain'
        : attack.attackType === 2 ? 'bites'
        : attack.attackType === 3 ? 'kicks'
            : attack.attackType === 4 ? 'butts'
                : attack.attackType === 5 ? 'touches you'
                    : attack.attackType === 6 ? 'stings' : 'hits';
    // C hitmsg() requires adjacent slots in the species' attack array.
    // getmattk() replacements use a separate buffer and cannot be adjacent.
    // Artifact prose skips hitmsg(), so it does not update that prior slot,
    // and neither does a corpse hit that starts the hero's petrification.
    const again = previousAttack?.hit
        && previousAttack.kind === 'hero-attack'
        && !previousAttack.specialMessage
        && previousAttack.effect !== 'physical-hug'
        && previousAttack.effect !== 'petrifying-corpse'
        && previousAttack.attackType === attack.attackType
        && previousAttack.attackIndex + 1 === attack.attackIndex
        && previousAttack.effectiveAttack === MONSTER_ATTACKS[monster.mnum]?.[previousAttack.attackIndex]
        && attack.effectiveAttack === MONSTER_ATTACKS[monster.mnum]?.[attack.attackIndex]
        ? ' again' : '';
    return `${attack.attackType === 16 ? possessiveName(subject) : subject} ${verb}${again}!`;
}
async function resolveErosionFormRehumanization(
    heroAttack: HeroContactAttack, effectMessage: string,
) {
    const game = requireInitializedGame();
    let pagerOwned = false;
    const effectDismissal = await plineWithContinuation(effectMessage);
    if (effectDismissal !== null && effectDismissal !== undefined)
        pagerOwned = true;

    const restored = await returnHeroToHumanForm(game, {
        publish: async (message: string) => {
            const dismissal = await plineWithContinuation(message);
            if (dismissal !== null && dismissal !== undefined) pagerOwned = true;
        },
    });
    heroAttack.heroDied = restored.died;

    return pagerOwned;
}
export async function presentMonsterAttackEffects(
    action: MonsterMovementAction,
    game: PlayingGameState,
    { random = rn2, rollDice = d, rollOne = rnd }: { random?: RandomBelow; rollDice?: RollDice; rollOne?: RollOne } = {},
): Promise<{ heroDied: boolean }> {
    const monster = action.monster;
    let movement = action.movement;
    // A special mover can attack before postmov(), then dochug() can
    // admit a fresh attack. Movement and its feedback must not replay.
    do {
        await completeMonsterOffensiveAction(action, game, random, rollDice, rollOne);
        if (movement.heroDied || game.program_state.gameover)
            return { heroDied: true };
        if (movement?.heroAttackSequence?.current) {
            let heroDied = false;
            let heroAttack: HeroAttackSequence['current'] = movement.heroAttackSequence.current;
                let previousHeroAttack: (HeroAttack & HeroAttackSlot) | null = null;
                const paging = movement.heroAttackSequence.paging;
                while (heroAttack) {
                    const publishSlotMessage: typeof plineWithContinuation = async (message, options) => {
                        const dismissal = await plineWithContinuation(message, options);
                        if (dismissal != null) paging.pagerOwned = true;
                        return dismissal;
                    };
                    if (heroAttack.kind === 'hero-magic-ray') {
                        const result = await resolveMonsterMagicRay(monster, heroAttack.effectiveAttack, {
                            state: game, publish: publishSlotMessage, calls: action.calls,
                            die: (options: FinishHeroDeathOptions) => options.damage
                                ? finishMonsterAttackDeath(monster, {
                                    attribution: {
                                        kind: 'death-inflicted-by', killer: options.killer,
                                        deathCause: options.deathCause
                                            || `killed by ${withIndefiniteArticle(options.killer)}`,
                                        announcesDeath: true,
                                    },
                                    pagerOwned: paging.pagerOwned,
                                }) : finishHeroDeath(options),
                        });
                        heroAttack.nativeResult = result.mask;
                        if (result.heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-explosion') {
                        const result = await resolveMonsterSelfExplosion(monster, heroAttack.effectiveAttack, {
                            foundHero: heroAttack.foundHero, state: game, publish: publishSlotMessage,
                            die: (options: FinishHeroDeathOptions) => options.damage ? finishMonsterAttackDeath(monster, {
                                deathType: options.deathType ?? null,
                                attribution: {
                                    kind: 'death-inflicted-by', killer: options.killer,
                                    ...(options.deathCause ? { deathCause: options.deathCause } : {}),
                                    killerFormat: options.killerFormat ?? KILLED_BY_AN,
                                    announcesDeath: !options.deathLineShown,
                                },
                                pagerOwned: paging.pagerOwned,
                            }) : finishHeroDeath(options),
                        });
                        heroAttack.nativeResult = result.mask;
                        if (result.heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-gaze') {
                        const result = await resolveMonsterGaze(monster, heroAttack.effectiveAttack, {
                            state: game, publish: publishSlotMessage, calls: action.calls,
                            die: (actor: Monster, options: MonsterAttackDeathOptions = {}) => finishMonsterAttackDeath(actor, {
                                ...options, pagerOwned: paging.pagerOwned,
                            }),
                        });
                        heroAttack.nativeResult = result.mask;
                        if (result.heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-projectile' || heroAttack.kind === 'hero-spit') {
                        const heroDied = heroAttack.kind === 'hero-projectile'
                            ? heroAttack.projectile.heroDied : heroAttack.spit.heroDied;
                        if (heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-breath') {
                        // C mhitu.c mattacku()'s AT_BREA case (875-877) —
                        // breamu() already ran its whole
                        // transaction in the begin phase, like AT_SPIT; the
                        // breath neither stops the hero's occupation nor
                        // spends the hero's next movement ration.
                        if (heroAttack.breath.heroDied || game.program_state?.gameover)
                            return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-spell') {
                        const publishSpellMessage: typeof plineWithContinuation = async (message, options) => {
                            const dismissal = await plineWithContinuation(message, options);
                            if (dismissal != null) paging.pagerOwned = true;
                            return dismissal;
                        };
                        if (!heroAttack.cast) {
                            let curseMessage = null;
                            if (heroAttack.misdirected) {
                                const water = game.level.at(monster.mux ?? 0, monster.muy ?? 0)?.typ === WATER;
                                const caster = canSeeMonster(monster) ? visibleMonsterSubject(monster) : 'Something';
                                curseMessage = `${caster} casts a spell at ${water ? 'empty water' : 'thin air'}!`;
                            } else if (heroAttack.fumbled && !heroIsDeaf(game)
                                && canSeeMonster(monster)) {
                                curseMessage = `The air crackles around ${monsterName(monster)}.`;
                            } else if (heroAttack.curseKind === 'audible') {
                                curseMessage = 'You hear a mumbled curse.';
                            } else if (heroAttack.curseKind) {
                                const caster = visibleMonsterSubject(monster);
                                curseMessage = heroAttack.curseKind
                                    === 'visible-undirected'
                                    ? `${caster} points all around, then curses.`
                                    : heroAttack.curseKind === 'visible-general'
                                        ? `${caster} points and curses in your general direction.`
                                        : heroAttack.curseKind === 'visible-displaced'
                                            ? `${caster} points and curses at your displaced image.`
                                            : `${caster} points at you, then curses.`;
                            }
                            if (curseMessage)
                                await publishSpellMessage(curseMessage, { noRepeat: heroAttack.curseKind === 'audible' });
                            previousHeroAttack = heroAttack;
                            heroAttack = await completeHeroAttackSlot(
                                action, game,
                            );
                            continue;
                        }
                        const caster = canSpotMonster(monster) ? visibleMonsterSubject(monster) : 'Something';
                        const casterVisible = canSpotMonster(monster);
                        if (casterVisible || heroAttack.directed) {
                            const misplaced = monster.mux !== game.u.ux || monster.muy !== game.u.uy;
                            const target = !heroAttack.directed ? ''
                                : heroIsInvisible(game) && !(monsterPerceives(monster.mnum)) && misplaced
                                    ? ' at a spot near you'
                                    : heroIsDisplaced(game) && misplaced ? ' at your displaced image' : ' at you';
                            await publishSpellMessage(
                                `${caster} casts a spell${target}!`,
                            );
                        }
                        // C mcastu.c:castmu() rolls its level-scaled spell
                        // damage after the casting line returns from tty,
                        // then mcast_spell() (or castmu()'s own elemental
                        // switch) runs the whole effect as one awaited
                        // transaction in native order.
                        const spellDied = await castmuSpellEffect(
                            heroAttack, monster, {
                                state: game,
                                publish: publishSpellMessage,
                                random,
                                rollDice,
                                rollOne,
                                calls: action.calls,
                                fatalDamage: () => finishMonsterAttackDeath(monster, {
                                    pagerOwned: paging.pagerOwned,
                                }),
                                strengthLossDeath: (killer: string): DeathHandler => options =>
                                    options.killer !== killer
                                        ? finishHeroDeathAfterMonsterMessage(options)
                                        : finishMonsterAttackDeath(monster, {
                                            attribution: {
                                                kind: 'death-inflicted-by',
                                                killer,
                                                announcesDeath: true,
                                            },
                                            pagerOwned: paging.pagerOwned,
                                        }),
                            },
                        );
                        if (spellDied || game.program_state.gameover)
                            return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                if (heroAttack.revealUnderMessage !== null
                    && heroAttack.revealUnderMessage !== undefined) {
                    // C hitmu(): the hidden-attacker reveal line
                    // precedes the base-damage roll, and the to-hit die
                    // was already consumed.  Resume this same slot with
                    // that roll retained once the line has crossed tty.
                    const revealDismissal = await plineWithContinuation(
                        heroAttack.revealUnderMessage,
                    );
                    heroAttack.revealUnderMessage = null;
                    await newsym(monster.mx, monster.my);
                    if (revealDismissal !== null
                        && revealDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                    const sequence = action.movement.heroAttackSequence;
                    if (!sequence) break;
                    const resumed = await beginHeroAttackSlot(
                        sequence,
                        heroAttack,
                        game,
                        rn2,
                        rnd,
                        d,
                        action.calls,
                        { roll: heroAttack.roll ?? null, hit: heroAttack.hit },
                        true,
                    );
                    if (resumed?.kind !== 'hero-attack')
                        throw new Error('A revealed contact attack must resume the same attack slot');
                    heroAttack = { ...heroAttack, ...resumed };
                    heroAttack.revealUnderMessage = null;
                    sequence.current = heroAttack;
                }
                // Hero-command and actor-prose history do not themselves
                // decide whether tty has repainted status.  The fatal path
                // below follows C bot()'s raw-HP sentinel and concrete pager
                // boundaries instead.
                // C hitmu()/missmu() records an unseen attacker's square
                // before projecting its contact line.  Persist that marker
                // in hero memory so a pager or later blind docrt() cannot
                // erase the source of the attack.  A hidden attacker was
                // already mapped before its reveal redrew the square.
                if (heroAttack.effect !== 'engulf'
                    && heroAttack.effect !== 'engulf-tick'
                    && heroAttack.effect !== 'wild-miss'
                    && heroAttack.effect !== 'engulf-unfound'
                    && heroAttack.effect !== 'engulf-refused'
                    && heroAttack.effect !== 'failed-grab'
                    && !heroAttack.attackerMapped
                    && !canSpotMonster(monster))
                    await map_invisible(monster.mx, monster.my);
                const publishEquipmentMessage: typeof plineWithContinuation = async (line, options) => {
                    const dismissal = await plineWithContinuation(line, options);
                    if (dismissal != null) paging.pagerOwned = true;
                    return dismissal;
                };
                // C hitmu() runs mhitm_adtyping(), then
                // mhitm_knockback(), the armor-class reduction and
                // mdamageu()/passiveum() as one tail.  The begin-phase slot
                // records the rolls and the ad_* inputs; the shared tail
                // still runs here for every contact that branch left open.
                // The direct beginHeroAttackSlot branches — reached when a
                // resumed movement finish (hidden attacker the hero senses)
                // runs without the presenter's contact deferral — already
                // applied the whole tail and recorded their passiveum
                // result, so those slots only project their hit line.
                const contactCompletedInline = heroAttack.passive !== undefined;
                let contactTailPending = !contactCompletedInline && (
                    heroAttack.deferredSpecialContact
                    || heroAttack.effect === 'physical-weapon'
                    || heroAttack.effect === 'physical-natural'
                    || heroAttack.effect === 'physical-hug'
                    || heroAttack.effect === 'physical-unarmed-weapon'
                    || heroAttack.effect === 'silent-physical-touch'
                    || heroAttack.effect === 'poisonous-natural'
                    || heroAttack.effect === 'fire-natural'
                    || heroAttack.effect === 'cold-natural'
                    || heroAttack.effect === 'electric-natural'
                    || heroAttack.effect === 'life-drain-natural'
                    || heroAttack.effect === 'enchantment-natural'
                    || heroAttack.effect === 'stun-natural'
                    || heroAttack.effect === 'leg-natural'
                    || heroAttack.effect === 'stoning-natural'
                    || heroAttack.effect === 'sticking-natural'
                    || heroAttack.effect === 'slime-natural'
                    || heroAttack.effect === 'rust-natural'
                    || heroAttack.effect === 'corrosion-natural'
                    || heroAttack.effect === 'decay-natural'
                    || heroAttack.effect === 'cancelled-rust-natural'
                    || heroAttack.effect === 'cancelled-corrosion-natural'
                    || heroAttack.effect === 'cancelled-decay-natural'
                );
                const physicalContact = heroAttack.hit && heroAttack.damageType === AD_PHYS
                    && (heroAttack.effect === 'physical-weapon' || heroAttack.effect === 'physical-natural'
                        || heroAttack.effect === 'physical-hug' || heroAttack.effect === 'physical-unarmed-weapon'
                        || heroAttack.effect === 'silent-physical-touch');
                if (physicalContact && !contactCompletedInline) {
                    const physicalAttack = heroAttack;
                    const physical = await mhitm_ad_phys({ mdef: 'youmonst', context: {
                        state: game, attacker: monster, attack: heroAttack, calls: action.calls,
                        publish: publishEquipmentMessage, random, rollOne, rollDice,
                        hitMessage: () => hitmsg(monster, physicalAttack, previousHeroAttack, random),
                        die: finishHeroDeathAfterMonsterMessage,
                    } });
                    heroAttack.damage = physical.damage;
                    if (physical.heroDied) return { heroDied: true };
                }
                // mhitm_ad_fire/cold/elec/drli/blnd/ench/stun/legs/sedu
                // project hitmsg() themselves from uhitm.ts, so one of
                // those slots composes its hit line there instead of here.
                const message = physicalContact && !contactCompletedInline
                    || heroAttack.effect === 'fire-natural'
                    || heroAttack.effect === 'cold-natural'
                    || heroAttack.effect === 'electric-natural'
                    || heroAttack.effect === 'life-drain-natural'
                    || heroAttack.effect === 'blind-natural'
                    || heroAttack.effect === 'enchantment-natural'
                    || heroAttack.effect === 'stun-natural'
                    || heroAttack.effect === 'leg-natural'
                    || heroAttack.effect === 'item-theft'
                    ? null
                    : await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                const contactDismissal = message
                    ? await plineWithContinuation(message) : undefined;
                if (contactDismissal !== null
                    && contactDismissal !== undefined) {
                    paging.pagerOwned = true;
                }
                if (heroAttack.deferredSpecialContact)
                    await resolveMonsterContactEffect(monster, heroAttack, {
                        state: game, publish: publishEquipmentMessage, random, rollOne, rollDice,
                    });
                if (game.program_state.gameover)
                    return { heroDied: true };
                if (heroAttack.effect === 'sticking-natural') {
                    // C uhitm.c:mhitm_ad_stck() mhitu branch: set_ustuck()
                    // and the barbs line follow hitmsg() directly.
                    if (!heroAttack.negated && !game.u?.ustuck && !heroFormSticks(game)) {
                        setHeroGrip(monster, game);
                        if (monster.mnum === 293) {
                            const stickingDismissal = await plineWithContinuation(
                                'The barbs stick to you!',
                            );
                            if (stickingDismissal !== null
                                && stickingDismissal !== undefined) {
                                paging.pagerOwned = true;
                            }
                        }
                    }
                }
                if (heroAttack.effect === 'item-theft') {
                    // C uhitm.c:mhitm_ad_sedu() mhitu branch (uhitm.c:
                    // 4631-4690): hitmsg() for animals, the brags and
                    // seduction gates and steal() run as one awaited
                    // transaction here. hitmu() reaches knockback after
                    // every steal() result, including refusal and armor
                    // removal still in progress (mhitu.c:1196-1199).
                    const hitMessage = await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const theft = await mhitm_ad_sedu({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            attack: heroAttack,
                            hitMessage,
                            publish: publishEquipmentMessage,
                            random,
                            calls: action.calls,
                        },
                    });
                    if (game.program_state.gameover) return { heroDied: true };
                    paging.pagerOwned ||= !!theft.pagerOwned;
                    await mhitm_knockback(monster, game.u, heroAttack, {
                        state: game, random, hit: heroAttack.hit,
                        weaponUsed: !!monsterWieldedWeapon(monster),
                        publish: publishEquipmentMessage,
                    });
                }
                if (heroAttack.effect === 'engulf' || heroAttack.effect === 'engulf-tick') {
                    // C gulpmu(): the capture prose and every
                    // per-slot digestion effect run directly here.
                    const engulf = await presentHeroEngulfSlot(
                        monster, heroAttack, game, {
                            publish: publishEquipmentMessage,
                            die: (attacker: Monster, options: MonsterAttackDeathOptions = {}) => finishMonsterAttackDeath(attacker, {
                                ...options,
                                pagerOwned: paging.pagerOwned,
                            }),
                            flushMessages: async () => {
                                const dismissal = await displayMessageWindow();
                                if (dismissal != null) paging.pagerOwned = true;
                            },
                            random, rollOne, calls: action.calls,
                        },
                    );
                    if (engulf?.died || game.program_state.gameover) return { heroDied: true };
                }
                if (heroAttack.effect === 'slime-natural') {
                    // C uhitm.c:mhitm_ad_slim() mhitu branch: the negation
                    // gate, the slime line and make_slimed() follow hitmsg();
                    // the contact's ordinary damage remains unless the hero's
                    // current form cannot be slimed.
                    let slimeMessage: string | null = null;
                    let slimeKiller: string | null = null;
                    if (heroAttack.slimeNegated) {
                        if (!heroAttack.slimeCancelled)
                            slimeMessage = 'You escape harm.';
                    } else if (heroIsFlaming(game)) {
                        heroAttack.damage = 0;
                        slimeMessage = 'The slime burns away!';
                    } else if (game.u?.unchanging || game.unchanging
                        || heroIsNoncorporeal(game)
                        || heroIsGreenSlime(game)) {
                        heroAttack.damage = 0;
                        slimeMessage = 'You are unaffected.';
                    } else if (!heroIsSliming(game)) {
                        slimeMessage = "You don't feel very well.";
                        slimeKiller = requireMonsterData(MONSTER_NAME, monster.mnum);
                    } else {
                        slimeMessage = 'Yuck!';
                    }
                    if (slimeMessage) {
                        const slimeDismissal = await plineWithContinuation(
                            slimeMessage,
                        );
                        if (slimeDismissal !== null
                            && slimeDismissal !== undefined) {
                            paging.pagerOwned = true;
                        }
                    }
                    if (slimeKiller !== null)
                        startHeroSliming({ state: game, killer: slimeKiller });
                }
                if (heroAttack.effect === 'cold-natural') {
                    // C uhitm.c:mhitm_ad_cold() mhitu branch: hitmsg(),
                    // magic cancellation, the frost lines and the gated
                    // inventory destruction run here with direct awaits.
                    const hitMessage = await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const cold = await mhitmAdCold({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = cold.damage;
                    if (cold.heroDied) return { heroDied: true };
                    if (cold.heroAtZeroHitPoints) {
                        heroAttack.heroDied = true;
                        contactTailPending = false;
                    }
                }
                if (heroAttack.effect === 'fire-natural') {
                    // C uhitm.c:mhitm_ad_fire() mhitu branch: hitmsg(),
                    // magic cancellation, the fire lines, witness updates,
                    // inventory destruction, ignition and the slime cure all
                    // run here with direct awaits.
                    const hitMessage = await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const fire = await mhitmAdFire({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            attackType: heroAttack.attackType,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = fire.damage;
                    if (fire.heroDied) return { heroDied: true };
                    if (fire.heroAtZeroHitPoints) {
                        heroAttack.heroDied = true;
                        contactTailPending = false;
                    }
                }
                if (heroAttack.effect === 'electric-natural') {
                    // C uhitm.c:mhitm_ad_elec() mhitu branch: hitmsg(),
                    // magic cancellation, the zap lines and the gated
                    // inventory destruction run here with direct awaits.
                    const hitMessage = await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const electric = await mhitmAdElec({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = electric.damage;
                    if (electric.heroDied) return { heroDied: true };
                    if (electric.heroAtZeroHitPoints) {
                        heroAttack.heroDied = true;
                        contactTailPending = false;
                    }
                }
                if (heroAttack.effect === 'life-drain-natural') {
                    // C uhitm.c:mhitm_ad_drli() mhitu branch: hitmsg(), the
                    // selection gate, magic cancellation and losexp() run
                    // here with direct awaits.
                    const hitMessage = await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const drain = await mhitmAdDrli({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = drain.damage;
                    if (drain.heroDied) return { heroDied: true };
                }
                if (heroAttack.effect === 'blind-natural') {
                    // C uhitm.c:mhitm_ad_blnd() mhitu branch: the blinding
                    // line, make_blinded() and hitmu()'s knockback draws run
                    // here with direct awaits.
                    const blnd = await mhitmAdBlnd({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            attackType: heroAttack.attackType,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = blnd.damage;
                }
                if (heroAttack.effect === 'enchantment-natural') {
                    // C uhitm.c:mhitm_ad_ench() mhitu branch: the negation
                    // probe precedes hitmsg(); the armor selection, drain and
                    // "less effective" line follow it with direct awaits.
                    const hitMessage = await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const ench = await mhitmAdEnch({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = ench.damage;
                }
                if (heroAttack.effect === 'stun-natural') {
                    // C uhitm.c:mhitm_ad_stun() mhitu branch: hitmsg(), the
                    // one-in-four gate and make_stunned() run here with
                    // direct awaits.
                    const hitMessage = await hitmsg(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const stun = await mhitmAdStun({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = stun.damage;
                }
                if (heroAttack.effect === 'leg-natural') {
                    // C uhitm.c:mhitm_ad_legs() mhitu branch: the side and
                    // boot rolls, the contact line, set_wounded_legs() and
                    // both exercise() calls run here with direct awaits.
                    const legs = await mhitmAdLegs({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = legs.damage;
                }
                // C uhitm.c:mhitm_ad_rust()/mhitm_ad_corr()/mhitm_ad_dcay()
                // mhitu branches: a cancelled attacker stops after hitmsg();
                // a completely rustable/rottable hero form rehumanizes, and
                // every other hero loses armor erosion before hitmu()'s
                // shared knockback and damage tail.
                if (heroAttack.effect === 'rust-natural') {
                    if (Upolyd(game.u) && game.u.umonnum === PM_IRON_GOLEM) {
                        const rehumanizePager = await resolveErosionFormRehumanization(
                            heroAttack, 'You rust!',
                        );
                        paging.pagerOwned ||= rehumanizePager;
                        if (heroAttack.heroDied) contactTailPending = false;
                    } else {
                        await erodeArmor(game.u, 'rust', { publish: publishEquipmentMessage });
                    }
                }
                if (heroAttack.effect === 'corrosion-natural') {
                    await erodeArmor(game.u, 'corrosion', { publish: publishEquipmentMessage });
                }
                if (heroAttack.effect === 'decay-natural') {
                    if (Upolyd(game.u)
                        && (game.u.umonnum === PM_LEATHER_GOLEM || game.u.umonnum === PM_WOOD_GOLEM)) {
                        const rehumanizePager = await resolveErosionFormRehumanization(
                            heroAttack, 'You rot!',
                        );
                        paging.pagerOwned ||= rehumanizePager;
                        if (heroAttack.heroDied) contactTailPending = false;
                    } else {
                        await erodeArmor(game.u, 'rot', { publish: publishEquipmentMessage });
                    }
                }
                if (contactTailPending) {
                    const publishContactMessage: typeof plineWithContinuation = async (message, options) => {
                        const dismissal = await plineWithContinuation(message, options);
                        if (dismissal !== null && dismissal !== undefined)
                            paging.pagerOwned = true;
                        return dismissal;
                    };
                    await hitmu(
                        action.monster, heroAttack, game, {
                            random, rollDice, rollOne,
                            publish: publishContactMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            calls: action.calls,
                        },
                    );
                    if (game.program_state?.gameover) return { heroDied: true };
                }
                if (heroAttack.effectMessage) {
                    const effectDismissal = await plineWithContinuation(
                        heroAttack.effectMessage,
                    );
                    if (effectDismissal !== null
                        && effectDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                // C hitmu()/missmu() calls stop_occupation() after the whole
                // contact transaction, including passiveum().  In
                // particular, an overflowing cold-passive line must suspend
                // before its rn2(2), assess_dmg(), death line, and the
                // occupation-stop prose.  Keep this before later attack
                // slots, but after every deferred tail owned by this slot.
                // mdamageu() reaches done_in_by() first, so a hero killed by
                // the hit never stops the occupation unless life-saved.
                const engulfAttack = heroAttack.effect === 'engulf'
                    || heroAttack.effect === 'engulf-tick'
                    || heroAttack.effect === 'engulf-refused';
                const missedContact = heroAttack.effect === 'failed-grab'
                    || heroAttack.effect === 'engulf-unfound'
                    || heroAttack.effect === 'wild-miss';
                const stopsOccupation = !engulfAttack && !missedContact && !heroAttack.contactDone;
                if ((game.u?.[Upolyd(game.u) ? 'mh' : 'uhp'] ?? 1) > 0) {
                    if (stopsOccupation) await stopHeroOccupation(game);
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (await finishMonsterAttackDeath(monster, {
                    pagerOwned: paging.pagerOwned,
                })) {
                    heroDied = true;
                    break;
                }
                if (stopsOccupation) await stopHeroOccupation(game);
                heroAttack.heroDied = false;
                previousHeroAttack = heroAttack;
                heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
            }
            if (heroDied) return { heroDied: true };
        }
        if (!movement?.deferredAfterSpecialAttack || game.program_state?.gameover)
            break;
        // C shk_move()/pri_move() discard the first mattacku() result and
        // finish their own movement only after the complete attack has been
        // presented; the resumed finish keeps deferring any later contact.
        delete movement.deferredAfterSpecialAttack;
        delete movement.heroAttackSequence;
        if (!game.program_state.gameover) {
            const previousDeferral = game._deferVisibleMonsterContact;
            game._deferVisibleMonsterContact = true;
            try {
                await completeMovedMonsterAction(
                    action.monster,
                    movement,
                    game,
                    random,
                    rollDice,
                    rollOne,
                    action.calls,
                    action.dochugContext,
                );
            } finally {
                game._deferVisibleMonsterContact = previousDeferral;
            }
        }
        movement = action.movement;
        if (await presentMonsterPostMove(action, game))
            return { heroDied: true };
        movement = action.movement;
    } while (!game.program_state?.gameover);
    if (game.program_state?.gameover) return { heroDied: true };
    if (movement.deferredWormTailAttacks) {
        delete movement.deferredWormTailAttacks;
        const offensive = movement.heroAttackSequence?.offensive;
        if (movement.heroAttackResult !== 1
            && !(offensive?.status === 'completed' && offensive.result.nativeResult === 1)
            && !monster.dead && monster.mhp > 0 && monster.wormno) {
            const result = await performWormTailAttacks(monster, game, {
                random, rollDice, rollOne, calls: action.calls,
            });
            movement.heroAttackResult = result.nativeResult;
            return { heroDied: result.heroDied };
        }
    }
    return { heroDied: false };
}
// A direct mattacku call has no movement ration, dochug prelude, or postmov
// tail. Pets targeting the hero and forced abilities share this complete path.
export async function performMonsterHeroAttack(
    monster: Monster, state: PlayingGameState, {
        random = rn2, rollDice = d, rollOne = rnd, calls = [],
    }: { random?: RandomBelow; rollDice?: RollDice; rollOne?: RollOne; calls?: MonsterCallLog } = {},
): Promise<{ nativeResult: 0 | 1; heroDied: boolean }> {
    requireLiveGame(state);
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    let action: MonsterMovementAction;
    try {
        action = {
            monster, calls, movement: {
                oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my, moved: false,
                ...await mattacku(monster, state, random, rollOne, rollDice, calls),
            },
        };
    } finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
    const effects = await presentMonsterAttackEffects(action, state, { random, rollDice, rollOne });
    const offensive = action.movement.heroAttackSequence?.offensive;
    const returnedDeath = action.movement.heroAttackResult === 1
        || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
    return {
        nativeResult: returnedDeath || monster.dead || monster.mhp <= 0 ? 1 : 0,
        heroDied: effects.heroDied || !!state.program_state.gameover,
    };
}
// C worm.c:wormhitu(). Visible segments are stored head-outward; native
// wtails walks toward the head and excludes its hidden dummy segment.
async function performWormTailAttacks(
    worm: Monster, state: PlayingGameState,
    options: { random: RandomBelow; rollDice: RollDice; rollOne: RollOne; calls: MonsterCallLog },
): Promise<{ nativeResult: 0 | 1; heroDied: boolean }> {
    const segments = worm.wormSegments;
    if (!segments) throw new Error(`Worm ${worm.m_id} has no tail list.`);
    for (let index = segments.length - 1; index >= 0; index--) {
        const segment = segments[index];
        if (!segment) throw new Error(`Worm ${worm.m_id} has no tail segment ${index}.`);
        if (dist2(segment.x, segment.y, state.u.ux, state.u.uy) >= 3) continue;
        // Keep the real head position: mattacku() still uses its range and
        // apparent hero position, including after knockback or a passive.
        const result = await performMonsterHeroAttack(worm, state, options);
        if (result.nativeResult === 1 || result.heroDied) return result;
    }
    return { nativeResult: 0, heroDied: false };
}

// C hack.h:AC_VALUE().  Hero AC below zero is deliberately randomized each
// time an attack transaction evaluates it; callers must retain the returned
// threshold across later slots of that same mattacku() invocation.
function sourceHeroArmorClass(state: PlayingGameState, rollOne: RollOne, calls: MonsterCallLog) {
    const armorClass = state?.u?.uac ?? 10;
    if (armorClass >= 0) return armorClass;
    const effective = -rollOne(-armorClass);
    calls.push(`rnd(${-armorClass})`);
    return effective;
}

function monsterAttackThreshold(
    monster: Monster,
    state: PlayingGameState,
    rollOne: RollOne,
    calls: MonsterCallLog,
) {
    let threshold =
        sourceHeroArmorClass(state, rollOne, calls) +
        10 +
        (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0);
    if (heroHasInvoluntaryDelay(state)) threshold += 4;
    const perceivesInvisible = monsterPerceives(monster.mnum);
    if ((heroIsInvisible(state) && !perceivesInvisible) || !monster.mcansee) threshold -= 2;
    if (monster.mtrapped) threshold -= 2;
    return Math.max(1, threshold);
}


interface HeroFormPassiveOptions {
    state?: GameState;
    random?: (range: number) => number;
    rollDice?: (dice: number, sides: number) => number;
    publish?: MessagePublisher;
}

type HeroFormPassiveResult = {
    heroDied: true;
    attackerStopped: true;
    attackerDied?: never;
    damage?: never;
} | {
    heroDied?: false;
    attackerStopped: boolean;
    attackerDied?: boolean;
    damage?: number;
};

// C mhitu.c:passiveum(): the old form's passive counterattack. assess_dmg()
// applies the damage below; the AD_ENCH branch calls zap.c:drain_item() as
// drainObjectEnchantment.
export async function passiveum(monster: Monster, oldForm: number, attackType: number, {
    state = game, random = rn2, rollDice = d, publish = plineWithContinuation,
}: HeroFormPassiveOptions = {}): Promise<HeroFormPassiveResult> {
    requirePlayingGame(state);
    const passive = (MONSTER_ATTACKS[oldForm] || []).find(
        ([method]) => method === AT_NONE || method === AT_BOOM,
    );
    if (!passive) return { attackerStopped: false };
    const type = passive[1];
    let damage = passiveDamage(requireMonsterData(MONSTER_LEVEL, oldForm), passive, rollDice);
    const weapon = monsterWieldedWeapon(monster);

    if (type === AD_ACID) {
        if (random(2) === 0) {
            await publish(`${subject(monster)} is splashed by ${Upolyd(state.u) ? 'your ' : ''}${displayLiquidName('acid', state)}!`);
            if (monsterHasAcidResistance(monster)) {
                await publish(`${subject(monster)} is not affected.`);
                damage = 0;
            }
        } else damage = 0;
        if (random(30) === 0) await erodeArmor(monster, 'corrosion', { state, random, publish });
        if (random(6) === 0) await damageObjectWithAcid(weapon, { state, random, publish });
        return assess_dmg(monster, damage, publish);
    }
    if (type === AD_STON) {
        if (monsterHasStoneResistance(monster)
            || contactIsProtected(attackType, monster.misc_worn_check ?? 0, !!weapon))
            return { attackerStopped: false };
        const petrification = await petrifyMonsterAttacker(monster, {
            publish, visible: true, creditHero: true,
            finishDeath: (target: Monster, death: HeroMonsterKillOptions = {}) => finishHeroMonsterKill(target, target.mx, target.my, {
                ...death, showKillMessage: false, recordConduct: false,
            }),
        });
        if (petrification.heroDied) return { heroDied: true, attackerStopped: true };
        const died = !!monster.dead || monster.mhp <= 0;
        return { attackerDied: died, attackerStopped: died };
    }
    if (type === AD_ENCH) {
        if (attackType === AT_WEAP && weapon)
            await drainObjectEnchantment(weapon, { random, byHero: true, state });
        return { attackerStopped: false };
    }
    if (!Upolyd(state.u) || random(3) === 0) return { attackerStopped: false };

    switch (type) {
    case AD_PHYS:
        if (passive[0] === AT_BOOM) {
            await publish('You explode!');
            const restored = await returnHeroToHumanForm(state, { publish });
            if (restored.died) return { heroDied: true, attackerStopped: true };
        }
        break;
    case AD_PLYS: {
        // C passiveum() AD_PLYS: the floating eye freezes its attacker
        // through the hero's gaze; every other paralyzing form (gelatinous
        // cube) freezes it on contact.
        const turns = Math.min(127, damage);
        if (state.u.umonnum === PM_FLOATING_EYE) {
            const effectiveTurns = random(4) === 0 ? 127 : turns;
            if (!monster.mcansee || !monsterHasEyes(monster.mnum) || random(3) === 0
                || (heroIsInvisible(state) && !monsterPerceives(monster.mnum)))
                return { attackerStopped: false };
            if (heroIsBlind(state)) {
                await publish('As a blind floating eye, you cannot defend yourself.');
                return { attackerStopped: false };
            }
            const reflection = mon_reflects(monster, state);
            if (reflection) {
                await publish(`Your gaze is reflected by ${possessive(monster)} ${reflection.noun}.`);
                if (reflection.object && ['shield', 'amulet'].includes(reflection.noun))
                    learnObjectType(reflection.object.otyp, state);
                return { attackerStopped: false };
            }
            await publish(`${subject(monster)} is frozen by your gaze!`);
            paralyzeMonster(monster, effectiveTurns);
            return { attackerStopped: true };
        }
        await publish(`${subject(monster)} is frozen by you.`);
        paralyzeMonster(monster, turns);
        return { attackerStopped: true };
    }
    case AD_COLD:
    case AD_FIRE:
    case AD_ELEC: {
        const resists = type === AD_COLD ? monsterHasColdResistance
            : type === AD_FIRE ? monsterHasFireResistance : monsterHasShockResistance;
        if (resists(monster)) {
            await shieldeff(monster.mx, monster.my, state);
            const feeling = type === AD_COLD ? 'mildly chilly'
                : type === AD_FIRE ? 'mildly warm' : 'slightly tingled';
            await publish(`${subject(monster)} is ${feeling}.`);
            await applyMonsterGolemEffects(monster, type, damage, { state, publish });
            damage = 0;
        } else {
            const feeling = type === AD_COLD ? 'suddenly very cold'
                : type === AD_FIRE ? 'suddenly very hot' : 'jolted with your electricity';
            await publish(`${subject(monster)} is ${feeling}!`);
            if (type === AD_COLD) {
                state.u.mh += Math.trunc((damage + random(2)) / 2);
                state.u.mhmax = Math.max(state.u.mhmax, state.u.mh);
                const formLevel = MONSTER_LEVEL[state.u.umonnum];
                if (formLevel !== undefined && state.u.mhmax > (formLevel + 1) * 8) {
                    const clone = await splitHeroMonsterForm(state);
                    if (clone) await publish(`You multiply from ${possessive(monster)} heat!`);
                }
            }
        }
        break;
    }
    case AD_STUN:
        if (!monster.mstun) {
            monster.mstun = 1;
            await publish(`${subject(monster)} ${staggerVerb(monster.mnum)}.`);
        }
        damage = 0;
        break;
    // C passiveum() assigns zero damage to these types. Their ordinary
    // attack effects do not apply to retaliation from the hero's body.
    case AD_MAGM:
    case AD_SLEE:
    case AD_DISN:
    case AD_DRST:
    case AD_SPC1:
    case AD_SPC2:
    case AD_BLND:
    case AD_SLOW:
    case AD_DRLI:
    case AD_DREN:
    case AD_LEGS:
    case AD_STCK:
    case AD_SGLD:
    case AD_SITM:
    case AD_SEDU:
    case AD_TLPT:
    case AD_RUST:
    case AD_CONF:
    case AD_DGST:
    case AD_HEAL:
    case AD_WRAP:
    case AD_WERE:
    case AD_DRDX:
    case AD_DRCO:
    case AD_DRIN:
    case AD_DISE:
    case AD_DCAY:
    case AD_SSEX:
    case AD_HALU:
    case AD_DETH:
    case AD_PEST:
    case AD_FAMN:
    case AD_SLIM:
    case AD_CORR:
    case AD_POLY:
    case AD_CLRC:
    case AD_SPEL:
    case AD_RBRE:
    case AD_SAMU:
    case AD_CURS:
        damage = 0;
        break;
    }
    return assess_dmg(monster, damage, publish);
}

// C mhitu.c:assess_dmg().
async function assess_dmg(
    monster: Monster, damage: number, publish: MessagePublisher,
): Promise<HeroFormPassiveResult> {
    monster.mhp -= damage;
    if (monster.mhp > 0) return { attackerStopped: false, damage };
    await publish(`${subject(monster)} dies!`);
    await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
    const died = !!monster.dead || monster.mhp <= 0;
    return { attackerDied: died, attackerStopped: died, damage };
}

function subject(monster: Monster) {
    if (!canSpotMonster(monster)) return 'It';
    return heroIsHallucinating(game)
        ? randomDisplayMonsterSubject() : monsterSentenceSubject(monster);
}

function possessive(monster: Monster) {
    const name = subject(monster).replace(/^The /u, 'the ');
    return name === 'It' ? 'its' : name.endsWith('s') ? `${name}'` : `${name}'s`;
}

// C mhitu.c:summonmu(): monsters summon help for their fight against the
// hero. mattacku()'s caller gate — not cancelled, not a shapechanger,
// within one square of the hero's perceived position, demon or were —
// lives in the mattacku port below.
export async function summonmu(
    monster: Monster,
    youseeit: boolean,
    state: PlayingGameState,
    random: RandomBelow,
): Promise<void> {
    if (monsterIsDemon(monster.mnum)) {
        if (!['balrog', 'amorous demon'].includes(MONSTER_NAME[monster.mnum] ?? '')) {
            const inHell = !!state.dungeons?.[state.u.uz.dnum]?.flags?.hellish;
            if (random(inHell ? 10 : 16) === 0)
                await msummon(monster);
        }
        return; /* no such thing as a demon were creature, so we're done */
    }

    /* were creature */
    // if hero has Protection_from_shape_changers, new_were() works in the
    // critter-to-human direction but is a no-op the other way.
    const protectedHero = heroHasProtectionFromShapeChangers(state);
    if (isHumanWereMonster(monster)) {
        if (!protectedHero && random(sessionIsNight(state.datetime) ? 3 : 5) === 0)
            await transformWereMonster(monster, state);
    } else if (protectedHero || random(30) === 0) {
        await transformWereMonster(monster, state);
    }

    /* maybe summon compatible critters;
       not blocked by Protection_from_shape_changers */
    if (random(10) !== 0) return;
    if (youseeit)
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} summons help!`);
    const helpers = await summonWerePack(monster.mnum, false, state, random);
    const visible = helpers.filter(helper => canSeeMonster(helper)).length;
    const hemmedIn = formatFeltMessage('hemmed in.', state);
    if (youseeit) {
        if (!helpers.length) {
            await plineWithContinuation('But none comes.');
        } else if (!visible) {
            await plineWithContinuation(hemmedIn);
        }
        return;
    }
    const deaf = heroIsDeaf(state);
    if (!deaf)
        await plineWithContinuation(`Something ${makePlural(monsterGrowlSound(monster))}!`);
    if (!helpers.length) return; /* no help came; but you didn't know it tried */
    if (!visible) {
        await plineWithContinuation(hemmedIn);
        return;
    }
    const beast = counterWereSpecies(monster.mnum);
    const speciesName = MONSTER_NAME[monster.mnum] ?? '';
    const form = monsterIsHuman(monster.mnum)
        ? MONSTER_NAME[beast ?? -1] ?? speciesName : speciesName;
    const generic = form.replace(/^were/u, '') || 'creature';
    const appearance = visible === 1 ? `${withIndefiniteArticle(generic)} appears`
        : `${makePlural(generic)} appear`;
    await plineWithContinuation(`${appearance.charAt(0).toUpperCase()}${appearance.slice(1)}${deaf ? ' from nowhere' : ''}!`);
}
// C mhitu.c:mattacku(): monster attacks you. The head runs here — the
// per-slot switch lives in beginHeroAttackSlot and the presenter resumes it
// through advanceHeroAttackSequence.
// Also C mhitu.c:calc_mattacku_vars(): initial targeting state is inlined here.
export async function mattacku(
    monster: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
    rollDice: RollDice,
    calls: MonsterCallLog,
): Promise<MonsterAttackInitiation> {
    // calc_mattacku_vars() also resets targeting left by an earlier ray/throw.
    state.bhitpos = { x: state.u.ux, y: state.u.uy };
    state.notonhead = false;
    if (dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 3)
        endVoluntaryMultiTurn(state);
    if (monster.dead || monster.mhp <= 0) return { heroAttackResult: 1 };
    if ((state.underwater || state.u.uinwater)
        && !(monsterIsSwimmer(monster.mnum))) return {};
    if (state.u.uswallow) {
        if (state.u.ustuck !== monster) return {};
        monster.mux = state.u.ux;
        monster.muy = state.u.uy;
        if (state.u.invulnerable) return {};
    }
    if (monster === state.u.usteed) return {};
    if (!state.u.uswallow && state.u.usteed) {
        const steed = state.u.usteed;
        const orc = is_orc(monster.mnum);
        // mattacku() chooses the steed before testing adjacency. Orcs
        // choose it half the time; other monsters choose it one in four.
        if (recordRandom(random, calls, orc ? 2 : 4) === 0
            && dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 2) {
            const attack = await attackMonsterWithMonster(monster, steed, {
                state, random, rollDice, rollOne, calls,
            });
            if (monsterAttackStopsAggressor(attack)) return { heroAttackResult: 1 };
            if (attack.heroDied || monster.dead || monster.mhp <= 0
                || steed.dead || steed.mhp <= 0 || !state.u.usteed
                || dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > 2)
                return {};
            // A surviving steed retaliates immediately, including after a
            // miss, without spending a movement ration or a chance roll.
            const retaliation = await attackMonsterWithMonster(state.u.usteed, monster, {
                state, random, rollDice, rollOne, calls,
            });
            const attackerDied = retaliation.kind === 'monster-attack'
                && !!((retaliation.nativeResult ?? 0) & M_ATTK_DEF_DIED);
            return { heroAttackResult: attackerDied ? 1 : 0 };
        }
    }
    // C mattacku(): a concealed hero (hiding or mimicking) is revealed
    // instead of attacked, before the armor-class differential.
    const hero = state.u;
    const apparentDistance = dist2(monster.mx, monster.my, monster.mux ?? hero.ux, monster.muy ?? hero.uy);
    const attackerLooksAdjacent = apparentDistance < 3
        && !(apparentDistance === 2 && monster.mnum === PM_GRID_BUG);
    const foundYou = monster.mux === hero.ux && monster.muy === hero.uy;
    if (!hero.uswallow && attackerLooksAdjacent && foundYou) {
        const species = heroSpecies(state);

        const symbol = MONSTER_SYMBOL[species];
        const attacker = () => monsterName(monster, { state, article: 'none', exact: true });
        const seenByHero = canSeeMonster(monster);
        const publish = plineWithContinuation;
        const formName = () => monsterTypeName(species, state.flags.female);

        if (hero.uundetected) {
            if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
            hero.uundetected = 0;

            if (monsterIsHider(species) && species !== PM_TRAPPER) {
                // ceiling hider drops onto the attacker's square
                await publish(`You fall from the ${ceilingName(hero.ux, hero.uy, state)}!`);
                const oldx = monster.mx;
                const oldy = monster.my;
                // C remove_monster() takes the attacker off the map before the
                // search so that its own square — usually the closest free one —
                // is eligible for the hero; the monster remembers its old spot.
                monster.mx = 0;
                monster.my = 0;
                const spot = enexto(species, hero.ux, hero.uy, {
                    state, random,
                });
                // a fish won't voluntarily swap positions when it's in water
                // and the hero is over land
                const eelStays = monsterIsEel(monster.mnum)
                    && isPoolAt(oldx, oldy, state) && !isPoolAt(hero.ux, hero.uy, state);
                if (!spot || eelStays) {
                    await placeMonsterOnMap(monster, oldx, oldy); /* put back */
                    await newsym(hero.ux, hero.uy);
                    await publish(`${monsterName(monster, { state, capitalized: true })} draws back as you drop!`);
                    return {};
                }

                await newsym(oldx, oldy); /* finish removal; the square is empty now */
                await placeMonsterOnMap(monster, hero.ux, hero.uy);
                let landing = spot;
                if (monster.wormno) {
                    await advanceMonsterWormBody(monster, { state, random, rollOne, rollDice });
                    // the tail has not grown, so if it now occupies the landing
                    // square then one of the worm's original spots is free
                    if (state.level && monsterAtPosition(state.level, spot.x, spot.y)) {
                        landing = enexto(species, hero.ux, hero.uy, {
                            state, random,
                        }) ?? spot;
                    }
                }
                // C teleds() ends with spoteffects(), so the landing square's
                // trap and autopickup take effect before the piercer strikes.
                const { arrival } = await teleds(landing.x, landing.y, state, { allowDrag: true });
                if (arrival.died || state.program_state?.gameover) return {};
                setMonsterApparentHeroPosition(monster, state, random, calls);
                await newsym(hero.ux, hero.uy);

                if (symbol !== S_PIERCER) return {}; /* lurkers don't attack */

                const helmet = (monster.minvent || monster.inventory || [])
                    .find(object => ((object.owornmask ?? 0) & W_ARMH) !== 0);
                if (helmet && objectIsHardHelmet(helmet)) {
                    await publish(`Your blow glances off ${possessiveName(monsterName(monster, { state }))} helm.`);
                } else {
                    calls?.push('rnd(20)');
                    if (3 + findMonsterArmorClass(monster) <= rollOne(20)) {
                        await publish(`${monsterName(monster, { state, capitalized: true })} is hit by a falling piercer (you)!`);
                        calls?.push('d(3,6)');
                        monster.mhp -= rollDice(3, 6);
                        if (monster.mhp < 1) {
                            await finishHeroMonsterKill(monster, monster.mx, monster.my, { publish });
                        }
                    } else {
                        await publish(`${monsterName(monster, { state, capitalized: true })} is almost hit by a falling piercer (you)!`);
                    }
                }
            } else {
                // surface hider
                if (!seenByHero) {
                    await publish('It tries to move where you are hiding.');
                } else {
                    const cover = state.level?.objects?.[hero.ux]?.[hero.uy]?.[0];
                    const hiddenSomewhere = !!cover
                        || species === PM_TRAPPER
                        || (symbol === S_EEL && isPoolAt(hero.ux, hero.uy, state));
                    if (!hiddenSomewhere) {
                        await impossible('hiding under nothing?', { state });
                    } else {
                        // C zeroes a covering egg's spe so "laid by you" cannot
                        // leak into the message, then restores it.
                        const savedSpe = cover ? cover.spe : 0;
                        if (cover && cover.otyp === EGG) cover.spe = 0;
                        if (symbol === S_EEL || species === PM_TRAPPER) {
                            await publish(`Wait, ${attacker()}!  There's a hidden ${formName()} named ${state.plname} there!`);
                        } else if (cover) {
                            observeObjectForNaming(cover, { state });
                            await publish(`Wait, ${attacker()}!  There's a ${formName()} named ${state.plname} hiding under ${await objectDescription(cover, { state })}!`);
                        }
                        if (cover) cover.spe = savedSpe;
                    }
                }
                await newsym(hero.ux, hero.uy);
            }
            return {};
        }

        if (symbol === S_MIMIC && (hero.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING) {
            const sticky = heroFormSticks(state);
            if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
            if (sticky && !seenByHero) {
                await publish('It gets stuck on you.');
            } else {
                await publish(`Wait, ${attacker()}!  That's a ${formName()} named ${state.plname}!`);
            }
            if (sticky) setHeroGrip(monster, state);
            hero.m_ap_type = M_AP_NOTHING;
            hero.mappearance = 0;
            await newsym(hero.ux, hero.uy);
            return {};
        }
    }

    // C mattacku(): a non-mimic hero might be mimicking an object after
    // eating a mimic corpse.
    if (state._mimicMealMessage && hero.m_ap_type === M_AP_OBJECT && !hero.uswallow
        && monster.mux === hero.ux && monster.muy === hero.uy
        && Math.max(Math.abs(monster.mx - hero.ux), Math.abs(monster.my - hero.uy)) <= 1) {
        if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
        if (!canSeeMonster(monster)) {
            const picksUpGold = likes_gold(monster.mnum)
                && hero.mappearance === GOLD_PIECE;
            await plineWithContinuation(`Something ${picksUpGold ? 'tries to pick you up' : 'disturbs you'}!`);
        } else {
            const name = monsterName(monster, { state, article: 'none', exact: true });
            const shape = mimicObjectName(hero, state);
            await plineWithContinuation(`Wait, ${name}!  That ${shape} is really ${
                withIndefiniteArticle(monsterTypeName(heroSpecies(state), state.flags.female))
            } named ${state.plname}!`);
        }
        if ((state._helplessTurns ?? 0) > 0) {
            const shape = Upolyd(hero)
                ? withIndefiniteArticle(monsterTypeName(heroSpecies(state), state.flags.female)) : 'yourself';
            await finishHeroHelplessness(`You appear to be ${shape} again.`, state);
        }
        return {};
    }
    const threshold = monsterAttackThreshold(monster, state, rollOne, calls);
    // C mhitu.c mattacku() (721-724) — make eels visible the moment they
    // hit or miss us.
    if (monsterIsEel(monster.mnum) && monster.minvis
        && cansee(monster.mx, monster.my)) {
        monster.minvis = 0;
        await newsym(monster.mx, monster.my);
    }
    // C mattacku(): when not cancelled and not in current form due to
    // shapechange, many demons can summon more demons and were creatures
    // can summon critters; also, were creature might change form.
    if (monster.mcan || (monster.cham ?? -1) >= 0
        || (!monsterIsDemon(monster.mnum) && !isWereMonster(monster))) {
        // not a summoner this turn
    } else if (monster.mux === undefined || monster.muy === undefined) {
        throw new Error('Summoning during an attack requires the perceived hero position');
    } else if (Math.abs(monster.mx - monster.mux) <= 1
        && Math.abs(monster.my - monster.muy) <= 1) {
        const alreadyFleeing = !!monster.mflee;
        await summonmu(monster, canSeeMonster(monster), state, random);
        // were-creature might have changed to beast form; if that has
        // caused it to become afraid, don't continue this attack
        if (monster.mflee && !alreadyFleeing) return {};
    }
    if (state.u.invulnerable) {
        const apparentDistance = dist2(monster.mx, monster.my, monster.mux ?? 0, monster.muy ?? 0);
        const appearsAdjacent = apparentDistance < 3
            && !(apparentDistance === 2 && monster.mnum === PM_GRID_BUG);
        if (state.u.ustuck === monster) {
            await plineWithContinuation(`${canonicalMonsterName(monster, { state, capitalized: true })} loosens its grip slightly.`);
        } else if (appearsAdjacent) {
            await plineWithContinuation(canSpotMonster(monster)
                ? `${canonicalMonsterName(monster, { state, capitalized: true })} starts to attack you, but pulls back.`
                : formatFeltMessage('something move nearby.', state));
        }
        return {};
    }
    const offensive = find_offensive(monster, state, {
        random: limit => recordRandom(random, calls, limit),
    });
    const sequence: HeroAttackSequence = {
        monster,
        cachedMnum: monster.mnum,
        threshold,
        nextSlot: 0,
        current: null,
        results: [],
        lastAttackRoll: 0,
        firstFoundYou: monster.mux === state.u.ux && monster.muy === state.u.uy,
        paging: { pagerOwned: false },
        offensive: offensive ? { status: 'selected', choice: offensive } : null,
        skipNonMagic: false,
        skipBrainDrain: false,
        done: false,
    };
    if (!offensive)
        await advanceHeroAttackSequence(sequence, state, random, rollOne, rollDice, calls);
    return { heroAttackSequence: sequence };
}

// Also C mhitu.c:calc_mattacku_vars(): targeting is recomputed between attack slots.
export async function advanceHeroAttackSequence(
    sequence: HeroAttackSequence,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
    rollDice: RollDice,
    calls: MonsterCallLog,
) {
    const monster = sequence.monster;
    while (!sequence.done && sequence.nextSlot < 6) {
        if (state.program_state.gameover || monster.dead || monster.mhp <= 0 || monster.mx === 0)
            break;
        const attackIndex = sequence.nextSlot++;
        sequence.results[attackIndex] = M_ATTK_MISS;
        const foundHero = monster.mux === state.u.ux && monster.muy === state.u.uy;
        if (attackIndex > 0) {
            state.bhitpos = { x: state.u.ux, y: state.u.uy };
            state.notonhead = false;
            if (sequence.firstFoundYou && !foundHero) continue;
        }
        const effectiveAttack = getmattk(monster, state.u, attackIndex, sequence.results, state);
        if (sequence.skipBrainDrain && effectiveAttack[0] === AT_TENT && effectiveAttack[1] === AD_DRIN)
            continue;
        const slot: HeroAttackSlot = {
            attackIndex,
            effectiveAttack,
            oldFormMnum: state.u.umonnum,
        };
        const attack = await beginHeroAttackSlot(
            sequence,
            slot,
            state,
            random,
            rollOne,
            rollDice,
            calls,
        );
        if (attack) {
            sequence.current = { ...slot, ...attack };
            return sequence.current;
        }
        sequence.current = null;
        // A slot that reaches the end of mattacku()'s switch without an
        // attack still commits pending status; its continue paths do not.
        if (!attackSlotContinues(sequence, effectiveAttack[0], state)
            && state === game && state.context.botl)
            await bot();
    }
    sequence.current = null;
    sequence.done = true;
    return null;
}

// C mattacku() loop entries that `continue` before reaching bot().
function attackSlotContinues(sequence: HeroAttackSequence, attackType: number, state: PlayingGameState) {
    const monster = sequence.monster;
    if (state.u.uswallow && attackType !== AT_ENGL) return true;
    if (sequence.skipNonMagic && attackType !== AT_MAGC) return true;
    if (attackType !== AT_KICK || !monster.mtrapped) return false;
    const trap = trapAt(state, monster.mx, monster.my);
    return trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT;
}

// Ranged effects finish before returning their slot. Their real message
// continuations update the same sequence context used by contact effects.
export function monsterAttackMessagePublisher(paging: MonsterAttackPaging): PublishMonsterMessage {
    return async (message, options) => {
        const dismissal = await plineWithContinuation(message, options);
        if (dismissal != null) paging.pagerOwned = true;
        return dismissal;
    };
}

async function beginHeroAttackSlot(
    sequence: HeroAttackSequence,
    slot: HeroAttackSlot,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
    rollDice: RollDice,
    calls: MonsterCallLog,
    retainedAttackRoll: { roll: number | null; hit: boolean } | null = null,
    deferVisibleContact = !!state?._deferVisibleMonsterContact,
): Promise<HeroAttack | null> {
    const monster = sequence.monster;
    requirePerceivedHero(monster);
    const { attackIndex, effectiveAttack, oldFormMnum } = slot;
    const [attackType, damageType, dice, sides] = effectiveAttack;
    const naturalContact = [AT_CLAW, AT_KICK, AT_BITE, AT_STNG, AT_TUCH, AT_BUTT, AT_TENT]
        .includes(attackType);
    const threshold = sequence.threshold;
    const alreadyEngulfing =
        attackType === AT_ENGL && state.u.uswallow && state.u.ustuck === monster;
    if (
        (state.u.uswallow && attackType !== AT_ENGL) ||
        (sequence.skipNonMagic && attackType !== AT_MAGC)
    )
        return null;
    const foundHero = monster.mux === state.u.ux && monster.muy === state.u.uy;
    const dx = monster.mx - monster.mux;
    const dy = monster.my - monster.muy;
    const distant =
        dx * dx + dy * dy >= 3 ||
        (MONSTER_NAME[monster.mnum] === 'grid bug' && dx !== 0 && dy !== 0);
    if (attackType === AT_BREA) {
        if (!distant) return null;
        // C mhitu.c mattacku()'s AT_BREA case (875-877): sum[i] =
        // breamu(mtmp, mattk) runs the whole
        // breath transaction, exactly like the AT_SPIT case above.
        const publish = monsterAttackMessagePublisher(sequence.paging);
        const breath = await resolveMonsterBreathAtHero(monster, effectiveAttack, {
            state, random: range => recordRandom(random, calls, range),
            rollOne, rollDice, publish,
        });
        return { kind: 'hero-breath', breath, nativeResult: breath.nativeResult };
    }
    if (attackType === AT_SPIT) {
        if (!distant) return null;
        const publish = monsterAttackMessagePublisher(sequence.paging);
        const spit = await resolveMonsterSpitAtHero(monster, effectiveAttack, {
            state, random: range => recordRandom(random, calls, range), rollOne, publish,
        });
        return { kind: 'hero-spit', spit, nativeResult: spit.nativeResult };
    }
    if (attackType === AT_WEAP && distant) {
        if (state.level.flags?.rogue_level) return null;
        const publish = monsterAttackMessagePublisher(sequence.paging);
        const projectile = await attackHeroWithRangedWeapon(monster, state, random, rollOne, calls, publish);
        return projectile
            ? { kind: 'hero-projectile', projectile, nativeResult: M_ATTK_MISS }
            : null;
    }
    if (attackType === AT_GAZE) {
        if (MONSTER_NAME[sequence.cachedMnum] === 'Medusa') return null;
        return {
            kind: 'hero-gaze',
            attackType,
            damageType,
            dice,
            sides,
            nativeResult: M_ATTK_MISS,
        };
    }
    if (attackType === AT_EXPL) {
        return distant
            ? null
            : {
                  kind: 'hero-explosion',
                  attackType,
                  damageType,
                  dice,
                  sides,
                  foundHero,
                  nativeResult: M_ATTK_MISS,
              };
    }
    if (attackType === AT_MAGC && distant) {
        if (damageType < AD_MAGM || damageType > AD_SPC2) return null;
        return {
            kind: 'hero-magic-ray',
            attackType,
            damageType,
            dice,
            sides,
            nativeResult: M_ATTK_MISS,
        };
    }
    // C mattacku() lets a monster that is holding the hero (u.ustuck) use
    // its hug attack even when it is not beside the hero's apparent spot.
    if (attackType !== AT_MAGC && distant
        && !(attackType === AT_HUGS && state.u.ustuck === monster)) return null;
    if (naturalContact) {
        if (attackType === AT_KICK && monster.mtrapped) {
            const trap = trapAt(state, monster.mx, monster.my);
            if (trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT) return null;
        }
        if (monsterWieldedWeapon(monster) && !monster.mconf && !heroHasConflict(state)
            && touchPetrifies(heroSpecies(state))) return null;
    }
    // Native AT_WEAP prepares a melee weapon even at the wrong location.
    // Wielding spends this slot; the next attack slot may still proceed.
    if (attackType === AT_WEAP) {
        const currentWeapon = monsterWieldedWeapon(monster);
        if (monster.weaponCheck === NEED_WEAPON || !currentWeapon) {
            monster.weaponCheck = NEED_HTH_WEAPON;
            if (await wieldMonsterWeapon(monster, state)) return null;
        }
    }
    if (attackType === AT_ENGL && !foundHero) {
        return {
            kind: 'hero-attack',
            attackType,
            damageType,
            hit: false,
            effect: 'engulf-unfound',
            nativeResult: M_ATTK_MISS,
        };
    }
    if (
        (naturalContact || attackType === AT_WEAP) &&
        !foundHero
    ) {
        sequence.skipNonMagic = true;
        return {
            kind: 'hero-attack',
            threshold,
            hit: false,
            roll: null,
            attackType,
            damageType,
            attackIndex,
            effect: 'wild-miss',
        };
    }
    if (
        attackType === AT_HUGS &&
        state.u.ustuck !== monster &&
        !(
            attackIndex >= 2 &&
            sequence.results[attackIndex - 1] &&
            sequence.results[attackIndex - 2]
        )
    )
        return null;
    if (
        ![
            AT_CLAW,
            AT_KICK,
            AT_BITE,
            AT_STNG,
            AT_TUCH,
            AT_BUTT,
            AT_TENT,
            AT_HUGS,
            AT_WEAP,
            AT_MAGC,
            AT_ENGL,
        ].includes(attackType)
    )
        return null;
    if (attackType === AT_MAGC) {
        // mhitu.c:mattacku() enters castmu() without a to-hit die.  Spell
        // choice and fumble precede the casting line.  Base spell damage is
        // rolled only after that line returns from tty; a long actor name can
        // therefore move d() to the acknowledgement input.
        const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        const choosesSpell = damageType === AD_SPEL || damageType === AD_CLRC;
        let spell = choosesSpell
            ? monsterLevel ? chooseMonsterSpell(monster, damageType, state, random, calls)
                : MONSTER_WIZARD_SPELLS[0]
            : undefined;
        if (choosesSpell && !spell)
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                cast: false,
            };
        if (!monsterLevel) return {
            kind: 'hero-spell', threshold, attackType, damageType, attackIndex,
            cast: false, blocked: true,
            curseKind: monsterCurseKind(monster, !!(spell && (spell.flags & MCF_INDIRECT)), state, random, calls),
        };
        // C castmu() starts cnt at 40.  choose_monster_spell() already tests
        // usefulness while walking the spell table; the do/while condition
        // tests the returned spell once more, but there is no third probe
        // after the loop.  Stateful usefulness checks such as geyser's
        // rn2(5) make that exact call count observable.
        let attempts = 39;
        while (spell && (damageType === AD_SPEL || damageType === AD_CLRC)
            && attempts-- > 0 && monsterSpellUseless(monster, spell, state, random, calls)) {
            spell = chooseMonsterSpell(monster, damageType, state, random, calls);
        }
        if (attempts < 0) {
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
            };
        }
        if (
            monster.mcan ||
            monster.mspec_used ||
            ((monster.seen_resistance ?? 0) & seenResistanceForDamage(damageType))
        ) {
            const curseKind = monsterCurseKind(monster, !!(spell && (spell.flags & MCF_INDIRECT)), state, random, calls);
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
                blocked: true,
                curseKind,
            };
        }
        if (choosesSpell) monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        const directed = !(spell && (spell.flags & MCF_INDIRECT));
        if (!foundHero && directed) return {
            kind: 'hero-spell', threshold, attackType, damageType, attackIndex,
            ...(spell ? { spell: spell.key } : {}), cast: false, misdirected: true,
        };
        endVoluntaryMultiTurn(state);
        const fumble =
            recordRandom(random, calls, Math.max(1, monsterLevel * 10)) <
            (monster.mconf ? 100 : 20);
        if (fumble) {
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
                fumbled: true,
            };
        }
        const spellDice = sides
            ? Math.trunc(monsterLevel / 2) + dice
            : Math.trunc(monsterLevel / 2) + 1;
        const spellSides = sides || 6;
        return {
            kind: 'hero-spell',
            threshold,
            attackType,
            damageType,
            attackIndex,
            ...(spell ? { spell: spell.key } : {}),
            cast: true,
            spellDice: foundHero ? spellDice : 0,
            spellSides,
            directed,
        };
    }
    if (attackType === AT_ENGL && monster.mspec_used && !alreadyEngulfing) {
        return {
            kind: 'hero-attack',
            threshold,
            hit: false,
            roll: sequence.lastAttackRoll,
            nearMiss: threshold === sequence.lastAttackRoll,
            attackType,
            damageType,
            attackIndex,
            effect: 'engulf-cooldown-miss',
        };
    }
    let weaponAccuracy = 0;
    if (attackType === AT_WEAP) {
        const wieldedWeapon = monsterWieldedWeapon(monster);
        if (wieldedWeapon && !retainedAttackRoll) {
            weaponAccuracy = weaponHitBonus(wieldedWeapon, state.u, {
                state,
                random,
                rollOne,
            });
            await swingMonsterWeapon(monster, wieldedWeapon, state, { random });
        }
    }
    const toHitSides = 20 + attackIndex;
    let roll = null;
    let hit = true;
    if (retainedAttackRoll) {
        roll = retainedAttackRoll.roll;
        hit = retainedAttackRoll.hit;
    } else if (!alreadyEngulfing && attackType !== AT_HUGS) {
        roll = sequence.lastAttackRoll = rollOne(toHitSides);
        calls.push(`rnd(${toHitSides})`);
        hit = threshold + weaponAccuracy > roll;
    }
    if (hit && (naturalContact || attackType === AT_HUGS)) {
        if (monsterGrabPassesThroughHero(effectiveAttack, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'failed-grab',
                nativeResult: M_ATTK_MISS,
            };
        }
        // A failed kick still reports a miss; a successful kick cannot
        // penetrate thick skin and never enters hitmu().
        if (attackType === AT_KICK && monsterIsThickSkinned({ mnum: heroSpecies(state) }))
            return null;
    }
    // C hitmu() reveals a concealed attacker before rolling base damage.
    // That pline can suspend behind an older tty topline, so preserve the
    // already-consumed attack die and resume this same slot afterward.
    const hiddenUnder =
        hit &&
        !retainedAttackRoll &&
        monster.mundetected &&
        (monsterHidesUnder(monster.mnum) ||
            monsterIsEel(monster.mnum));
    if (hiddenUnder) {
        if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
        slot.attackerMapped = true;
        monster.mundetected = 0;
        if (!senseWithTelepathy(monster) && !heroDetectsMonsters(state)) {
            const object = state.level?.objects[monster.mx]?.[monster.my]?.[0];
            if (object) {
                let what: string;
                if (heroIsBlind(state) && !object.dknown) {
                    what = 'something';
                } else if (isPoolAt(monster.mx, monster.my, state)
                    && !state.u.underwater) {
                    what = 'the water';
                } else {
                    observeObjectForNaming(object, { state });
                    what = await objectDescription(object, { state });
                }
                const name = canonicalMonsterName(monster, { state, article: 'a', capitalized: true });
                return {
                    kind: 'hero-attack', roll, threshold, hit,
                    attackType, damageType, attackIndex,
                    revealUnderMessage: `${name === 'It' ? 'Something' : name} was hidden under ${what}!`,
                };
            }
            await newsym(monster.mx, monster.my);
        }
    }
    // gulpmu() has its own roll; every successful contact enters hitmu()
    // once, including harmless touches and unsupported special effects.
    let damage = 0;
    if (hit) {
        // C mattacku() displays pending movement before gulpmu(), even
        // when admission later fails silently (for example, at iron bars).
        if (attackType === AT_ENGL && state === game) await flush_screen(1);
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        if (attackType !== AT_ENGL
            && (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster))
            && recorderLocalHour(state.datetime) === 0) {
            damage += rollDice(dice, sides);
            calls.push(`d(${dice},${sides})`);
        }
    }
    const poisonAttribute = poisonAttackAttribute(damageType);
    // mhitu.c:hitmu() rolls the AT_WEAP slot's declared base damage, then
    // weapon.c:dmgval() rolls the wielded weapon's small-target die.  The
    // visible hit line precedes knockback and HP subtraction.
    const contactWeapon = attackType === AT_WEAP ? monsterWieldedWeapon(monster) : null;
    if (hit && attackType === AT_ENGL) {
        // gulpmu() rolls before silent admission and failed-grab checks.
        if (alreadyEngulfing) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: true,
                damage: 0,
                attackType,
                damageType,
                effect: 'engulf-tick',
                engulfDamage: damage,
            };
        }
        if (!engulf_target(monster, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'engulf-refused',
            };
        }
        if (monsterGrabPassesThroughHero(effectiveAttack, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'failed-grab',
            };
        }
        const engulfOldX = monster.mx;
        const engulfOldY = monster.my;
        await unplaceBallAndChain(state);
        monster.mtrapped = 0;
        monster.mx = state.u.ux;
        monster.my = state.u.uy;
        setHeroGrip(monster, state);
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage: 0,
            attackType,
            damageType,
            attackIndex,
            effect: 'engulf',
            engulfDamage: damage,
            engulfOldX,
            engulfOldY,
        };
    } else if (hit && damageType === AD_PHYS) {
        const physicalHug = attackType === AT_HUGS && !heroFormSticks(state);
        const effect = contactWeapon ? 'physical-weapon' : physicalHug ? 'physical-hug'
            : attackType === AT_TUCH && damage === 0 && state.u.ustuck === monster
                ? 'silent-physical-touch'
                : attackType === AT_WEAP ? 'physical-unarmed-weapon' : 'physical-natural';
        const physical: HeroContactAttack = {
            kind: 'hero-attack', roll, threshold, hit, damage, attackType, damageType,
            effect, oldFormMnum,
        };
        if (deferVisibleContact) return physical;
        const outcome = await mhitm_ad_phys({ mdef: 'youmonst', context: {
            state, attacker: monster, attack: physical, calls, random, rollOne, rollDice,
            publish: physicalHug ? monsterAttackMessagePublisher(sequence.paging) : plineWithContinuation,
        } });
        if (outcome.heroDied) return { ...physical, damage: 0, heroDied: true };
        physical.damage = outcome.damage;
        if (outcome.done) physical.contactDone = true;
        await hitmu(monster, physical, state, { random, rollOne, rollDice, calls });
        return {
            ...physical,
            damage: physical.appliedDamage ?? physical.damage,
            heroDied: !!physical.heroDied,
        };
    } else if (hit && monster.mnum === 116 && !deferVisibleContact) {
        // PM_GRID_BUG: AT_BITE AD_ELEC 1d1.  The electric special checks
        // magic cancellation, optionally checks inventory destruction, then
        // the shared post-hit knockback path consumes its distance/chance
        // draws even though an electric bite cannot knock the hero back.
        const armorProtection = magic_negation(state.u, state);
        const negated = recordRandom(random, calls, 10) < 3 * armorProtection;
        if (!negated) {
            recordRandom(random, calls, 20);
        } else {
            damage = 0;
        }
        const electric: HeroContactAttack = {
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, oldFormMnum,
            effect: negated ? 'electric-avoided' : 'electric-zap',
        };
        await hitmu(monster, electric, state, { random, rollOne, rollDice, calls });
        electric.damage = electric.appliedDamage ?? electric.damage ?? 0;
        return electric;
    } else if (hit && poisonAttribute !== null) {
        // uhitm.c:mhitm_ad_drst() family.  Poisonous natural attacks roll
        // their physical damage first, then magic cancellation; only a
        // non-negated attack reaches the one-in-eight attribute-poison gate.
        const negated = await mhitm_mgc_atk_negated(monster, state.u, { state, random });
        const poison = negated ? null : { attribute: poisonAttribute, chance: 8 };
        if (deferVisibleContact) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit,
                damage,
                attackType,
                damageType,
                effect: 'poisonous-natural',
                poison,
            };
        }
        if (poison) {
            const effect = await poisonHeroFromMonster(monster, attackType, {
                ...poison,
                state,
                random,
                rollOne,
                rollDice,
            });
            if (effect.died)
                return {
                    kind: 'hero-attack',
                    roll,
                    threshold,
                    hit,
                    damage: 0,
                    heroDied: true,
                    attackType,
                    damageType,
                };
        }
        const poisonous: HeroContactAttack = {
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, oldFormMnum,
            effect: 'poisonous-natural',
        };
        await hitmu(monster, poisonous, state, { random, rollOne, rollDice, calls });
        poisonous.damage = poisonous.appliedDamage ?? poisonous.damage ?? 0;
        return poisonous;
    } else if (hit && (damageType === AD_WERE || damageType === AD_SLEE
        || damageType === AD_POLY || damageType === AD_TLPT || damageType === AD_PLYS
        || damageType === AD_WRAP || damageType === AD_DRIN || damageType === AD_CURS
        || damageType === AD_HEAL || damageType === AD_ACID || damageType === AD_SLOW
        || damageType === AD_SGLD || damageType === AD_SSEX || damageType === AD_DISE
        || damageType === AD_CONF || damageType === AD_PEST || damageType === AD_FAMN
        || damageType === AD_DETH || damageType === AD_SAMU)) {
        const negated = damageType === AD_SLOW
            ? await mhitm_mgc_atk_negated(monster, state.u, { state, random })
            : damageType === AD_POLY
                && (await mhitm_mgc_atk_negated(monster, state.u, { state, random }) || !!monster.mspec_used);
        return {
            kind: 'hero-attack', roll, threshold, hit, damage, attackType, damageType,
            oldFormMnum, negated, deferredSpecialContact: true,
            ...(damageType === AD_WRAP ? { effect: 'wrapping-natural' } : {}),
            ...(damageType === AD_HEAL ? { effect: `nurse-${nurseContactMode(monster, state)}` } : {}),
            ...(damageType === AD_SSEX ? { effect: 'seduction-contact' } : {}),
            ...(damageType === AD_PEST ? { effect: 'pestilence-contact' } : {}),
            ...(damageType === AD_FAMN ? { effect: 'famine-contact' } : {}),
            ...(damageType === AD_DETH ? { effect: 'death-contact' } : {}),
        };
    } else if (hit && damageType === AD_STCK) {
        const armorProtection = magic_negation(state.u, state);
        const negated = !!monster.mcan || recordRandom(random, calls, 10) < 3 * armorProtection;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'sticking-natural',
            negated,
            oldFormMnum,
        };
    } else if (
        hit &&
        !alreadyEngulfing &&
        attackType !== AT_ENGL &&
        damageType === AD_FIRE &&
        dice > 0 &&
        sides > 0
    ) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'fire-natural',
            // uhitm.ts:mhitmAdFire() runs the whole mhitm_ad_fire() body
            // with direct awaits; hitmu()'s shared knockback and damage
            // tail runs after it in the slot presentation.
            oldFormMnum,
        };
    } else if (hit && attackType !== AT_ENGL && damageType === AD_COLD) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'cold-natural',
            // uhitm.ts:mhitmAdCold() runs the whole mhitm_ad_cold() body
            // with direct awaits; hitmu()'s shared knockback and damage
            // tail runs after it in the slot presentation.
        };
    } else if (
        hit &&
        !alreadyEngulfing &&
        attackType !== AT_ENGL &&
        damageType === AD_ELEC &&
        dice > 0 &&
        sides > 0
    ) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'electric-natural',
            // uhitm.ts:mhitmAdElec() runs the whole mhitm_ad_elec() body
            // with direct awaits; hitmu()'s shared knockback and damage
            // tail runs after it in the slot presentation.
        };
    } else if (hit && (damageType === AD_SITM || damageType === AD_SEDU)) {
        // hitmu() records the attack's declared zero dice before dispatching
        // both theft claws through mhitm_ad_sedu(). A successful theft ends the
        // aggressor's attack sequence, so do not retain its second claw slot.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'item-theft',
        };
    } else if (hit && damageType === AD_LEGS) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'leg-natural',
            // uhitm.ts:mhitmAdLegs() runs the whole mhitm_ad_legs() mhitu
            // body with direct awaits; hitmu()'s shared knockback and
            // damage tail runs after it in the slot presentation.
            oldFormMnum,
        };
    } else if (hit && damageType === AD_BLND && dice > 0 && sides > 0) {
        // hitmu() rolls the declared damage before mhitm_ad_blnd(); the
        // raven claw converts it into blindness duration inside
        // uhitm.ts:mhitmAdBlnd() and reports zero HP damage.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'blind-natural',
        };
    } else if (hit && damageType === AD_STUN) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'stun-natural',
            // uhitm.ts:mhitmAdStun() runs the whole mhitm_ad_stun() mhitu
            // body with direct awaits; hitmu()'s shared knockback and
            // damage tail runs after it in the slot presentation.
            oldFormMnum,
        };
    } else if (hit && damageType === AD_SLIM) {
        const armorProtection = magic_negation(state.u, state);
        const cancelled = !!monster.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * armorProtection;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'slime-natural',
            slimeNegated: negated,
            slimeCancelled: cancelled,
            oldFormMnum,
        };
    } else if (hit && damageType === AD_STON) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'stoning-natural',
        };
    } else if (hit && damageType === AD_RUST) {
        // uhitm.c:mhitm_ad_rust() still receives hitmu()'s declared 0d0
        // damage and publishes hitmsg() before cancellation or erode_armor();
        // the slot presentation owns that line and the erosion gate.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-rust-natural' : 'rust-natural',
            oldFormMnum,
        };
    } else if (hit && damageType === AD_CORR) {
        // uhitm.c:mhitm_ad_corr() keeps the bite's declared 3d8 damage, but
        // hitmsg() and erode_armor(ERODE_CORRODE) both precede the common
        // knockback and HP-damage tail.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-corrosion-natural' : 'corrosion-natural',
            oldFormMnum,
        };
    } else if (hit && damageType === AD_DCAY) {
        // uhitm.c:mhitm_ad_dcay() follows the same hitmsg/cancellation/armor
        // shape as rust, but erodes secondary rot state and deliberately
        // disables grease protection.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-decay-natural' : 'decay-natural',
            oldFormMnum,
        };
    } else if (hit && damageType === AD_ENCH) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'enchantment-natural',
            // uhitm.ts:mhitmAdEnch() runs the negation probe, hitmsg(), the
            // armor drain and its line with direct awaits; hitmu()'s shared
            // knockback and damage tail runs after it in the presentation.
            oldFormMnum,
        };
    } else if (hit && damageType === AD_DRLI) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'life-drain-natural',
            // uhitm.ts:mhitmAdDrli() runs hitmsg(), the selection gate and
            // losexp() with direct awaits; hitmu()'s shared knockback and
            // damage tail runs after it in the slot presentation.
            oldFormMnum,
        };
    }
    return {
        kind: 'hero-attack',
        roll,
        threshold,
        hit,
        damage,
        attackType,
        damageType,
        nearMiss: !hit && roll === threshold + weaponAccuracy,
    };
}

// Native failed_grab(): the hero has no hittable worm tail, so only an
// unsolid body can defeat these holds without entering the hit transaction.
function monsterGrabPassesThroughHero(attack: AttackTuple, state: PlayingGameState): boolean {
    return monsterIsUnsolid({ mnum: heroSpecies(state) })
        && (attack[0] === AT_HUGS || [AD_DGST, AD_STCK, AD_WRAP].includes(attack[1]));
}

// C mhitm.c:engulf_target() (hero defender): whether the attacker can
// swallow the hero's current body from its square.
function engulf_target(monster: Monster, state: GameState = game): boolean {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const body = { mnum: heroSpecies(state) };
    const heroSize = MONSTER_SIZE[body.mnum];
    const monsterSize = MONSTER_SIZE[monster.mnum];
    if (heroSize === undefined || monsterSize === undefined) return false;
    if (heroSize >= MZ_HUGE
        || (monsterSize < heroSize && !monsterIsWhirly(monster)))
        return false;
    // A hero's u.utrap is released after capture; it is not mtrapped.
    if (monster.mtrapped) return false;
    if (!heroPassesWalls(state)
        && engulfSquareBlocked(state.level.at(hero.ux, hero.uy), monster))
        return false;
    if (!monsterPassesWalls(monster.mnum)
        && engulfSquareBlocked(state.level.at(monster.mx, monster.my), body))
        return false;

    const trap = state.level.traps.find(candidate =>
        candidate.tx === hero.ux && candidate.ty === hero.uy);
    const objects = state.level.objects[hero.ux]?.[hero.uy] || [];
    return !trap || !is_pit(trap.ttyp) || !objects.some(object => object.otyp === BOULDER);
}

function engulfSquareBlocked(location: MapLocation | null, otherBody: Pick<Monster, 'mnum'>): boolean {
    if (!location) return true;
    const closedDoor = location.typ === DOOR
        && !!((location.doormask ?? location.flags ?? 0) & (D_CLOSED | D_LOCKED));
    return IS_OBSTRUCTED(location.typ) || closedDoor || IS_TREE(location.typ)
        || (location.typ === IRONBARS && !monsterIsWhirly(otherBody));
}

const FLAMING_SPECIES = new Set([
    'fire vortex', 'flaming sphere', 'fire elemental', 'salamander',
].map(name => MONSTER_NAME.indexOf(name)));

const MZ_HUGE = 4;

// C snuff_lit()/snuff_candle(), here called only for the hero's inventory.
async function snuffEngulfedLights(state: PlayingGameState, publish: MessagePublisher): Promise<void> {
    for (const object of [...state.inventory]) {
        if (!object.lamplit) continue;
        if ([OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL].includes(object.otyp)) {
            if (!heroIsBlind(state)) {
                await publish(`${ownedObjectName(object, state)} ${
                    objectNameIsPlural(object, state) ? 'go' : 'goes'} out!`);
            }
        } else if ([TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION].includes(object.otyp)) {
            if (!heroIsBlind(state)) {
                const candelabrum = object.otyp === CANDELABRUM_OF_INVOCATION;
                const many = candelabrum ? (object.spe ?? 0) > 1 : object.quan > 1;
                await publish(`${carriedObjectOwner(object, state)} ${
                    candelabrum ? "candelabrum's " : ''}candle${
                    many ? "s' flames are" : "'s flame is"} extinguished.`);
            }
        } else continue;
        endObjectBurn(object, state);
    }
}

// C mondata.c:can_blnd(AT_ENGL). Cancellation and light resistance do not help.
function engulfCanBlindHero(state: GameState): boolean {
    return heroHasEyes(state) && !blindfolded(state)
        && !heroIsUnaware(state) && !state.u.ucreamed;
}

export interface HeroEngulfOptions {
    state?: GameState;
    random?: (range: number) => number;
    rollOne?: (sides: number) => number;
    publish?: MessagePublisher;
    flushMessages?: () => void | Promise<unknown>;
    die?: typeof finishMonsterAttackDeath;
}

export interface HeroEngulfResult {
    hit: boolean;
    damage: number;
    died: boolean;
}

// C mhitu.c:gulpmu(): the monster swallows the hero, or damages one it has
// already swallowed. An 'engulf' slot is the initial capture (C !u.uswallow);
// every later tick, and gulp_blnd_check()'s re-entry, run the shared body.
export async function gulpmu(
    monster: Monster,
    attack: HeroContactAttack,
    { state = game, random = rn2, rollOne = rnd, publish = plineWithContinuation,
        flushMessages = displayMessageWindow, die }: HeroEngulfOptions = {},
): Promise<HeroEngulfResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;

    if (attack.effect === 'engulf') { /* swallows you */
        await newsym(monster.mx, monster.my);
        if (hero.usteed) {
            const steedName = monsterName(hero.usteed, { state });
            const subject = monsterName(monster, { state, capitalized: true, augmentIt: true });
            const verb = monsterIsAnimal(monster) ? 'lunges'
                : monsterIsWhirly(monster) ? 'whirls'
                : monsterIsUnsolid({ mnum: monster.mnum }) ? 'flows'
                : monsterIsAmorphous(monster) ? 'oozes' : 'surges';
            await publish(`${subject} ${verb} forward and plucks you off ${steedName}!`,
                { urgent: true });
            const dismount = await dismountHero(DISMOUNT_ENGULFED,
                { state, random, announce: publish });
            if (dismount.died || state.program_state.gameover)
                return { hit: false, damage: 0, died: true };
        } else {
            const subject = monsterName(monster, { state, capitalized: true });
            const verb = monsterDigests(monster) ? 'swallows you whole'
                : monsterEnfolds(monster) ? 'folds itself around you' : 'engulfs you';
            await publish(`${subject} ${verb}!`, { urgent: true });
        }
        await stopHeroOccupation(state, publish);
        resetOccupations(state); // gulpmu() behaves as if the hero had moved.
        if (state.program_state.gameover) return { hit: false, damage: 0, died: true };

        if (hero.utrap) {
            await publish(`You are released from the ${hero.utraptype === TT_WEB ? 'web' : 'trap'}!`);
            await resetUtrap(false, state);
        }
        const leashes = state.inventory.filter(object => object.otyp === LEASH && object.leashmon).length;
        if (leashes) {
            await publish(leashes > 1 ? 'The leashes snap loose.' : 'The leash snaps loose.');
            releaseAllMonsterLeashes(state);
        }
        if (touchPetrifies(heroSpecies(state)) && !monsterHasStoneResistance(monster)) {
            if (attack.engulfOldX === undefined || attack.engulfOldY === undefined)
                throw new Error("Engulf capture is missing the attacker's original position.");
            monster.mx = attack.engulfOldX;
            monster.my = attack.engulfOldY;
            const petrification = await petrifyMonsterImmediately(monster, {
                creditHero: true, publish,
                finishDeath: (target: Monster, death: HeroMonsterKillOptions = {}) => finishHeroMonsterKill(target, target.mx, target.my, {
                    ...death, showKillMessage: false, recordConduct: false,
                }),
            });
            if (petrification.heroDied || state.program_state.gameover)
                return { hit: false, damage: 0, died: true };
            if (state.uball) await placeBallAndChain(state, publish);
            setHeroGrip(null, state);
            return { hit: false, damage: 0, died: false };
        }

        await flushMessages();
        await vision_recalc(2);
        hero.uswallow = 1;
        const level = monster.m_lev;
        let duration;
        if (attack.damageType === AD_DGST) {
            const endurance = Math.max(0, currentAttribute(A_CON, state) + 10 - hero.uac + random(20));
            duration = Math.trunc(endurance / level) + 3;
        } else duration = rollOne(level + 5);
        hero.uswldtim = Math.max(2, duration);
        await swallowed(true);
        if (!FLAMING_SPECIES.has(monster.mnum)) await snuffEngulfedLights(state, publish);
    }

    if (monster !== hero.ustuck) return { hit: false, damage: 0, died: false };
    moveSwallowedBallAndChain(monster, state);
    if (hero.uswldtim !== undefined && hero.uswldtim > 0) hero.uswldtim--;

    let damage = attack.engulfDamage ?? 0;
    let physical = false;
    switch (attack.damageType) {
    case AD_DGST:
        physical = true;
        if (hero.slowDigestion) {
            hero.uswldtim = 0;
            damage = 0;
        } else if (!hero.uswldtim) {
            await publish(`${monsterName(monster, { state, capitalized: true })} totally digests you!`);
            damage = hero.uhp * (hero.halfPhysicalDamage ? 2 : 1);
        } else {
            const degree = hero.uswldtim === 2 ? ' thoroughly'
                : hero.uswldtim === 1 ? ' utterly' : '';
            await publish(`${monsterName(monster, { state, capitalized: true })}${degree} digests you!`);
            await exerciseAttribute(A_STR, false, state);
        }
        break;
    case AD_PHYS:
        physical = true;
        if (monster.mnum === MONSTER_NAME.indexOf('fog cloud')) {
            const flaming = FLAMING_SPECIES.has(heroSpecies(state));
            const amphibious = monsterIsAmphibious(heroSpecies(state));
            const breathless = heroIsBreathless(state);
            const effect = flaming ? 'are smoldering out!'
                : breathless ? 'find it mildly uncomfortable.'
                    : amphibious ? 'feel comforted.' : 'can barely breathe!';
            await publish(`You are laden with moisture and ${effect}`);
            if (!flaming && (amphibious || hero.magicalBreathing || breathless)) damage = 0;
        } else {
            await publish(`You are ${monsterEnfolds(monster)
                ? 'being squashed' : 'pummeled with debris'}!`);
            await exerciseAttribute(A_STR, false, state);
        }
        break;
    case AD_ACID:
        if (hero.acidResistance) {
            await publish('You are covered with a seemingly harmless goo.');
            damage = 0;
        } else {
            await publish(heroIsHallucinating(state)
                ? "Ouch!  You've been slimed!" : 'You are covered in slime!  It burns!');
            await exerciseAttribute(A_STR, false, state);
        }
        break;
    case AD_BLND:
        // C gulpmu() AD_BLND: can_blnd(AT_ENGL) keeps the hero blind until
        // disgorged.
        if (engulfCanBlindHero(state)) {
            if (!heroIsBlind(state)) {
                const wasBlinded = heroIsBlinded(state);
                if (!wasBlinded) await publish("You can't see in here!");
                await makeBlinded(damage, { state, talk: false, publish });
                if (!wasBlinded && !heroIsBlind(state)) await publish('Your vision quickly clears.');
            } else {
                setHeroBlindnessTurns((state.u.blindTurns ?? 0) + 1, state);
            }
        }
        damage = 0;
        break;
    case AD_ELEC:
    case AD_COLD:
    case AD_FIRE:
        if (monster.mcan || !random(2)) {
            damage = 0;
            break;
        }
        if (attack.damageType === AD_ELEC) {
            await publish('The air around you crackles with electricity.');
            if (hero.shockResistance) {
                await shieldeff(hero.ux, hero.uy, state);
                await publish('You seem unhurt.');
                await applyHeroGolemEffects(attack.damageType, damage, { state, publish });
                damage = 0;
            }
        } else {
            const fire = attack.damageType === AD_FIRE;
            if (fire ? hero.fireResistance : hero.coldResistance) {
                await shieldeff(hero.ux, hero.uy, state);
                await publish(formatFeltMessage(fire ? 'mildly hot.' : 'mildly chilly.', state));
                await applyHeroGolemEffects(attack.damageType, damage, { state, publish });
                damage = 0;
            } else {
                await publish(fire ? 'You are burning to a crisp!' : 'You are freezing to death!');
            }
            if (fire) await burnAwayHeroSlime(state, publish);
        }
        break;
    case AD_DISE:
        if (!await diseasemu(monster, state, publish, random)) damage = 0;
        break;
    case AD_DREN:
        // AC magic cancellation doesn't help when engulfed.
        if (!monster.mcan && random(4)) {
            await publish(drainHeroEnergy(state, damage, { rollOne }));
        }
        damage = 0;
        break;
    case AD_MAGM:
    case AD_SLEE:
    case AD_DISN:
    case AD_DRST:
    case AD_SPC1:
    case AD_SPC2:
    case AD_STUN:
    case AD_SLOW:
    case AD_PLYS:
    case AD_DRLI:
    case AD_LEGS:
    case AD_STON:
    case AD_STCK:
    case AD_SGLD:
    case AD_SITM:
    case AD_SEDU:
    case AD_TLPT:
    case AD_RUST:
    case AD_CONF:
    case AD_HEAL:
    case AD_WRAP:
    case AD_WERE:
    case AD_DRDX:
    case AD_DRCO:
    case AD_DRIN:
    case AD_DCAY:
    case AD_SSEX:
    case AD_HALU:
    case AD_DETH:
    case AD_PEST:
    case AD_FAMN:
    case AD_SLIM:
    case AD_ENCH:
    case AD_CORR:
    case AD_POLY:
    case AD_CLRC:
    case AD_SPEL:
    case AD_RBRE:
    case AD_SAMU:
    case AD_CURS:
    default:
        physical = true;
        damage = 0;
        break;
    }

    if (physical) {
        // Same damage reduction for AC as in hitmu().
        if (hero.uac < 0) damage -= rollOne(-hero.uac);
        if (damage < 0) damage = 1;
        if (hero.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
    }
    // corpse_chance() uses this engulfer during damage. Native unstuck()
    // clears it before expulsion's landing effects, which happen on the map.
    const previousSwallower = state._monsterSwallower;
    state._monsterSwallower = monster;
    let died;
    try {
        died = await mdamageu(monster, damage, {
            state, publish, ...(die ? { die } : {}),
        });
    } finally {
        state._monsterSwallower = previousSwallower ?? null;
    }
    if (died || state.program_state.gameover) return { hit: true, damage, died: true };
    if (damage) await stopHeroOccupation(state, publish);
    if (state.program_state.gameover) return { hit: true, damage, died: true };
    if (!hero.uswallow) return { hit: true, damage, died: false };

    const petrifies = touchPetrifies(heroSpecies(state))
        && !monsterHasStoneResistance(monster);
    const size = MONSTER_SIZE[heroSpecies(state)];
    const tooLarge = size !== undefined && size >= MZ_HUGE;
    if (petrifies || !hero.uswldtim || tooLarge) {
        const digests = monsterDigests(monster);
        const enfolds = monsterEnfolds(monster);
        if (petrifies) {
            const verb = digests ? 'regurgitates' : enfolds ? 'releases' : 'expels';
            await publish(`${monsterName(monster, { state, capitalized: true })} very hurriedly ${verb} you!`);
        } else {
            await publish(`You get ${digests ? 'regurgitated' : enfolds ? 'released' : 'expelled'}!`);
            if (state.flags.verbose && digests && hero.slowDigestion) {
                await publish(`Obviously ${monsterName(monster, { state })} doesn't like your taste.`);
            }
        }
        const release = await expelHero(monster, {
            state, publish, message: false, random, rollOne,
        });
        if (release.died) return { hit: true, damage, died: true };
    }
    return { hit: true, damage, died: false };
}

// The engulf slot's recording adapter: gulpmu() itself takes the raw rolls.
async function presentHeroEngulfSlot(
    monster: Monster,
    attack: HeroContactAttack,
    state: PlayingGameState,
    {
        random = rn2,
        rollOne = rnd,
        publish = plineWithContinuation,
        flushMessages,
        die,
        calls = [],
    }: MonsterEngulfOptions & { calls?: MonsterCallLog } = {},
) {
    if (attack.engulfDamage === undefined)
        throw new Error('An engulf slot must retain its rolled damage');
    const result = await gulpmu(monster, attack, {
        state,
        publish,
        ...(flushMessages ? { flushMessages } : {}),
        ...(die ? { die } : {}),
        random: (sides: number) => recordRandom(random, calls, sides),
        rollOne: (sides: number) => {
            const value = rollOne(sides);
            calls.push(`rnd(${sides})`);
            return value;
        },
    });
    attack.hit = result.hit;
    attack.damage = attack.appliedDamage = result.damage;
    delete attack.engulfDamage;
    return result;
}

// C mhitu.c:gulp_blnd_check(): taking a blindfold off inside a blinding
// swallower immediately applies the engulfing blindness, like a passive.
export async function gulp_blnd_check({
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<{
    triggered: boolean; died: boolean;
}> {
    if (heroIsBlinded(state) || !state.u.uswallow || !engulfCanBlindHero(state))
        return { triggered: false, died: false };
    const monster = state.u.ustuck;
    if (!monster) throw new Error('Swallowed hero has no swallowing monster');
    const attacks = MONSTER_ATTACKS[monster.mnum];
    if (!attacks) throw new Error(`Swallowing species ${monster.mnum} has no attack data`);
    const attack = attacks.find(([method, damage]) =>
        method === AT_ENGL && damage === AD_BLND);
    if (!attack) return { triggered: false, died: false };

    // The immediate exposure is not another elapsed turn inside the monster.
    if (state.u.uswldtim === undefined)
        throw new Error('Swallowed hero has no digestion timeout');
    state.u.uswldtim++;
    const duration = d(attack[2], attack[3]);
    const slot: HeroContactAttack = {
        kind: 'hero-attack', attackType: AT_ENGL, damageType: AD_BLND,
        hit: true, damage: 0, effect: 'engulf-tick', engulfDamage: duration,
    };
    const result = await gulpmu(monster, slot, { state, publish });
    return { triggered: true, died: result.died };
}

async function knockHeroFromMonster(
    monster: Monster,
    attack: Pick<HeroContactAttack, 'attackType' | 'damageType' | 'hit'>,
    state: PlayingGameState,
    random: RandomBelow,
    publish: PublishMonsterMessage = plineWithContinuation,
) {
    const finishDeath = (target: Monster, options: MonsterDeathOptions = {}) =>
        finishEnvironmentalMonsterDeath(target, state, { ...options, publish });
    return mhitm_knockback(monster, state.u, attack, {
        state,
        random,
        publish,
        hit: attack.hit,
        weaponUsed: !!monsterWieldedWeapon(monster),
        finishMonsterDeath: finishDeath,
        finishLiquidDeath: (target: Monster, liquid: MonsterLiquidDeathContext) =>
            finishDeath(target, {
                noCorpse: !liquid.leaveCorpse, random: liquid.random,
                sadFeeling: liquid.sadFeeling,
            }),
    });
}

// C mhitu.c:hitmu(): the contact tail after mhitm_adtyping() — the deferred
// stoning and poison fragments, mhitm_knockback(), the negative-AC and
// permanent-damage reductions, mdamageu() and passiveum().  The begin-phase
// inline physical, grid-bug and poison slots run this same tail; deferred
// slots reach it from the presenter.
async function hitmu(
    monster: Monster,
    attack: HeroContactAttack,
    state: PlayingGameState,
    {
        random = rn2,
        rollOne = rnd,
        rollDice = d,
        publish = plineWithContinuation,
        die,
        calls = [],
    }: MonsterDamageOptions & { calls?: MonsterCallLog } = {},
) {
    if (
        attack.damageType === AD_STON &&
        await applyMonsterStoningAttack(monster, { state, random, publish })
    ) {
        // C uhitm.c:mhitm_ad_ston() mhitu branch: a successful do_stone_u()
        // sets mhm.done, but mhitu.c:hitmu() still runs mhitm_knockback()
        // before it returns on mhm.done.
        attack.contactDone = true;
        const knockback = await knockHeroFromMonster(monster, attack, state, random, publish);
        if (knockback.defenderLeftLevel) attack.attackerDone = true;
        if (knockback.defenderDied) attack.heroDied = true;
        return;
    }
    if (attack.poison) {
        const poison = await poisonHeroFromMonster(monster, attack.attackType, {
            ...attack.poison,
            state,
            random,
            rollOne,
            rollDice,
            publish,
            ...(die ? { die } : {}),
        });
        attack.poison = null;
        if (poison.died) {
            attack.heroDied = true;
            return;
        }
    }
    const knockback = await knockHeroFromMonster(monster, attack, state, random, publish);
    if (knockback.defenderLeftLevel) attack.attackerDone = true;
    if (knockback.defenderDied) {
        attack.heroDied = true;
        return;
    }
    if (attack.contactDone) {
        attack.nativeResult ??= M_ATTK_HIT;
        return;
    }
    // Negative armor class reduces damage done instead of fully protecting
    // against hits; Half_physical_damage applies only after that reduction
    // and rounds odd positive damage upward.  This is not the AC_VALUE
    // to-hit draw.
    const armorClass = state?.u?.uac ?? 10;
    let appliedDamage = attack.damage ?? 0;
    if (appliedDamage > 0 && armorClass < 0) {
        const reduction = rollOne(-armorClass);
        calls.push(`rnd(${-armorClass})`);
        appliedDamage = Math.max(1, appliedDamage - reduction);
    }
    const mitreProtects = state.urole.key === 'priest'
        && artifactById(state.uarmh?.oartifact, state)?.questArtifact
        && monsterHatesBlessings(monster);
    if (appliedDamage > 0 && (state.u.halfPhysicalDamage || mitreProtects)) {
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);
    }
    attack.appliedDamage = appliedDamage;
    if (attack.permanentDamage && attack.appliedDamage > 0) {
        const damage = attack.appliedDamage;
        let drain = recordRandom(random, calls, Math.trunc(damage / 2) + 1);
        const hero = state.u;
        const polymorphed = Upolyd(hero);
        if (polymorphed || hero.uhpmax > 25 * hero.ulevel) drain = damage;
        else if (hero.uhpmax > 10 * hero.ulevel) drain += Math.trunc(damage / 2);
        else if (hero.uhpmax > 5 * hero.ulevel) drain += Math.trunc(damage / 4);
        const maximum = polymorphed ? 'mhmax' : 'uhpmax';
        const lowerLimit = polymorphed
            ? Math.min(MONSTER_LEVEL[hero.umonnum] ?? 0, hero.ulevel) : Math.max(hero.ulevel, 1);
        if (hero[maximum] > lowerLimit)
            hero[maximum] = Math.max(lowerLimit, hero[maximum] - drain);
        state.context.botl = true;
    }
    // mdamageu(): subtract from the active body and clamp only down to its
    // maximum.  Lethal HP stays negative until the presenter's death
    // handler commits zero, after done_in_by() has announced the death.
    state.context.botl = true;
    if (Upolyd(state.u)) {
        state.u.mh = (state.u.mh ?? 1) - appliedDamage;
        if (state.flags.showdamage && appliedDamage)
            await publish(`[HP ${-appliedDamage}, ${state.u.mh} left]`);
        state.u.mh = Math.min(state.u.mh, state.u.mhmax ?? 1);
    } else {
        state.u.uhp -= appliedDamage;
        if (state.flags.showdamage && appliedDamage)
            await publish(`[HP ${-appliedDamage}, ${state.u.uhp} left]`);
        state.u.uhp = Math.min(state.u.uhp, state.u.uhpmax);
    }
    // Complete body loss before applying the old form's passive response.
    if (Upolyd(state.u) && state.u.mh < 1) {
        const restored = await returnHeroToHumanForm(state, { publish, ...(die ? { die } : {}) });
        if (restored.died) {
            attack.passive = { heroDied: true, attackerStopped: true };
            attack.heroDied = true;
            return;
        }
    }
    if (appliedDamage <= 0) {
        attack.passive = { attackerStopped: false };
        return;
    }
    attack.passive = await passiveum(monster, attack.oldFormMnum ?? state.u.umonnum,
        attack.attackType, { state, random, rollDice, publish });
    if (attack.passive.heroDied) attack.heroDied = true;
}

export async function completeHeroAttackSlot(
    action: MonsterMovementAction,
    state: PlayingGameState,
    random: RandomBelow = rn2,
    rollDice: RollDice = d,
    rollOne: RollOne = rnd,
) {
    const sequence = action.movement?.heroAttackSequence;
    if (!sequence) return null;
    const attack = sequence.current;
    if (!attack) return null;
    let result = attack.nativeResult;
    if (result === undefined) {
        result =
            attack.hit || (attack.kind === 'hero-spell' && attack.cast) ? M_ATTK_HIT : M_ATTK_MISS;
        if (action.monster.dead || action.monster.mhp <= 0) result |= M_ATTK_AGR_DIED;
        if (
            (attack.kind === 'hero-attack' && attack.passive?.attackerStopped) ||
            attack.attackerDone
        )
            result |= M_ATTK_AGR_DONE;
    }
    sequence.results[attack.attackIndex] = result;
    // C mattacku() commits pending status before the next attack slot.
    if (state === game && state.context.botl) await bot();
    if (attack.kind === 'hero-attack' && attack.skipBrainDrain) sequence.skipBrainDrain = true;
    if (
        result === M_ATTK_HIT &&
        state.u.usleep &&
        state.u.usleep < state.moves &&
        recordRandom(random, action.calls, 10) === 0
    ) {
        setMulti(-1, state);
        state._helplessDoneMessage = 'The combat suddenly awakens you.';
    }
    sequence.current = null;
    if (
        state.program_state.gameover ||
        action.monster.dead ||
        action.monster.mhp <= 0 ||
        result & (M_ATTK_AGR_DIED | M_ATTK_AGR_DONE)
    ) {
        sequence.done = true;
        return null;
    }
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    try {
        return await advanceHeroAttackSequence(
            sequence,
            state,
            random,
            rollOne,
            rollDice,
            action.calls,
        );
    } finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
}

// C mhitu.c:mpoisons_subj(). The noun for a poisoning monster's attack
// method; uhitm.c's effect branches compose it into their reasons.
export function mpoisons_subj(monster: Monster, attackType: AttackMethod): string {
    if (attackType === AT_WEAP)
        return monsterWieldedWeapon(monster)?.opoisoned ? 'weapon' : 'attack';
    if (attackType === AT_TUCH) return 'contact';
    if (attackType === AT_GAZE) return 'gaze';
    return attackType === AT_BITE ? 'bite' : 'sting';
}

const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');

// C mhitu.c:u_slip_free(): greased or oilskin clothing protects against a
// grab (mhitm_ad_phys's hug branch) or a wrap (mhitm_ad_wrap); an engulfing
// wrap (AT_ENGL) ignores grease entirely. The AD_DRIN greased-helmet variant
// stays inlined in the mhitm_ad_drin port.
export async function u_slip_free(
    monster: Monster, attackType: number, damageType: number,
    state: PlayingGameState,
    random: (range: number) => number, publish: MessagePublisher,
): Promise<boolean> {
    if (attackType === AT_ENGL) return false;
    const armor = state.uarmc || state.uarm || state.uarmu;
    if (!armor || (!armor.greased && armor.otyp !== OILSKIN_CLOAK)) return false;
    if (armor.cursed && random(3) === 0) return false;

    const name = armor.greased || objectTypeKnown(armor, state)
        ? objectCombatName(armor, { state }) : armorSimpleName(armor, state);
    const subject = monsterName(monster, { state, capitalized: true });
    await publish(damageType === AD_WRAP
        ? `${subject} slips off of your ${armor.greased ? 'greased' : 'slippery'} ${name}!`
        : `${subject} grabs you, but cannot hold onto your ${armor.greased ? 'greased' : 'slippery'} ${name}!`);
    // The grease roll and inventory change follow the slip message, which
    // may suspend for a pager while the armor is still greased.
    if (armor.greased && random(2) === 0) {
        await publish('The grease wears off.');
        armor.greased = false;
    }
    return true;
}

// doseduce() and mayberem(); entered from uhitm.c:mhitm_ad_ssex()'s
// hero branch and sounds.c chat with a cancelled seducer.

const RIN_ADORNMENT = OBJECT_NAMES.indexOf('adornment');

interface SeductionContext {
    monster: Monster;
    state: PlayingGameState;
    level: PlayingGameState['level'];
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    female: boolean;
    who: string;
}

// C mhitu.c:doseduce(). The leap-day gloves joke inlines invent.c
// u_carried_gloves(): worn gloves, else the first carried pair.
export async function doseduce(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2, rollOne: typeof rnd,
    { allowCancelledSeducer = false }: { allowCancelledSeducer?: boolean } = {},
): Promise<void> {
    if (monster.mcan) {
        // C sounds.c:MS_SEDUCE calls doseduce() without a cancellation gate,
        // so a cancelled seducer still complains about a severe headache when
        // chatting.  The attack path (uhitm.c:mhitm_ad_ssex) gates on !mcan
        // and stays silent.
        if (allowCancelledSeducer) {
            await publish(`${monsterName(monster, { state, capitalized: true })} acts as though ${monsterSubjectPronoun(monster, { state })} has got a severe headache.`);
        }
        return;
    }
    if (could_seduce(monster, 'hero',
        [attack.attackType, attack.damageType, 0, 0], state) !== 1) return;
    const female = !!monster.female;
    if (monster.mspec_used) {
        await publish(`${monsterName(monster, { state, capitalized: true })} acts as though ${monsterSubjectPronoun(monster, { state })} has got a headache.`);
        return;
    }
    const reason = state._helplessReason;
    const reasonText = typeof reason === 'string' ? reason : reason?.text ?? '';
    if (heroIsUnaware(state) || (heroHasInvoluntaryDelay(state) && /^(?:frozen|paralyzed)/.test(reasonText))) {
        await publish(`${monsterName(monster, { state, capitalized: true })} seems dismayed at your lack of response.`);
        return;
    }
    const visible = canSeeMonster(monster);
    await publish(visible ? formatFeltMessage(`very attracted to ${monsterName(monster, { state })}.`, state)
        : 'Someone caresses you...');
    const context: SeductionContext = { monster, state, level: state.level, publish, random, rollOne,
        female, who: visible ? monsterName(monster, { state, capitalized: true }) : female ? 'She' : 'He' };
    await stopDonning(null, state);
    const triedGloves = await exchangeAdornmentRings(context);
    if (!stillTogether(context)) return finishSeductionAttack(attack);
    await undressHero(context, triedGloves);
    if (!stillTogether(context)) return finishSeductionAttack(attack);
    if (state.uarm || state.uarmc) {
        if (!heroIsDeaf(state)) {
            if (recorderIsLeapDay(state.datetime) && female) {
                const gloves = state.uarmg
                    ?? state.inventory.find(object => armorSlotFor(object.otyp) === 'uarmg');
                // The succubus reveals the gloves even when the hero is blind.
                if (gloves) {
                    observeObject(gloves, state);
                    observeObjectForNaming(gloves, { state });
                }
                await publish(`"Well, then you owe me ${gloves
                    ? `${ownedObjectName(gloves, state, { capitalized: false })} and eleven more pairs of gloves`
                    : 'twelve pairs of gloves'}!"`);
            } else {
                await publish(`"You're such a ${state.flags.female ? 'sweet lady' : 'nice guy'}; I wish..."`);
            }
        } else if (visible) {
            await publish(`${monsterName(monster, { state, capitalized: true })} appears to sigh.`);
        }
        await leaveSeduction(context);
        return finishSeductionAttack(attack);
    }
    if (state.u.ualign.type === -1) adjustHeroAlignment(1, state);
    await publish(`Time stands still while you and ${monsterName(monster, { state, article: 'your', suppressIt: true })} lie in each other's arms...`, { urgent: true });
    await seductionOutcome(context);
    if (state.program_state.gameover) return finishSeductionAttack(attack);
    await paySeducer(context);
    if (random(25) === 0) monster.mcan = 1;
    await leaveSeduction(context);
    finishSeductionAttack(attack);
}

function stillTogether({ state, monster, level }: SeductionContext): boolean {
    return !state.u.utotype && state.level === level && !state.program_state.gameover
        && Math.abs(state.u.ux - monster.mx) <= 1 && Math.abs(state.u.uy - monster.my) <= 1;
}

function finishSeductionAttack(attack: HeroContactAttack): void {
    attack.contactDone = true;
    attack.attackerDone = true;
    attack.nativeResult = M_ATTK_AGR_DONE;
}

async function exchangeAdornmentRings(context: SeductionContext): Promise<boolean> {
    const { state, monster, female, who, publish, random } = context;
    let triedGloves = isWeldedPrimary(state.uwep, state);
    for (const ring of [...state.inventory]) {
        if (ring.otyp !== RIN_ADORNMENT) continue;
        if (!female && state.uleft?.otyp === RIN_ADORNMENT && state.uright?.otyp === RIN_ADORNMENT) break;
        if (!female && (ring === state.uleft || ring === state.uright)) continue;
        if (state.uarmg && (!female || ring.owornmask)) {
            if (!triedGloves) {
                triedGloves = true;
                await mayberem(context, state.uarmg, 'gloves');
            }
            if (state.uarmg) {
                if (!female) break;
                continue;
            }
        }
        if (!heroIsDeaf(state) && random(20) < currentAttribute(A_CHA, state)) {
            const suffix = female ? ' looks pretty.  May I have it?"'
                : ' looks pretty.  Would you wear it for me?"';
            observeObjectForNaming(ring, { state });
            const prefix = '"That ';
            const name = seductionRingName(ring, state, QBUFSZ - 1 - prefix.length - suffix.length);
            learnObjectType(RIN_ADORNMENT, state);
            if (await promptYesNo(`${prefix}${name}${suffix}`) === 'n') continue;
        } else {
            observeObjectForNaming(ring, { state });
            if (female) {
                await publish(`${who} decides she'd like ${ownedObjectName(ring, state, { capitalized: false })}, and takes it.`);
            } else {
                await publish(`${who} decides you'd look prettier wearing ${ownedObjectName(ring, state, { capitalized: false })},`);
                await publish('and puts it on your finger.');
            }
        }
        learnObjectType(RIN_ADORNMENT, state);
        if (female) {
            if (ring.owornmask) await removeWornHeroItem(ring, state);
            unlinkObject(ring, state);
            await addObjectToMonsterInventory(monster, ring, state);
            continue;
        }
        const slot = !state.uright ? 'uright' : !state.uleft ? 'uleft'
            : state.uright.otyp !== RIN_ADORNMENT ? 'uright' : 'uleft';
        const previous = state[slot];
        if (previous) {
            observeObjectForNaming(previous, { state });
            await publish(`${who} replaces ${ownedObjectName(previous, state, { capitalized: false })} with ${ownedObjectName(ring, state, { capitalized: false })}.`);
            await removeHeroAccessory(previous, state);
            if (!stillTogether(context)) return triedGloves;
        } else {
            await publish(`${who} puts the ${objectName(ring, state)} on your ${slot === 'uright' ? 'right' : 'left'} ${heroHandName(state)}.`);
        }
        await wearHeroAccessory(ring, slot, state);
        await publish(`${ring.invlet || '?'} - ${await inventoryItemDescription(ring)}.`);
    }
    return triedGloves;
}

// C safe_qbuf()/short_oname(xname, simpleonames). Ring xname() has no
// beatitude or erosion prefixes; shorten user names before the simple fallback.
function seductionRingName(ring: GameObject, state: PlayingGameState, limit: number): string {
    const fullName = objectName(ring, state);
    if (fullName.length <= limit) return fullName;

    const callName = state._objectCallNames?.[ring.otyp];
    const personalName = ring.oextra?.oname || ring.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...state, _objectCallNames: {
            ...state._objectCallNames, [ring.otyp]: `${callName.slice(0, 8)}...`,
        } } : state;
    const shortNamedRing = personalName && personalName.length >= 12
        ? { ...ring, oextra: { ...ring.oextra, oname: `${personalName.slice(0, 8)}...` } }
        : ring;

    if (shortCallState !== state) {
        const name = objectName(ring, shortCallState);
        if (name.length <= limit) return name;
    }
    if (shortNamedRing !== ring) {
        const name = objectName(shortNamedRing, state);
        if (name.length <= limit) return name;
    }
    if (shortCallState !== state && shortNamedRing !== ring) {
        const name = objectName(shortNamedRing, shortCallState);
        if (name.length <= limit) return name;
    }
    const simpleName = simpleObjectName(ring, state);
    return simpleName.length <= limit ? simpleName : 'ring';
}

async function undressHero(context: SeductionContext, triedGloves: boolean): Promise<void> {
    const { state, who, publish } = context;
    const naked = !state.uarmc && !state.uarmf && !state.uarmg && !state.uarms && !state.uarmh && !state.uarmu;
    await publish(`${who} ${heroIsDeaf(state) ? 'seems to murmur into your ear'
        : naked ? 'murmurs sweet nothings into your ear' : 'murmurs in your ear'}${naked ? '' : ', while helping you undress'}.`, { urgent: true });
    if (state.uarmc) await mayberem(context, state.uarmc, armorSimpleName(state.uarmc, state));
    if (!state.uarmc && state.uarm) await mayberem(context, state.uarm, armorSimpleName(state.uarm, state));
    await mayberem(context, state.uarmf, 'boots');
    if (!triedGloves) await mayberem(context, state.uarmg, 'gloves');
    await mayberem(context, state.uarms, 'shield');
    if (state.uarmh) await mayberem(context, state.uarmh, armorSimpleName(state.uarmh, state));
    if (!state.uarmc && !state.uarm) await mayberem(context, state.uarmu, 'shirt');
}

// C mhitu.c:mayberem().
async function mayberem(context: SeductionContext, armor: GameObject | null | undefined, name: string): Promise<void> {
    if (!armor?.owornmask || !stillTogether(context)) return;
    const { state, who, publish, random } = context;
    if (heroIsDeaf(state)) {
        await publish(`${who} takes off your ${name}.`);
    } else if (random(20) < currentAttribute(A_CHA, state)) {
        const endearment = random(2) === 0 ? 'lover' : random(2) === 0 ? 'dear' : 'sweetheart';
        if (await promptYesNo(`"Shall I remove your ${name}, ${endearment}?"`) === 'n') return;
    } else {
        const explanation = armor === state.uarm ? "let's get a little closer"
            : armor === state.uarmc || armor === state.uarms ? "it's in the way"
            : armor === state.uarmf ? 'let me rub your feet'
            : armor === state.uarmg ? "they're too clumsy"
            : armor === state.uarmu ? 'let me massage you'
            : `let me run my fingers through your ${heroHairName(state)}`;
        await publish(`"Take off your ${name}; ${explanation}."`);
    }
    await removeWornHeroItem(armor, state);
}

async function seductionOutcome(context: SeductionContext): Promise<void> {
    const { state, monster, publish, random, rollOne } = context;
    const hero = state.u;
    const attributes = currentAttribute(A_CHA, state) + currentAttribute(A_INT, state);
    if (random(35) > Math.min(attributes, 32)) {
        await publish(`${monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true })} seems to have enjoyed it more than you...`);
        const outcome = random(5);
        if (outcome === 0) {
            await publish(formatFeltMessage('drained of energy.', state));
            hero.uen = 0;
            hero.uenmax -= rollOne(hero.halfPhysicalDamage ? 5 : 10);
            await exerciseAttribute(A_CON, false, state);
            hero.uenmax = Math.max(0, hero.uenmax);
        } else if (outcome === 1 || outcome === 2) {
            await publish(outcome === 1 ? 'You are down in the dumps.' : 'Your senses are dulled.');
            const attribute = outcome === 1 ? A_CON : A_WIS;
            const change = adjustAttribute(attribute, -1, state);
            if (change.changed && attribute === A_CON && state._moveloopStarted)
                await encumber_msg(state);
            await exerciseAttribute(attribute, false, state);
            state.context.botl = true;
        } else if (outcome === 3) {
            if (!heroHasDrainResistance(state)) {
                await publish(formatFeltMessage('out of shape.', state));
                await loseHeroExperience('overexertion', { state, publish });
            } else await publish('You have a curious feeling...');
            await exerciseAttribute(A_CON, false, state);
            await exerciseAttribute(A_DEX, false, state);
            await exerciseAttribute(A_WIS, false, state);
        } else {
            await publish(formatFeltMessage('exhausted.', state));
            await exerciseAttribute(A_STR, false, state);
            const damage = 6 + random(10);
            await loseHeroHp(hero.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 'exhaustion',
                { state, publish, killerFormat: KILLED_BY });
        }
        return;
    }
    monster.mspec_used = rollOne(100);
    await publish(`You seem to have enjoyed it more than ${monsterName(monster, { state, article: 'your', suppressIt: true })}...`);
    const outcome = random(5);
    if (outcome === 0) {
        await publish(formatFeltMessage('raised to your full potential.', state));
        await exerciseAttribute(A_CON, true, state);
        hero.uenmax += rollOne(5);
        hero.uen = hero.uenmax;
        hero.uenpeak = Math.max(hero.uenpeak, hero.uenmax);
    } else if (outcome === 1 || outcome === 2) {
        await publish(outcome === 1 ? formatFeltMessage('good enough to do it again.', state)
            : `You will always remember ${monsterName(monster, { state, article: 'your', suppressIt: true })}...`);
        const attribute = outcome === 1 ? A_CON : A_WIS;
        const change = adjustAttribute(attribute, 1, state);
        if (change.changed && attribute === A_CON && state._moveloopStarted)
            await encumber_msg(state);
        await exerciseAttribute(attribute, true, state);
        state.context.botl = true;
    } else if (outcome === 3) {
        await publish('That was a very educational experience.');
        await gainExperienceLevel({ state, publish });
        await exerciseAttribute(A_WIS, true, state);
    } else {
        await publish(formatFeltMessage('restored to health!', state));
        hero.uhp = hero.uhpmax;
        if (Upolyd(hero)) hero.mh = hero.mhmax;
        await exerciseAttribute(A_STR, true, state);
        state.context.botl = true;
    }
}

async function paySeducer(context: SeductionContext): Promise<void> {
    const { state, monster, publish, random, rollOne } = context;
    if (monster.mtame) return;
    if (random(20) < currentAttribute(A_CHA, state)) {
        const name = monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true });
        await publish(`${name} demands that you pay ${monsterObjectPronoun(monster, { state, noIt: true, random })}, but you refuse...`);
        return;
    }
    if (heroSpecies(state) === MONSTER_NAME.indexOf('leprechaun')) {
        const name = monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true });
        await publish(`${name} tries to take your gold, but fails...`);
        return;
    }
    const money = heroGoldAmount(state);
    let cost = rollOne(money > LARGEST_INT - 10 ? LARGEST_INT : money + 10) + 500;
    if (monster.mpeaceful) cost = Math.max(1, Math.trunc(cost / 5));
    cost = Math.min(cost, money);
    if (!cost) await publish(heroIsDeaf(state) ? 'No charge.' : '"It\'s on the house!"');
    else {
        const name = monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true });
        await publish(`${name} takes ${cost} ${currency(cost, { state, random })} for services rendered!`);
        if (cost === money) {
            const purse = heroGoldObject(state);
            if (purse?.owornmask) await removeWornHeroItem(purse, state);
        }
        const payment = detachHeroGold(state, cost);
        if (!payment) throw new Error('Seduction payment selected an absent purse.');
        await linkObjectToMonsterInventory(monster, payment, { state });
        state.context.botl = true;
    }
}

async function leaveSeduction({ monster, state, publish, random, rollOne }: SeductionContext): Promise<void> {
    if (!await reportMonsterTeleportRestriction(monster, { state, publish }))
        await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
}

// ---------------------------------------------------------------------------
// Native mhitu.c:missmu(), wildmiss(), and the unfound-target engulf branch.
// ---------------------------------------------------------------------------
// C mhitu.c:missmu(): the attacker's miss line; wildmiss() and the
// unfound-target engulf branch of mattacku()'s AT_ENGL case dispatch here
// from the presenter.
export async function missmu(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState, random: RandomBelow,
): Promise<string | null> {
    if (attack.effect === 'wild-miss') return wildmiss(monster, attack, state, random);
    if (attack.effect === 'engulf-unfound') return engulfMissMessage(monster, state);

    // Native missmu() publishes both miss lines through pline_mon(), which
    // anchors them at the attacker's square for accessiblemsg prefixes.
    set_msg_xy(monster.mx, monster.my);
    const friendly = !monster.mcan && could_seduce(monster, 'hero',
        [attack.attackType, attack.damageType, 0, 0], state);
    const subject = monsterName(monster, { state, capitalized: true });
    if (friendly) return `${subject} pretends to be friendly.`;
    return `${subject} ${attack.nearMiss && state.flags.verbose !== false ? 'just ' : ''}misses!`;
}
// C mhitu.c:wildmiss(): the attacker struck the wrong location through
// blindness, hero invisibility, displacement, or water.
async function wildmiss(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState, random: RandomBelow,
): Promise<string | null> {
    const invisible = heroIsInvisible(state);
    const unseen = !monster.mcansee
        || invisible && !(monsterPerceives(monster.mnum));
    const displaced = heroIsDisplaced(state);
    const submerged = !!(state.underwater || state.u.uinwater);
    if (!unseen && !displaced && !submerged) {
        const subject = monsterName(monster, { state, capitalized: true, augmentIt: true });
        await impossible(`${subject} attacks you without knowing your location?`, { state });
        return null;
    }
    // Native gates both the monster name's display randomness and the unseen
    // target's wording draw on seeing the square, not identifying the attacker.
    if (state.flags.verbose === false || !cansee(monster.mx, monster.my)) return null;
    const compatibility = attack.damageType === AD_SEDU || attack.damageType === AD_SSEX
        ? could_seduce(monster, 'hero', [attack.attackType, attack.damageType, 0, 0], state) : 0;
    const subject = monsterName(monster, { state, capitalized: true });
    set_msg_xy(monster.mx, monster.my);
    if (unseen) {
        if (compatibility) return `${subject} tries to touch you and misses!`;
        switch (random(3)) {
            case 0: {
                const verb = attack.attackType === AT_BITE ? 'snaps'
                    : attack.attackType === AT_KICK ? 'kicks'
                    : attack.attackType === AT_STNG || attack.attackType === AT_BUTT
                        || monsterHasNoLimbs(monster.mnum) ? 'lunges' : 'swings';
                return `${subject} ${verb} wildly and misses!`;
            }
            case 1:
                return `${subject} attacks a spot beside you.`;
            default: {
                const target = monster.mux === undefined || monster.muy === undefined
                    ? null : state.level.at(monster.mux, monster.muy);
                return `${subject} strikes at ${target && IS_WATERWALL(target.typ) ? 'empty water' : 'thin air'}!`;
            }
        }
    }
    if (displaced) {
        const image = `${invisible ? 'invisible ' : ''}displaced image`;
        return compatibility
            ? `${subject} smiles ${compatibility === 2 ? 'engagingly' : 'seductively'} at your ${image}...`
            : `${subject} strikes at your ${image} and misses you!`;
    }
    return compatibility ? `${subject} reaches towards your distorted image.`
        : `${subject} is fooled by water reflections and misses!`;
}

function engulfMissMessage(monster: Monster, state: PlayingGameState): string | null {
    if (monsterDigests(monster)) {
        set_msg_xy(monster.mx, monster.my);
        return `${monsterName(monster, { state, capitalized: true })} gulps some air!`;
    }
    if (canSeeMonster(monster)) {
        set_msg_xy(monster.mx, monster.my);
        return `${monsterName(monster, { state, capitalized: true })} lunges forward and recoils!`;
    }
    // You_hear() has no monster anchor; the heard line stays unpositioned.
    return formatHeardMessage(`a ${monsterIsWhirly(monster) ? 'rushing noise' : 'splat'} nearby.`, state);
}

// ---------------------------------------------------------------------------
// C mhitu.c:diseasemu(). Disease bypasses cancellation and magic negation.
// ---------------------------------------------------------------------------

export async function diseasemu(
    monster: Monster, state: PlayingGameState, publish: MessagePublisher, random: typeof rn2,
): Promise<boolean> {
    if (state.u.sicknessResistance) {
        await publish(formatFeltMessage('a slight illness.', state));
        return false;
    }
    const turns = state.u.sickTurns ? Math.trunc(state.u.sickTurns / 3) + 1
        : random(currentAttribute(A_CON, state)) + 20;
    await startHeroSickness({
        state, turns, cause: monsterTypeName(monster.mnum),
        type: SICK_NONVOMITABLE, publish,
    });
    return true;
}

// ---------------------------------------------------------------------------
// Active monster self-explosions. Native mhitu.c:explmu(), explode.c:mon_explodes().
// ---------------------------------------------------------------------------

const selfExplosionDefense = new Map<DamageType, ArtifactDefenseQuery>([
    [AD_FIRE, 'fire'], [AD_COLD, 'cold'], [AD_ELEC, 'shock'],
    [AD_BLND, 'blindness'], [AD_HALU, 'hallucination'],
]);

async function removeExploder(monster: Monster, state: GameState, publish: MessagePublisher) {
    return finishEnvironmentalMonsterDeath(monster, state, {
        noCorpse: true, publish,
    });
}

export interface MonsterSelfExplosionOptions {
    foundHero: boolean;
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
}

// C mhitu.c:explmu()
export async function resolveMonsterSelfExplosion(monster: Monster, attack: MonsterAttack, {
    foundHero, state = game, publish = plineWithContinuation, die,
}: MonsterSelfExplosionOptions) {
    requirePlayingGame(state);
    if (monster.mcan) return { mask: M_ATTK_MISS, heroDied: false };
    const [, damageType, dice, sides] = attack;
    let damage = d(dice, sides);
    let unaffected = monsterWieldsOrWearsDefense(monster, selfExplosionDefense.get(damageType), state);
    let killSource = true;
    if (foundHero) {
        await publish(`${monsterName(monster, { state, capitalized: true })} explodes!`);
    } else {
        const subject = canSeeMonster(monster)
            ? monsterName(monster, { state, capitalized: true }) : 'It';
        const water = state.level.at(monster.mux ?? state.u.ux, monster.muy ?? state.u.uy)?.typ === WATER;
        await publish(`${subject} explodes at a spot in ${water ? 'empty water' : 'thin air'}!`);
    }
    if (damageType !== AD_FIRE && damageType !== AD_COLD && damageType !== AD_ELEC
        && damageType !== AD_BLND && damageType !== AD_HALU) {
        await impossible(`unknown exploder damage type ${damageType}`);
    } else switch (damageType) {
    case AD_FIRE:
    case AD_COLD:
    case AD_ELEC: {
        const blastDamage = dice ? d(dice, sides)
            : sides ? d((MONSTER_LEVEL[monster.mnum] ?? 0) + 1, sides) : 0;
        if (monster.mhp > 0) {
            const death = await removeExploder(monster, state, publish);
            if (death.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
        }
        // Recovery can change the source's form. Fatal identity stays real,
        // while the area owner draws fresh hallucinated names for its targets.
        const killer = `${possessiveName(monsterTypeName(monster.mnum, !!monster.female))} explosion`;
        const blast = await createElementalMonsterExplosion(
            monster.mx, monster.my, damageType, blastDamage, killer, { state, publish, ...(die ? { die } : {}) },
        );
        if (blast.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
        if (monster.mhp > 0) killSource = false;
        break;
    }
    case AD_BLND:
        unaffected = heroResistsBlindingLight(state);
        if (foundHero && !unaffected) {
            // mon_visible() ignores the square's visibility, unlike canseemon().
            const visible = !monster.mundetected
                && (!monster.minvis || state.u.seeInvisible);
            if (!visible) damage = Math.trunc(damage / 2);
            if (visible || rnd(damage) > state.u.ulevel) {
                await publish('You are blinded by a blast of light!');
                await makeBlinded(damage, { state, talk: false, publish });
                if (!heroIsBlind(state)) await publish('Your vision quickly clears.');
            } else if (state.flags.verbose) {
                await publish('You get the impression it was not terribly bright.');
            }
        }
        break;
    case AD_HALU:
        unaffected ||= heroIsBlind(state)
            || ['black light', 'violet fungus'].includes(MONSTER_NAME[state.u.umonnum] || '')
            || (MONSTER_ATTACKS[state.u.umonnum] || []).some(([, kind]) => kind === AD_STUN);
        if (foundHero && !unaffected) {
            if (!heroIsHallucinating(state))
                await publish('You are caught in a blast of kaleidoscopic light!');
            const death = await removeExploder(monster, state, publish);
            if (death.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
            killSource = false;
            const changed = await makeHallucinated((state.u.hallucinationTurns || 0) + damage, {
                state, talk: false, publish,
            });
            await publish(changed ? 'You are freaked out.' : 'You seem unaffected.');
        }
        break;
    }
    if (unaffected) {
        await publish('You seem unaffected by it.');
        await applyHeroGolemEffects(damageType, damage, { state, publish });
    }
    if (killSource && monster.mhp > 0) {
        const death = await removeExploder(monster, state, publish);
        if (death.heroDied) return { mask: M_ATTK_AGR_DIED, heroDied: true };
    }
    await wakeMonstersNearWithMessages(monster.mx, monster.my, 49, state, publish);
    return { mask: monster.mhp > 0 ? M_ATTK_MISS : M_ATTK_AGR_DIED, heroDied: false };
}

// ---------------------------------------------------------------------------
// C mhitu.c:mswings() and mhitm.c:mswingsm().
// ---------------------------------------------------------------------------

interface WeaponSwingOptions {
    publish?: MessagePublisher;
    defender?: Monster | null;
    random?: (limit: number) => number;
}

// C mhitm.c:mswingsm() when a defender is given, mhitu.c:mswings() otherwise.
export async function swingMonsterWeapon(
    monster: Monster,
    weapon: GameObject,
    state: GameState = game,
    {
        defender = null,
        publish = plineWithContinuation,
        random = rn2,
    }: WeaponSwingOptions = {},
): Promise<void> {
    if (!state.flags.verbose || heroIsBlind(state)
        || !monsterVisible(monster, state)) return;
    const x = defender ? defender.mx : state.u.ux;
    const y = defender ? defender.my : state.u.uy;
    const bash = isPolearm(weapon)
        && artifactById(weapon.oartifact, state)?.name !== 'Snickersnee'
        && (monster.mx - x) ** 2 + (monster.my - y) ** 2 <= 2;
    const subject = monsterName(monster, { state, capitalized: true });
    const verb = mswings_verb(weapon, bash, random);
    const quantity = weapon.quan > 1 ? 'one of ' : '';
    const possessive = perceivedPossessivePronoun(monster, { state, random });
    const name = objectCombatName(weapon, { state, includeCorpseSpecies: false });
    const target = defender ? ` at ${monsterName(defender, { state })}` : '';
    await publish(`${subject} ${verb} ${quantity}${possessive} ${name}${target}.`);
}

// ---------------------------------------------------------------------------
// Active monster gazes. Native mhitu.c:gazemu().
// ---------------------------------------------------------------------------

const reactions = ['confused', 'stunned', 'puzzled', 'dazzled', 'irritated', 'inflamed', 'tired', 'dulled'];

function identifyGazeReflection(source: ReturnType<typeof ureflects>, state: GameState) {
    const object = source?.object;
    if (object && [SHIELD_OF_REFLECTION, AMULET_OF_REFLECTION].includes(object.otyp)) {
        discoverHeroReflectionSource(source, state);
    }
}

export interface MonsterGazeOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    calls?: MonsterCallLog;
    die?: typeof finishMonsterAttackDeath;
}

export async function resolveMonsterGaze(monster: Monster, attack: MonsterAttack, {
    state = game, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd,
    calls = [], die,
}: MonsterGazeOptions = {}) {
    requirePlayingGame(state);
    const [, damageType, dice, sides] = attack;
    if (damageType === AD_FIRE && ((monster.seen_resistance ?? 0) & M_SEEN_FIRE))
        return { mask: M_ATTK_MISS, heroDied: false };
    const visible = () => canSeeMonster(monster);
    const name = (capitalized = true) => monsterName(monster, { state, capitalized });
    const mutualGaze = visible() && couldsee(monster.mx, monster.my) && monster.mcansee;
    const medusa = MONSTER_NAME[monster.mnum] === 'Medusa';
    const reflectable = heroReflectsRay(state) && couldsee(monster.mx, monster.my) && medusa;
    let cancelled = !!monster.mcan;
    if ((heroIsHallucinating(state) && random(4)) || (heroIsUnaware(state) && !reflectable))
        cancelled = true;
    // Native gazemu has effects only for these gaze damage types.
    if (damageType !== AD_STON && damageType !== AD_CONF && damageType !== AD_STUN
        && damageType !== AD_BLND && damageType !== AD_FIRE)
        return { mask: M_ATTK_MISS, heroDied: !!state.program_state.gameover };
    let reaction = -1;
    let already = false;
    switch (damageType) {
    case AD_STON:
        if (cancelled || !monster.mcansee) {
            if (!visible()) break;
            if (heroIsUnaware(state)) { reaction = medusa ? 4 : 2; break; }
            if (medusa && heroIsHallucinating(state) && random(3) === 0)
                await publish('Someone seems overdue for a serpent cut.');
            else await publish(`${name()} gazes ineffectually.`);
            break;
        }
        if (reflectable) {
            const seen = visible();
            const reflection = ureflects(state);
            if (seen && reflection) {
                await publish(`${possessiveName(name())} gaze is reflected by your ${reflection.noun}.`);
                identifyGazeReflection(reflection, state);
            }
            const reflectedBack = mon_reflects(monster, state);
            if (reflectedBack) {
                if (seen) {
                    await publish(`The gaze is reflected away by ${possessiveName(name(false))} ${reflectedBack.noun}!`);
                    identifyGazeReflection(reflectedBack, state);
                }
                break;
            }
            if (!monsterHasLineOfSightToHero(monster, state)) {
                if (seen) await publish(`${name()} doesn't seem to notice that ${monsterPossessive(monster, { state, random })} gaze was reflected.`);
                break;
            }
            if (seen) await publish(`${name()} is turned to stone!`);
            const death = await finishHeroMonsterKillOutcome(
                monster, monster.mx, monster.my, { petrified: true, publish },
            );
            return { mask: death.killed ? M_ATTK_AGR_DIED : M_ATTK_MISS,
                heroDied: !!death.heroDied || !!state.program_state?.gameover };
        }
        if (visible() && couldsee(monster.mx, monster.my)
            && !heroResistsStoning(state) && !heroIsUnaware(state)) {
            await publish(`You meet ${possessiveName(name(false))} gaze.`);
            await stopHeroOccupation(state, publish);
            if (monsterPolymorphsWhenStoned({ mnum: state.u.umonnum })) {
                const change = await polymonHero(MONSTER_NAME.indexOf('stone golem'));
                if (change.transformed) break;
            }
            await publish('You turn to stone...', { urgent: true });
            await finishHeroDeath({ killer: monsterTypeName(monster.mnum, !!monster.female),
                killerFormat: KILLED_BY, deathVerb: 'turned to stone',
                deathLineShown: true, deathType: STONING });
        }
        break;
    case AD_CONF:
    case AD_STUN:
        if (!mutualGaze || monster.mspec_used || !random(5)) break;
        if (cancelled) {
            reaction = damageType === AD_CONF ? 0 : 1;
            already = !!(damageType === AD_CONF ? monster.mconf : monster.mstun);
            break;
        }
        {
            const duration = damageType === AD_CONF ? rollDice(3, 4) : rollDice(2, 6);
            monster.mspec_used = (monster.mspec_used || 0) + duration + random(6);
            if (damageType === AD_CONF) {
                await publish(state.u.confusionTurns ? 'You are getting more and more confused.'
                    : `${possessiveName(name())} gaze confuses you!`);
                await makeConfused((state.u.confusionTurns || 0) + duration, { state, talk: false, publish });
            } else {
                await publish(`${name()} stares piercingly at you!`);
                await makeStunned((state.u.stunnedTurns || 0) + duration, { state, talk: true, publish });
            }
            await stopHeroOccupation(state, publish);
        }
        break;
    case AD_BLND:
        if (!visible() || heroResistsBlindingLight(state)
            || (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 > BOLT_LIM ** 2) break;
        if (cancelled) {
            reaction = random(2) + 2;
            already = !monster.mcansee;
            if (monster.mcan && MONSTER_NAME[monster.mnum] === 'Archon' && random(5)) reaction = -1;
            break;
        }
        {
            const duration = rollDice(dice, sides);
            await publish(`You are blinded by ${possessiveName(name(false))} radiance!`);
            await makeBlinded(duration, { state, talk: false, publish });
            await stopHeroOccupation(state, publish);
            if (!heroIsBlind(state)) await publish('Your vision quickly clears.');
            else await makeStunned(Math.max(state.u.stunnedTurns || 0, rollOne(3)), { state, talk: true, publish });
        }
        break;
    case AD_FIRE:
        if (!mutualGaze || monster.mspec_used || !random(5)) break;
        if (cancelled) { reaction = random(2) + 4; break; }
        {
            const originalDamage = rollDice(2, 6);
            let damage = originalDamage;
            const level = monster.m_lev;
            await publish(`${name()} attacks you with a fiery gaze!`);
            await stopHeroOccupation(state, publish);
            const observers = (target: Monster) => monsterHasLineOfSightToHero(target, state);
            if (state.u.fireResistance || ((MONSTER_RESISTS[state.u.umonnum] ?? 0) & 0x01)) {
                await shieldeff(state.u.ux, state.u.uy);
                await publish("The fire doesn't feel hot!");
                monstersObserveHeroResistance(M_SEEN_FIRE, state, observers);
                await applyHeroGolemEffects(AD_FIRE, rollDice(12, 6), { state, publish });
                damage = 0;
            } else monstersForgetHeroResistance(M_SEEN_FIRE, state, observers);
            await burnAwayHeroSlime(state, publish);
            if (level > random(20)) await burnArmorByFire(state.u, state, publish, calls, random);
            if (level > random(20)) {
                const items = await destroyInventoryByElement('fire', originalDamage, { state, publish, random, rollOne });
                if (items.heroDied || state.program_state?.gameover)
                    return { mask: M_ATTK_MISS, heroDied: true };
                await igniteItems(state.inventory, { state, publish, random });
            }
            if (damage) await mdamageu(monster, damage, { state, publish, ...(die ? { die } : {}) });
        }
        break;
    }
    if (reaction >= 0 && !state.program_state?.gameover) {
        if (heroIsHallucinating(state) && random(3)) reaction = random(reactions.length);
        const modifier = random(3) ? already ? 'quite ' : random(2) ? 'somewhat ' : 'a bit ' : '';
        await publish(`${name()} looks ${modifier}${reactions[reaction]}.`);
    }
    return { mask: M_ATTK_MISS, heroDied: !!state.program_state?.gameover };
}

// C mhitu.c:mswings_verb(). The mixed-strike roll occurs even when bashing.
export function mswings_verb(object: WeaponView, bash = false, random = rn2): 'bashes with' | 'lashes' | 'thrusts' | 'swings' {
    const direction = objectBaseDirection(object.otyp);
    const thrust = (direction & 1) && (!(direction & ~1) || random(2) === 0);
    const lash = objectSkill(object.otyp) === P_WHIP
        || (object.otyp === TOWEL && (object.spe ?? 0) > 0);
    return bash ? 'bashes with' : lash ? 'lashes' : thrust ? 'thrusts' : 'swings';
}

// Protection against special attacks. C mhitu.c:magic_negation().
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_ALIGNED_CLERIC = MONSTER_NAME.indexOf('aligned cleric');
// Also C artifact.c:protects(): inlined here (see the loop below).
export function magic_negation(defender: Hero | Monster, state: GameState = game) {
    const hero = defender === state.u;
    const species = 'mnum' in defender ? defender.mnum : defender.umonnum ?? -1;
    const inventory = 'mnum' in defender ? defender.minvent : state.inventory;
    let cancellation = 0;
    let guardingAmulet = false;
    let protection = hero ? hasInvokedProperty('protection', state)
        : species === PM_HIGH_CLERIC;

    for (const object of inventory || []) {
        if ((object.owornmask ?? 0) & W_ARMOR) {
            cancellation = Math.max(cancellation, a_can(object.otyp));
        } else if ((object.owornmask ?? 0) & W_AMUL) {
            guardingAmulet = object.otyp === AMULET_OF_GUARDING;
        }
        if (!protection) {
            const weapon = object.oclass === WEAPON_CLASS
                || isWeaponTool(object);
            const worn = !!((object.owornmask ?? 0)
                & (W_ARMOR | W_ACCESSORY | (weapon ? W_WEP : 0)));
            const artifact = artifactById(object.oartifact, state);
            // C artifact.c:protects(): a worn protection item, a carried
            // SPFX_PROTECT artifact, or a worn artifact with that spfx.
            protection = (worn && objectPropertyName(object.otyp) === 'protection')
                || !!artifact?.carriedFlags.includes('SPFX_PROTECT')
                || (worn && !!artifact?.flags.includes('SPFX_PROTECT'));
        }
    }
    if (protection) return Math.min(3, cancellation + (guardingAmulet ? 2 : 1));
    const innateProtection = species === PM_ALIGNED_CLERIC
        || is_minion(species)
        || (hero && ((hasIntrinsicProperty('protection', null, state) && (state.u.ublessed ?? 0) > 0)
            || (state.u.uspellprot ?? 0) > 0));
    return innateProtection ? Math.max(1, cancellation) : cancellation;
}


// C mhitu.c:mdamageu(). Unlike losehp(), this clamps current HP down to
// the existing maximum and does not stop running on zero-damage effects.
export async function mdamageu(monster: Monster, amount: number, {
    state = game, publish = plineWithContinuation, die = finishMonsterAttackDeath,
}: {
    state?: GameState;
    publish?: MessagePublisher;
    die?: typeof finishMonsterAttackDeath;
} = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (amount < 0) {
        await impossible(`mdamageu for negative damage? (${amount})`);
        amount = 0;
    }
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const hpKey = polymorphed ? 'mh' : 'uhp';
    const maximum = polymorphed ? 'mhmax' : 'uhpmax';
    state.context.botl = true;
    hero[hpKey] -= amount;
    if (state.flags.showdamage && amount)
        await publish(`[HP ${-amount}, ${hero[hpKey]} left]`);
    hero[hpKey] = Math.min(hero[hpKey], hero[maximum]);
    if (hero[hpKey] > 0) return false;
    if (polymorphed)
        return (await returnHeroToHumanForm(state, { publish })).died;
    return die(monster);
}

export function heroHasRemovableSpeed(state = game) {
    return propertyTimeout('fast', state) > 0
        || hasPermanentIntrinsicProperty('fast', state);
}

// C mhitu.c:u_slow_down().
export async function u_slow_down(state = game, publish: MessagePublisher = plineWithContinuation) {
    requireLiveGame(state);
    setPropertyTimeout('fast', 0, state);
    removeIntrinsicProperty('fast', state);
    await publish(state.u.fast || state.u.veryFast
        ? 'Your quickness feels less natural.' : 'You slow down.');
    await exerciseAttribute(A_DEX, false, state);
}
