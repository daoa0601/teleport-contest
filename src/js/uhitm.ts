// C uhitm.c:mhitm_ad_fire(), mhitm_ad_cold() and mhitm_ad_elec(): each
// attack's three actor branches (hero attacking a monster, monster
// attacking the hero, monster versus monster) share a single owner, in
// native order. Every message is awaited directly, so a --More--
// suspends the attack at the same source boundary as C and no
// elemental progress flags survive the call.

import { M_ATTK_MISS, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, Upolyd } from './const.js';
import { canSeeMonster, shieldeff } from './display.js';
import { heroSpecies } from './hero_species.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { igniteItems } from './light.js';
import { applyMonsterGolemEffects } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { magicNegation, specialAttackNegated } from './magic_negation.js';
import { AD_COLD, AD_ELEC, AD_FIRE } from './monster_attack_types.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import { monsterCombatDefense } from './monster_combat_defense.js';
import { MONSTER_LEVEL, MONSTER_NAME } from './monster_data.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { monsterName } from './monster_name.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
} from './monster_perception.js';
import {
    monsterHasColdResistance, monsterHasFireResistance, monsterHasShockResistance,
} from './monster_resistance.js';
import { recordRandom } from './monster_action_types.js';
import { returnHeroToHumanForm } from './polyself.js';
import { heroIsBlind } from './senses.js';
import { burnAwayHeroSlime } from './slime.js';
import {
    destroyColdInventory, destroyElectricInventory, destroyFireInventory,
    destroyMonsterInventoryByElement,
} from './zap.js';
import type { DeathHandler } from './end.js';
import type { MessagePublisher } from './pline.js';
import type { PlayingGameState } from './game_state.js';
import type { AttackMethod } from './monster_attack_types.js';
import type { HeroNaturalEffectContext } from './hero_natural_types.js';
import type { MonsterCallLog } from './monster_action_types.js';
import type { MonsterCombatEffectContext } from './monster_combat_effect_types.js';
import type { Monster } from './monster_types.js';
import type { d, rn2, rnd } from './rng.js';

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
