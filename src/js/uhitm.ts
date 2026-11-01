// C-shaped owner of uhitm.c. Each attack effect's actor branches (hero
// attacking a monster, monster attacking the hero, monster versus monster)
// live in one module: the mhitm_ad_fire(), mhitm_ad_cold(), mhitm_ad_elec(),
// mhitm_ad_drli(), mhitm_ad_blnd(), mhitm_ad_ench(), mhitm_ad_stun() and
// mhitm_ad_legs() owners hold all three branches, while the remaining
// uhitm.c effects keep their per-branch owners here in C source order:
// mhitm_mgc_atk_negated(), mhitm_ad_rust()/corr()/dcay()/acid(),
// mhitm_ad_sedu()/sgld(), mhitm_ad_dren/deth/pest/famn/dise/curs(),
// mhitm_ad_tlpt()/poly()/slim(), mhitm_really_poison()/mhitm_ad_drst(),
// mhitm_ad_drin(), mhitm_ad_wrap(), the mhitm_adtyping() status branches
// (plys/slee/slow/conf/halu/stck/were), mhitm_ad_phys() (weapon contact,
// hugs, monster-versus-monster), mhitm_ad_heal(), mhitm_ad_dgst(),
// passive()/passive_obj(), and the hero-side dispatch that C reaches
// through mattacku() -> mhitm_adtyping(). Every message is awaited
// directly, so a --More-- suspends the attack at the same source boundary
// as C and no per-attack progress flags survive the call.
//
// C uhitm.c:mhitm_knockback() and m_is_steadfast(): a physical blow can
// throw a much smaller opponent backward. The shared owner tests the
// knockback destination through dothrow.c:will_hurtle(), words the
// message, then hurtles the defender.

import { armorSimpleName, heroHasDrainResistance, heroHasFreeAction } from './armor.js';
import { artifactById, monsterHasArtifactDefense } from './artifacts.js';
import { applyArtifactHit } from './artifacts.js';
import {
    adjustAttribute, attributeChangeMessage, changeHeroLuck, currentAttribute, exerciseAttribute,
} from './attrib.js';
import { heroCanBeBlindedByContact, monsterResistsBlindingLight } from './blinding_attack.js';
import { heroLegName } from './body_parts.js';
import {
    A_CON, A_DEX, A_INT, A_STR, A_WIS, DISMOUNT_KNOCKED, DISMOUNT_POLY, DOOR, DROWNING, FAINTED, G_NOCORPSE,
    Is_airlevel, Is_waterlevel, isok, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS,
    M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_SLEEP, MGIVENNAME, MM_IGNORELAVA,
    MM_IGNOREWATER, MSLOW, NON_PM, POOL, RLOC_MSG, RLOC_NOMSG, STRAT_WAITFORU, STONING, Upolyd, WATER, W_AMUL,
    W_ARMH, W_SADDLE,
} from './const.js';
import { heroHasInvoluntaryDelay } from './cmd.js';
import { nomul } from './hack.js';
import {
    canSeeMonster, canSenseMonster, canSpotMonster, displayLiquidName, map_invisible, shieldeff,
} from './display.js';
import { selectHeroDisenchantmentTarget } from './do_wear.js';
import { finishHeroDeath, finishMonsterAttackDeath } from './end.js';
import { loseHeroExperience } from './exper.js';
import { eatHeroBrain, eatMonsterBrain } from './eat.js';
import { game, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { woundHeroLegs } from './hero_legs.js';
import { makeConfused, makeStunned } from './hero_mental_status.js';
import { heroFormSticks, heroHatesSilver, heroSpecies } from './hero_species.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { heroIsUnconscious, putHeroToSleep } from './hero_sleep.js';
import { heroHasRemovableSpeed, slowHero } from './hero_speed.js';
import { retouchEquipment } from './hero_retouch.js';
import { damageHeroFromMonster } from './hero_damage.js';
import { igniteItems } from './light.js';
import {
    applyMonsterGolemEffects, changeMonsterForm, finishMonsterKilled, grantMonsterCorpseIntrinsic,
    grantMonsterIntrinsic, healMonster, paralyzeMonster, removeMonsterFromGame, resolveMonsterCorpseChance,
    finishMonsterPetrification, monsterSubject, turnGolemToStone,
} from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';

import type {
    MonsterDeathHandler, MonsterDefenderPetrificationResult, PetrificationDeathHandler, PetrificationOptions,
} from './mon.js';
import { monsterSelfTouch, erodeArmor, erodeAttackingWeapon, erodeObject, damageObjectWithAcid, type ErosionKind } from './trap.js';
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './worn.js';
import { splitMonster } from './potion.js';
import { showMonsterArtifactFallbackHit, drainMonsterEnergy } from './mhitm.js';
import { linkObjectToMonsterInventory, unlinkMonsterObject, mksobj, set_corpsenm, deallocateObject } from './mkobj.js';
import { destroyObjectFromMonsterInventory, removeObjectFromMonsterInventory } from './monworn.js';
import { makeMonsterFlee, setMonsterApparentHeroPosition } from './monmove.js';
import {
    AD_ACID, AD_CONF, AD_COLD, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DISE, AD_DRCO, AD_DRDX, AD_DRIN, AD_DREN,
    AD_DRLI, AD_DRST, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PHYS, AD_PEST,
    AD_PLYS, AD_POLY, AD_RBRE, AD_RUST, AD_SAMU, AD_SEDU, AD_SGLD, AD_SLEE, AD_SLIM, AD_SLOW, AD_SSEX,
    AD_STCK, AD_STON,
    AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE,
    AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE,
    MONSTER_SYMBOL, monsterHasHead, monsterIsAnimal, monsterIsNonliving, monsterIsRider, monsterIsShade,
    monsterIsSlimeproof, monsterIsSlithy, monsterIsThickSkinned, monsterIsUndead, monsterTypeName,
    requireMonsterData,
} from './monster_data.js';
import {
    monsterCombatDefense, monsterFireDescription, monstersForgetHeroResistance, monstersObserveHeroResistance,
    monsterHasAcidResistance, monsterHasColdResistance, monsterHasDrainResistance, monsterHasFireResistance,
    monsterHasPoisonResistance, monsterHasShockResistance, monsterHasStoneResistance, monsterPossessive,
} from './mondata.js';
import { monsterName, monsterName as displayedMonsterName, namelessMonsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { monsterHasLineOfSightToHero, cansee } from './vision.js';
import { recordRandom } from './monster_action_types.js';
import { monsterIsHelpless, monsterResistsSleep } from './mondata.js';
import { putMonsterToSleep } from './mhitm.js';
import { tryMonsterUnslime, useMonsterStoningCure } from './muse.js';
import type { MonsterStoningCureOptions } from './muse.js';
import { stealHeroQuestObject, stealHeroGold, stealFromHero } from './steal.js';
import { sessionIsNight } from './ambient_sounds.js';
import {
    infectHeroWithMonsterDisease, heroSlipsFree, heroSlipsFromWrapping, magicNegation, poisonAttackNoun,
    resolveHeroSeduction,
} from './mhitu.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { monsterWieldedWeapon, updateMonsterWeaponAfterPolymorph } from './weapon.js';
import { hurtleMonster, staggerVerb, willMonsterHurtle } from './dothrow.js';
import type { HurtleDeathHandler, HurtleLiquidDeathHandler } from './dothrow.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { petFoodNutrition } from './pet_eating.js';
import {
    AMULET_OF_LIFE_SAVING, CORPSE, DUNCE_CAP, IRON_SHOES, LOADSTONE, OBJECT_DESCRIPTIONS, OBJECT_NAMES,
} from './object_data.js';
import { cloneHeroMonsterForm } from './mklev.js';
import { objectMaterial } from './o_init.js';
import { observeObjectForNaming, objectCombatName, ownedObjectAction } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { hasWornProperty, propertyIsActive } from './properties.js';
import {
    applyHeroGolemEffects, heroHasProtectionFromShapeChangers, heroIsUnchanging, heroMonsterForm, polymonHero,
    polymorphHero, returnHeroToHumanForm,
} from './polyself.js';
import { heroReflectionSource, heroReflectsRay } from './ray.js';
import { poisonHero } from './poison.js';
import { drainHeroWeaponSkills } from './skills.js';
import { loseHeroSpellMemory } from './spell.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { burnAwayHeroSlime } from './slime.js';
import { contactIsProtected, formCanBecomeStoneGolem, touchPetrifies } from './stoning.js';
import { setHeroGrip } from './hero_grip.js';
import { attrcurse } from './throne.js';
import { spendHeroNutrition } from './hunger.js';
import { stopHeroOccupation } from './occupation.js';
import { destroyColdInventory, destroyElectricInventory, destroyFireInventory, destroyMonsterInventoryByElement, monsterResistsEffect, drainObjectEnchantment } from './zap.js';
import {
    applyHeroWereChange, revertHeroWereForm, setHeroLycanthropy, isHumanWereMonster, isWereMonster, wereChange,
} from './were.js';
import { touchHeroWithDeath } from './mcastu.js';
import { rollPhysicalWeaponDamage } from './weapon.js';
import { isBluntWeapon, isFlimsyObject, isPermanentlyPoisonedObject, isWeaponTool } from './object_properties.js';
import { d, rn2, rnd } from './rng.js';
import { dismountHero } from './steed.js';
import { doorlessDoor } from './hack.js';
import { plineWithContinuation } from './pline.js';
import { requireInitializedHero } from './hero_types.js';
import { canKnockHeroToward, hurtleHero } from './hero_hurtle.js';
import { askTeleportDestination, heroControlsTeleport, teleportHero, randomMonsterRelocation } from './teleport.js';
import { goodPosition, reportMonsterTeleportRestriction } from './teleport_rules.js';
import { isPoolAt, levelIsWaterLevel } from './terrain_properties.js';
import { verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { objectCanTouchShade } from './hero_object_contact.js';
import { capitalizedDefiniteName } from './ray_hit_message.js';
import type { DeathHandler } from './end.js';
import type { MessagePublisher } from './pline.js';
import type { GameState, PlayingGameState, MonsterHelplessnessReason } from './game_state.js';
import type { AttackMethod, DamageType } from './monster_attack_types.js';
import type { HeroNaturalEffectContext } from './hero_natural_types.js';
import type { MonsterCallLog, HeroContactAttack, AttackTuple, MonsterMeleeAttack } from './monster_action_types.js';
import type { MonsterCombatEffectContext, MonsterCombatEffectResult } from './monster_combat_effect_types.js';
import type { Monster } from './monster_types.js';
import type { rnd as RndType } from './rng.js';
import type { Hero } from './hero_types.js';
import type { GameObject } from './object_types.js';
import type { MonsterAttack } from './data_types.js';
import type { HeroPoisonOptions } from './poison.js';
import { artifactDamageBonus, artifactEmitsLight, artifactStrikesShade } from './artifacts.js';
import { P_AXE, W_ARMG, WT_IRON_BALL_INCR } from './const.js';
import {
    CREAM_PIE,
    GAUNTLETS_OF_POWER,
    HEAVY_IRON_BALL,
    OBJECT_LARGE_DAMAGE,
    OBJECT_SMALL_DAMAGE,
    OBJECT_SUBTYPE,
    OBJECT_WEIGHT,
} from './object_data.js';
import {
    monsterHatesBlessings,
    monsterHatesLight,
    monsterHatesSilver,
    monsterIsWooden,
    monsterSpeciesHatesSilver,
} from './monster_data.js';
import { objectClassForType } from './object_knowledge.js';
import type { ArtifactDefender } from './artifacts.js';

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

// C uhitm.c:mhitm_ad_fire().
export async function mhitmAdFire(call: MhitmAdFireCall): Promise<MhitmAdFireResult> {
    if ('magr' in call) {
        const mdef = call.defender;
        const { state, publish, attack, random, rollOne } = call.context;
        // mhitm_mgc_atk_negated(magr, mdef, TRUE): the hero cannot be
        // cancelled, so the rn2(10) probe always runs.
        if (specialAttackNegated(state.u, mdef, { state, random })) {
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
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
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
        if (await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random }))
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
        if (specialAttackNegated(state.u, mdef, { state, random })) {
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
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
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
        if (await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random }))
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
        if (specialAttackNegated(state.u, mdef, { state, random })) {
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
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
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
        if (await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random }))
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
const M1_FLY = 0x00000001;
const M1_NOEYES = 0x00001000;
const PM_RAVEN = MONSTER_NAME.indexOf('raven');
const LOW_BOOTS = 163;

// C uhitm.c:mhitm_ad_phys(), uhitm branch: shade contact, the special
// damage bonus and the hand-to-hand accuracy rings. The hero attacker
// cannot be cancelled, and this branch never sets mhm->done, so callers
// inline the follow-up `if (mhm->done) return;` only in the other branches.
export function physicalDamage(
    monster: Monster, { state, damage, attack, specialDamage }: HeroNaturalEffectContext,
): number {
    if (monsterIsShade(monster)) damage = 0;
    damage += specialDamage;
    if (attack[0] === AT_WEAP) return 0;
    if ([AT_KICK, AT_CLAW, AT_TUCH, AT_HUGS].includes(attack[0])) {
        if (monsterIsThickSkinned(monster))
            damage = attack[0] === AT_KICK ? 0 : Math.trunc((damage + 1) / 2);
        const bonus = state.u.udaminc ?? 0;
        if (bonus > 0) damage += bonus;
        else if (damage > 0) damage = Math.max(1, damage + bonus);
    }
    return damage;
}

// C mondata.c:can_blnd() for the hero's own contact attack; the monster
// defender twin lives with mhitm_ad_blnd's monster-versus-monster branch.
function naturalAttackCanBlind(
    monster: Monster, { state, attack }: HeroNaturalEffectContext,
): boolean {
    if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES || !monster.mcansee && !monster.mblinded)
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
        && (state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
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
        if (specialAttackNegated(state.u, mdef, { state, random })) {
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
            const negated = specialAttackNegated(attacker, state.u, {
                state, random: limit => recordRandom(random, calls, limit),
            });
            if (negated && !attacker.mcan) await publish('You avoid harm.');
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
                && !await monsterCombatAttackNegated(attacker, defender, {
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
            || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
        // hitmsg(magr, mattk)
        if (hitMessage) await publish(hitMessage);
        // uncancelled is sufficient enough; please
        // don't make this attack less frequent
        if (!negated) {
            const target = selectHeroDisenchantmentTarget(state, random, calls);
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
        return statusContinueResult(physicalDamage(mdef, call.context));
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
        return statusContinueResult(physicalDamage(call.defender, call.context));
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
        const attackerFlies = !!((MONSTER_FLAGS1[attacker.mnum] ?? 0) & M1_FLY);
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

// C uhitm.c:mhitm_ad_sedu() mhitu branch's flight tail (uhitm.c:4675-4688):
// rloc() away from the scene, the animal's run-away line, monflee() and
// the mhm.done / M_ATTK_AGR_DONE that ends hitmu()'s slot.
async function retreatAfterTheft(
    monster: Monster,
    attack: HeroContactAttack,
    animal: boolean,
    stolenName: string | undefined,
    calls: MonsterCallLog,
): Promise<void> {
    const game = requireInitializedGame();
    if (animal) {
        if (stolenName && canSeeMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { state: game,
                capitalized: true })} tries to run away with ${stolenName}.`);
    } else if (!await reportMonsterTeleportRestriction(monster, { state: game })) {
        const relocation = await randomMonsterRelocation(monster, {
            calls, flags: RLOC_MSG,
        });
        if (relocation && 'died' in relocation && relocation.died) return;
    }
    const flight = await makeMonsterFlee(monster, { announce: false });
    if (flight.heroDied) return;
    attack.attackerDone = true;
    attack.contactDone = true;
    attack.nativeResult = M_ATTK_AGR_DONE;
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

// One call of mhitm_adtyping(… AD_SITM / AD_SEDU …), hero defender.
export interface MhitmAdSeduCall {
    mdef: 'youmonst';
    context: HeroDefenderSeduContext;
}

export interface MhitmAdSeduResult {
    /** True when this branch's plines may own the sequence pager. */
    pagerOwned: boolean;
}

// C uhitm.c:mhitm_ad_sedu(), mhitu branch (uhitm.c:4631-4690).
export async function mhitmAdSedu(call: MhitmAdSeduCall): Promise<MhitmAdSeduResult> {
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
        if (attacker.mcan) return { pagerOwned: false };
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
        return { pagerOwned: true };
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
        return { pagerOwned: false };
    }
    const theft = await stealFromHero(attacker, random, calls);
    switch (theft.outcome) {
        // C uhitm.c:4672-4674: steal() returned -1 — the thief touched a
        // petrifying corpse; hitmu() reports the aggressor's death.
        case 'petrified':
            attack.nativeResult = M_ATTK_AGR_DIED;
            attack.contactDone = true;
            return { pagerOwned: true };
        // C uhitm.c:4675-4688: steal() returned 1 — leave the scene.
        case 'nothing-to-steal':
            await retreatAfterTheft(attacker, attack, animal, undefined, calls);
            return { pagerOwned: true };
        case 'refused':
            if (theft.fled) await retreatAfterTheft(attacker, attack, animal, undefined, calls);
            return { pagerOwned: false };
        case 'stole':
            // C steal.c:611-612: an involuntary delay keeps the thief in
            // place; steal() returned 0 and mhitm_ad_sedu() returns quietly.
            if (heroHasInvoluntaryDelay(state)) return { pagerOwned: true };
            await retreatAfterTheft(attacker, attack, animal, theft.stolenName ?? undefined, calls);
            return { pagerOwned: true };
        // C uhitm.c:4670-4671: the remaining outcomes are steal() == 0
        // without a flight tail; hitmu() simply continues. 'vanished'
        // keeps the pager claim the old resolver made: its removal prose
        // and the gameover guard both returned true there.
        case 'hero-died':
        case 'vanished':
            return { pagerOwned: true };
        case 'too-far':
        case 'busy':
        case 'gone':
        case 'armor-removal':
            return { pagerOwned: false };
    }
}

const M1_UNSOLID = 0x00100000;
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

function isHeroActor(actor: PhysicalActor, state: GameState): actor is Hero {
    return actor === state.u;
}

function species(actor: PhysicalActor, state: GameState): number {
    if (!isHeroActor(actor, state)) return actor.mnum;
    requireInitializedHero(actor);
    return actor.umonnum;
}

function inventory(actor: PhysicalActor, state: GameState): GameObject[] {
    return isHeroActor(actor, state) ? state.inventory : actor.minvent ?? [];
}

function wieldedWeapon(actor: PhysicalActor, state: GameState): GameObject | null | undefined {
    return isHeroActor(actor, state) ? state.uwep : monsterWieldedWeapon(actor);
}

export function isSteadfast(actor: PhysicalActor, state: GameState): boolean {
    requirePlayingGame(state);
    const mnum = species(actor, state);
    const floating = isHeroActor(actor, state)
        ? actor.levitating || actor.levitation || actor.flying
        : ((MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY)
            || [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[mnum] ?? -1);
    if (floating || Is_airlevel(state.u.uz)
        || (Is_waterlevel(state.u.uz)
            && !isPoolAt(state.u.ux, state.u.uy, state))) return false;
    if (artifactById(wieldedWeapon(actor, state)?.oartifact)?.name === 'Giantslayer')
        return true;
    return inventory(actor, state).some(object => object.otyp === LOADSTONE)
        || (actor === state.u.usteed
            && state.inventory.some(object => object.otyp === LOADSTONE));
}

// C uhitm.c:mhitm_knockback().
export async function tryKnockback(attacker: PhysicalActor, defender: PhysicalActor, attack: KnockbackAttack, {
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
        if (!canKnockHeroToward(dx, dy)) return { knocked: false };
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
    if (((MONSTER_FLAGS1[attackerForm] ?? 0) & M1_UNSOLID)
        || ((heroAttacks || movingHero) && !hit)) return { knocked: false };

    if (isSteadfast(target ?? state.u, state)) {
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

// C uhitm.c:mhitm_mgc_atk_negated(), for monster-vs-monster effects.
export async function monsterCombatAttackNegated(
    attacker: Monster, defender: Monster, {
        state = game, visible, verbose = true, publish = plineWithContinuation, random = rn2,
    }: { state?: GameState; visible: boolean; verbose?: boolean; publish?: MessagePublisher; random?: typeof rn2 },
): Promise<boolean> {
    const negated = specialAttackNegated(attacker, defender, { state, random });
    if (negated && !attacker.mcan && verbose && visible && canSeeMonster(defender))
        await publish(`${monsterName(defender, { state, capitalized: true })} avoids harm.`);
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
const COIN_CLASS = 12;
const S_NYMPH = 14;

export async function applyMonsterTheftEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    return context.attack[1] === AD_SGLD
        ? stealGold(attacker, defender, context) : stealItem(attacker, defender, context);
}

async function stealGold(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const result = theftResult(0);
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

async function stealItem(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (attacker.mcan) return theftResult(context.damage);
    const object = (defender.minvent || defender.inventory || [])
        .find(candidate => !attacker.mtame || !candidate.cursed);
    if (!object) return theftResult(0);
    const { state, publish, visible, random, finishDeath } = context;
    const nymph = MONSTER_SYMBOL[attacker.mnum] === S_NYMPH;
    const victimName = monsterName(defender, { state, suppressSaddle: false });
    if (state.u.usteed === defender && ((object.owornmask ?? 0) & W_SADDLE)) {
        const dismount = await dismountHero(DISMOUNT_POLY, { state, random, announce: publish });
        if (dismount.died) return { ...theftResult(0), done: true, heroDied: true };
    }
    await removeObjectFromMonsterInventory(defender, object, state, { publish });
    if (state.program_state.gameover) return { ...theftResult(0), done: true, heroDied: true };
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
    if (touch.heroDied) return { ...theftResult(0), done: true, heroDied: true };
    if (defender.mhp <= 0) {
        const growth = await context.growAttacker(defender);
        return {
            damage: context.damage,
            nativeResult: M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED),
            done: true, heroDied: growth.heroDied,
        };
    }
    return nymph ? escapeAfterTheft(attacker, thiefName, context) : theftResult(0);
}

async function escapeAfterTheft(
    attacker: Monster, before: string, { state, publish, visible, random, rollOne }: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (await reportMonsterTeleportRestriction(attacker, { state, publish })) return theftResult(0);
    const spotted = canSpotMonster(attacker);
    const relocation = await randomMonsterRelocation(attacker, { state, random, rollOne, flags: RLOC_NOMSG });
    if (state.program_state.gameover || relocation?.died)
        return { ...theftResult(0), nativeResult: M_ATTK_AGR_DONE, done: true, heroDied: true };
    if (visible && spotted && !canSpotMonster(attacker))
        await publish(`${before} suddenly disappears!`);
    return { ...theftResult(0), nativeResult: M_ATTK_AGR_DONE };
}

function theftResult(damage: number): MonsterCombatEffectResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}

// C uhitm.c:mhitm_ad_dren/deth/pest/famn/dise/curs(), monster defenders;
// mhitm_ad_drli() lives above with its other actor branches and
// receives mhitm_ad_deth()'s redirected call, as in C.
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_METALLIVORE = 0x80000000;
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
        if (!((MONSTER_FLAGS1[defender.mnum] ?? 0)
            & (M1_CARNIVORE | M1_HERBIVORE | M1_METALLIVORE))) result.damage = 0;
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
    if (await monsterCombatAttackNegated(attacker, defender, {
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
const M1_TPORT = 0x02000000;
const M2_SHAPESHIFTER = 0x00004000;
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');

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
    if (await monsterCombatAttackNegated(attacker, defender, { state, publish, visible, random })) {
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
    const negated = await monsterCombatAttackNegated(attacker, defender, {
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
        && (defender.mcan || ((MONSTER_FLAGS2[defender.mnum] ?? 0) & M2_SHAPESHIFTER))) {
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
            if (((MONSTER_FLAGS1[attacker.mnum] ?? 0) & M1_TPORT)
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
    if (await monsterCombatAttackNegated(attacker, defender, {
        state, visible, publish, random, verbose: false,
    }) || random(4) !== 0 || monsterIsSlimeproof(defender)) return result;
    const cure = await tryMonsterUnslime(defender, { state, byHero: false, publish, random, rollDice, rollOne });
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
        reason: `${subject} ${poisonAttackNoun(monster, attackType)}`,
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
            poisonAttackNoun(attacker, attackType)} was poisoned!`);
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

// C uhitm.c:mhitm_ad_drin() and eat.c:eat_brains(), hero defender.
export async function drainHeroBrain(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random = rn2, rollOne = rnd,
): Promise<void> {
    const hero = state.u;
    const baseDamage = attack.damage;
    if (baseDamage === undefined) throw new Error('Brain drain requires rolled contact damage');
    if (!monsterHasHead({ mnum: heroSpecies(state) })) {
        await publish("You don't seem harmed.");
        attack.skipBrainDrain = true;
        return;
    }
    const helmet = state.uarmh ?? hero.uarmh;
    if (helmet?.greased && (!helmet.cursed || random(3))) {
        await publish(`${monsterName(monster, { state, capitalized: true })} grabs you, but cannot hold onto your greased ${objectCombatName(helmet, { state })}!`);
        if (!random(2)) {
            await publish('The grease wears off.');
            helmet.greased = false;
        }
        return;
    }
    if (helmet && random(8)) {
        await publish(`Your ${armorSimpleName(helmet, state)} blocks the attack to your head.`);
        return;
    }
    // Brain damage precedes the meal and bypasses negative AC. Blocked
    // tentacles instead leave their ordinary damage for hitmu's common tail.
    const damage = propertyIsActive('halfPhysicalDamage', state) || hero.halfPhysicalDamage
        ? Math.trunc((baseDamage + 1) / 2) : baseDamage;
    attack.damage = 0;
    if (await damageHeroFromMonster(monster, damage, { state, publish })) {
        attack.heroDied = true;
        return;
    }
    if (helmet?.otyp !== DUNCE_CAP) {
        const mortality = hero.umortality ?? 0;
        const eaten = await eatHeroBrain(monster, attack, state, publish, rollOne);
        if ((hero.umortality ?? 0) > mortality) attack.skipBrainDrain = true;
        if (!eaten || state.program_state.gameover) return;
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
}

// C uhitm.c:mhitm_ad_drin() and eat.c:eat_brains(), monster against monster.
export interface MonsterBrainAttackOptions {
    state?: GameState;
    visible: boolean;
    notOnHead?: boolean;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    publish?: MessagePublisher;
    finishDeath: MonsterDeathHandler;
}

export interface MonsterBrainAttackResult {
    damage: number;
    hitFlags: number;
    skipBrainDrain: boolean;
    heroDied: boolean;
}

// This phase never finishes the hit. Even a fatal meal leaves the pending
// tentacle damage for mdamagem(), which can kill the defender as well.
export async function resolveMonsterBrainAttack(
    attacker: Monster, defender: Monster, damage: number, {
        state = game, visible, notOnHead = false, random = rn2, rollOne = rnd,
        publish = plineWithContinuation, finishDeath,
    }: MonsterBrainAttackOptions,
): Promise<MonsterBrainAttackResult> {
    if (notOnHead || !monsterHasHead(defender)) {
        if (visible && canSpotMonster(defender)) {
            await publish(`${monsterName(defender, { state, capitalized: true })} doesn't seem harmed.`);
        }
        return { damage: 0, hitFlags: M_ATTK_MISS, skipBrainDrain: true, heroDied: false };
    }
    if (((defender.misc_worn_check ?? 0) & W_ARMH) && random(8)) {
        if (visible && canSpotMonster(attacker) && canSeeMonster(defender)) {
            const defenderName = possessiveName(monsterName(defender, { state, capitalized: true }));
            const attackerName = possessiveName(monsterName(attacker, { state }));
            const whoseHead = monsterPossessive(defender, { state, random });
            await publish(`${defenderName} helmet blocks ${attackerName} attack to ${whoseHead} head.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, skipBrainDrain: false, heroDied: false };
    }

    const amulet = wornAmulet(defender);
    const lifeSaving = amulet?.otyp === AMULET_OF_LIFE_SAVING;
    const result = await eatMonsterBrain(attacker, defender, damage, {
        state, visible, random, rollOne, publish, finishDeath,
    });
    return { ...result, skipBrainDrain: lifeSaving && !wornAmulet(defender) };
}

function wornAmulet(monster: Monster) {
    return (monster.minvent ?? monster.inventory ?? []).find(object => (object.owornmask ?? 0) & W_AMUL);
}

// C uhitm.c:mhitm_ad_wrap() against the hero, and mhitu.c:u_slip_free().
const S_NAGA = 40;
const S_SNAKE = 45;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;

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
        if (await heroSlipsFromWrapping(monster, attack, state, publish, random)) {
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
    const flags = MONSTER_FLAGS1[heroSpecies(state)] ?? 0;
    return !!(state.u.swimming || state.u.amphibious || state.u.breathless || state.u.magicalBreathing
        || (flags & (M1_AMPHIBIOUS | M1_BREATHLESS))
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
            && !await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random, verbose: true })) {
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
        const blocked = await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random, verbose: false });
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
        if (await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random, verbose: false })) damage = 0;
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
            && (state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
    case AT_TUCH: case AT_STNG:
        return !attacker.mcan;
    case AT_BITE: case AT_KICK: case AT_BUTT: case AT_HUGS: case AT_TENT:
        return true;
    }
}

function hasEyes(monster: Monster): boolean {
    return !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES);
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

// C uhitm.c:mhitm_ad_phys(), hero defender's weapon branch: silver contact
// and pudding division.
const IRON = 11, METAL = 12, SILVER = 14;
const PUDDINGS = new Set(['black pudding', 'brown pudding'].map(name => MONSTER_NAME.indexOf(name)));

export async function resolveMonsterWeaponContact(
    monster: Monster, weapon: GameObject, damage: number, state: PlayingGameState,
    publish: MessagePublisher, rollOne: typeof rnd,
): Promise<number> {
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
    if (state.u.mh - reducedDamage <= 1 || !PUDDINGS.has(state.u.umonnum)
        || ![IRON, METAL].includes(objectMaterial(weapon, state))) return damage;

    if (reducedDamage > 1) await exerciseAttribute(A_STR, false, state);
    state.u.mh -= reducedDamage;
    state.context.botl = true;
    if (await cloneHeroMonsterForm(state))
        await publish(`You divide as ${monsterName(monster, { state })} hits you!`);
    return 0;
}

// C uhitm.c:mhitm_ad_phys(), hero defender's hug branch.
const ROPE_GOLEM = MONSTER_NAME.indexOf('rope golem');

export async function resolvePhysicalHeroHug(
    monster: Monster, damage: number, state: PlayingGameState,
    random: (range: number) => number, publish: MessagePublisher,
): Promise<number> {
    const holder = state.u.ustuck;
    if (!holder && random(2)) {
        if (await heroSlipsFree(monster, state, random, publish)) return 0;
        setHeroGrip(monster, state);
        await publish(`${monsterName(monster, { state, capitalized: true })} grabs you!`);
    } else if (holder === monster) {
        await exerciseAttribute(A_STR, false, state);
        await publish(`You are being ${monster.mnum === ROPE_GOLEM ? 'choked' : 'crushed'}.`);
    }
    // A failed capture still deals the rolled hug damage. Another holder
    // prevents capture and crushing prose, but does not protect against it.
    return damage;
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

// Native uhitm.c:mhitm_ad_phys(), monster against monster.
export interface MonsterPhysicalDamage {
    damage: number;
    done: boolean;
    hitFlags: number;
    heroDied: boolean;
}

interface PhysicalDamageOptions {
    state?: GameState;
    visible: boolean;
    dieRoll: number;
    hitOnHead: boolean;
    finishDeath: PetrificationDeathHandler;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
}

const PM_PURPLE_WORM = MONSTER_NAME.indexOf('purple worm');
const PM_SHRIEKER = MONSTER_NAME.indexOf('shrieker');

export async function resolveMonsterPhysicalDamage(
    aggressor: Monster, defender: Monster, attack: Pick<MonsterMeleeAttack, 'attackType'>, damage: number,
    { state = game, visible, dieRoll, hitOnHead, finishDeath,
        publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d,
    }: PhysicalDamageOptions,
): Promise<MonsterPhysicalDamage> {
    // hitmm's contact weapon is null for a claw. This later physical-damage
    // phase deliberately rereads the held weapon, as mhitm_ad_phys does.
    const weapon = attack.attackType === AT_WEAP || attack.attackType === AT_CLAW
        ? monsterWieldedWeapon(aggressor) ?? null : null;
    if (await rejectMonsterShadeContact(aggressor, defender, weapon, {
        state, visible: canSeeMonster(aggressor) && canSeeMonster(defender),
        publish, rollOne, rollDice,
    })) return { damage: 0, done: false, hitFlags: M_ATTK_MISS, heroDied: false };
    if (attack.attackType === AT_KICK && monsterIsThickSkinned(defender))
        return { damage: 0, done: false, hitFlags: M_ATTK_MISS, heroDied: false };

    if (!weapon) {
        if (aggressor.mnum === PM_PURPLE_WORM && defender.mnum === PM_SHRIEKER
            && damage >= defender.mhp && defender.mhp > 1) damage = defender.mhp - 1;
        return { damage, done: false, hitFlags: M_ATTK_MISS, heroDied: false };
    }

    if (weapon.otyp === CORPSE && touchPetrifies(weapon.corpsenm)) {
        const stone = await petrifyMonsterDefender(defender, {
            state, visible: visible && canSeeMonster(defender), publish, rollOne, finishDeath,
        });
        if (stone.heroDied)
            return { damage: 0, done: true, hitFlags: M_ATTK_MISS, heroDied: true };
        if (stone.stopped) {
            if (!stone.survived && defender.mtame && !visible)
                await publish('You have a peculiarly sad feeling for a moment, then it passes.');
            return { damage: 0, done: true,
                hitFlags: stone.survived ? M_ATTK_MISS : M_ATTK_DEF_DIED, heroDied: false };
        }
        damage = stone.damage;
    }
    damage += rollPhysicalWeaponDamage(weapon, defender, { state, rollOne, rollDice });
    damage = Math.max(1, damage + monsterWeaponStrengthBonus(aggressor, random));
    let hitFlags = M_ATTK_MISS;
    if (weapon.oartifact) {
        const artifact = await applyArtifactHit(weapon, defender, damage, {
            attacker: aggressor, state,
            publish, random, rollOne, dieRoll, hitOnHead,
        });
        if (artifact.heroDied)
            return { damage: 0, done: true, hitFlags, heroDied: true };
        damage = artifact.damage;
        if (!artifact.specialMessage) {
            await showMonsterArtifactFallbackHit(aggressor, defender, { state, visible, publish });
            hitFlags |= M_ATTK_HIT;
        }
        if (defender.dead || defender.mhp <= 0)
            return { damage, done: true, hitFlags: M_ATTK_DEF_DIED, heroDied: false };
    }
    if (damage) await erodeAttackingWeapon(defender, weapon, { state, random, publish });
    if ((weapon.opoisoned || isPermanentlyPoisonedObject(weapon)) && random(4) === 0) {
        damage = await poisonMonsterFromAttack(aggressor, defender, attack.attackType, damage, {
            state, visible, random, publish,
        });
    }
    return { damage, done: false, hitFlags, heroDied: false };
}

// C uhitm.c:mhitm_ad_heal(), against the hero.
export function nurseContactMode(monster: Monster, state: PlayingGameState): 'hit' | 'heal' | 'cooperate' {
    if (monster.mcan || (Upolyd(state.u) && touchPetrifies(heroSpecies(state)))) return 'hit';
    const weapon = state.uwep || state.u.uwep;
    const armed = weapon && (weapon.oclass === 2 || isWeaponTool(weapon));
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
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');

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
            const source = heroReflectionSource(state);
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
    if (!die) return damageHeroFromMonster(monster, amount, { state, publish });
    return damageHeroFromMonster(monster, amount, {
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
        if (carried && (object.known || object.oclass === 3)) {
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
        await drainHeroBrain(monster, attack, state, publish, random, rollOne);
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
            await slowHero(state, publish);
    }
    else if (attack.damageType === AD_SGLD)
        await stealHeroGold(monster, state, publish, random, rollOne);
    else if (attack.damageType === AD_SSEX)
        await resolveHeroSeduction(monster, attack, state, publish, random, rollOne);
    else if (attack.damageType === AD_DISE) {
        if (!await infectHeroWithMonsterDisease(monster, state, publish, random)) attack.damage = 0;
    }
    else if (attack.damageType === AD_PEST)
        await infectHeroWithMonsterDisease(monster, state, publish, random);
    else if (attack.damageType === AD_DETH)
        await resolveDeathTouchContact(monster, attack, state, publish, random, rollDice);
    else if (attack.damageType === AD_SAMU) {
        if (random(20) === 0) await stealHeroQuestObject(monster, state, publish, random, rollOne);
    }
    else if (attack.damageType === AD_FAMN) {
        await exerciseAttribute(A_CON, false, state);
        if (state.u.uhs !== FAINTED) await spendHeroNutrition(random(40) + 40, { state });
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
    if (await magicPreventsContact(monster, state, publish, random)) return;
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
    if (specialAttackNegated(monster, state.u, { state, random })) {
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

async function magicPreventsContact(
    monster: Monster, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<boolean> {
    const negated = specialAttackNegated(monster, state.u, { state, random });
    if (negated && !monster.mcan) await publish('You avoid harm.');
    return negated;
}

async function infectHero(
    monster: Monster, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<void> {
    if (random(4) !== 0 || state.u.ulycn !== -1
        || heroHasProtectionFromShapeChangers(state)) return;
    const weapon = state.uwep || state.u.uwep;
    if (artifactById(weapon?.oartifact, state)?.defense === 'lycanthropy') return;
    if (await magicPreventsContact(monster, state, publish, random)) return;
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
    if (await magicPreventsContact(monster, state, publish, random)) return;
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

// C uhitm.c:do_stone_mon(). A cure or life saving ends this hit.
export async function petrifyMonsterDefender(monster: Monster, {
    publish = plineWithContinuation,
    visible = canSeeMonster(monster),
    ...options
}: MonsterStoningCureOptions & PetrificationOptions & { visible?: boolean } = {}): Promise<MonsterDefenderPetrificationResult> {
    const cure = await useMonsterStoningCure(monster, { ...options, publish });
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

// C uhitm.c:mhitm_ad_phys(). Carrying these gloves is not enough.
export function monsterWeaponStrengthBonus(monster: Pick<Monster, 'minvent'>, random = rn2): number {
    const gloves = (monster.minvent || []).find(object => (object.owornmask ?? 0) & W_ARMG);
    return gloves?.otyp === GAUNTLETS_OF_POWER ? 3 + random(4) : 0;
}

// C uhitm.c:mhitm_mgc_atk_negated(): a cancelled attacker never lands its
// special attack; otherwise magic_negation() on the defender decides.
export function specialAttackNegated(attacker: Hero | Monster, defender: Hero | Monster, {
    state = game, random = rn2,
}: { state?: GameState; random?: typeof rn2 } = {}) {
    if (attacker !== state.u && attacker.mcan) return true;
    return random(10) < 3 * magicNegation(defender, state);
}
