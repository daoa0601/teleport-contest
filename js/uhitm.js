// C uhitm.c:mhitm_ad_fire(), mhitm_ad_cold(), mhitm_ad_elec(),
// mhitm_ad_drli(), mhitm_ad_blnd(), mhitm_ad_ench(), mhitm_ad_stun() and
// mhitm_ad_legs(): each attack's three actor branches (hero attacking a
// monster, monster attacking the hero, monster versus monster) share a
// single owner, in native order. Every message is awaited directly, so a
// --More-- suspends the attack at the same source boundary as C and no
// per-attack progress flags survive the call.
//
// C uhitm.c:mhitm_knockback() and m_is_steadfast(): a physical blow can
// throw a much smaller opponent backward. The shared owner tests the
// knockback destination through dothrow.c:will_hurtle(), words the
// message, then hurtles the defender.
import { heroHasDrainResistance } from './armor.js';
import { artifactById, monsterHasArtifactDefense } from './artifacts.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroCanBeBlindedByContact, monsterResistsBlindingLight } from './blinding_attack.js';
import { heroLegName } from './body_parts.js';
import { A_DEX, A_STR, DISMOUNT_KNOCKED, DOOR, Is_airlevel, Is_waterlevel, isok, M_ATTK_MISS, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, MGIVENNAME, MM_IGNORELAVA, MM_IGNOREWATER, Upolyd, W_ARMH, W_SADDLE, } from './const.js';
import { canSeeMonster, canSpotMonster, shieldeff } from './display.js';
import { selectHeroDisenchantmentTarget } from './do_wear.js';
import { loseHeroExperience } from './exper.js';
import { woundHeroLegs } from './hero_legs.js';
import { makeStunned } from './hero_mental_status.js';
import { heroSpecies } from './hero_species.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { igniteItems } from './light.js';
import { applyMonsterGolemEffects } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { magicNegation, specialAttackNegated } from './magic_negation.js';
import { AD_COLD, AD_DETH, AD_DRLI, AD_ELEC, AD_ENCH, AD_FIRE, AD_LEGS, AD_PHYS, AD_STCK, AD_STUN, AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import { monsterCombatDefense } from './monster_combat_defense.js';
import { applyMonsterCombatBlindness } from './monster_combat_status.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsNonliving, monsterIsShade, monsterIsThickSkinned, } from './monster_data.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { monsterName } from './monster_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, setMonsterApparentHeroPosition, } from './monster_perception.js';
import { monsterHasColdResistance, monsterHasDrainResistance, monsterHasFireResistance, monsterHasShockResistance, } from './monster_resistance.js';
import { recordRandom } from './monster_action_types.js';
import { hurtleMonster, staggerVerb, willMonsterHurtle } from './monster_hurtle.js';
import { IRON_SHOES, LOADSTONE, OBJECT_DESCRIPTIONS } from './object_data.js';
import { ownedObjectAction } from './objnam.js';
import { drainObjectEnchantment } from './object_state.js';
import { returnHeroToHumanForm } from './polyself.js';
import { heroIsBlind } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { burnAwayHeroSlime } from './slime.js';
import { destroyColdInventory, destroyElectricInventory, destroyFireInventory, destroyMonsterInventoryByElement, } from './zap.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { formatFeltMessage } from './hero_speech.js';
import { doorlessDoor } from './hack.js';
import { plineWithContinuation } from './pline.js';
import { game, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { canKnockHeroToward, hurtleHero } from './hero_hurtle.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { isBluntWeapon, isFlimsyObject } from './object_properties.js';
import { rn2 } from './rng.js';
import { dismountHero } from './steed.js';
import { goodPosition } from './teleport_rules.js';
import { isPoolAt } from './terrain_properties.js';
// C obj.h/permonst: completelyburns() — bodies that fire destroys outright.
function completelyBurns(monster) {
    const species = MONSTER_NAME[monster.mnum];
    return species === 'paper golem' || species === 'straw golem';
}
function continueResult(damage) {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}
// C uhitm.c:mhitm_ad_fire().
export async function mhitmAdFire(call) {
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
    }
    else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero */
        const { state, attacker, hitMessage, attackType, publish, die, random, rollOne, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage)
            await publish(hitMessage);
        const cancelled = !!attacker.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
        let damage = call.context.damage;
        if (cancelled) {
            // no message if attacker has been cancelled
            damage = 0;
        }
        else if (negated) {
            damage = 0;
            await publish('You avoid harm.');
        }
        else {
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
            }
            else {
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
    }
    else {
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
function elementContinueResult(damage) {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}
// C uhitm.c:mhitm_ad_cold().
export async function mhitmAdCold(call) {
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
    }
    else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with cold */
        const { state, attacker, hitMessage, publish, die, random, rollOne, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage)
            await publish(hitMessage);
        const cancelled = !!attacker.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
        let damage = call.context.damage;
        if (cancelled) {
            // no message if attacker has been cancelled
            damage = 0;
        }
        else if (negated) {
            damage = 0;
            await publish('You avoid harm.');
        }
        else {
            await publish("You're covered in frost!");
            if (state.u.coldResistance) {
                await publish("The frost doesn't seem cold!");
                monstersObserveHeroResistance(M_SEEN_COLD, state);
                damage = 0;
            }
            else {
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
    }
    else {
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
export async function mhitmAdElec(call) {
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
    }
    else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with electricity */
        const { state, attacker, hitMessage, publish, die, random, rollOne, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage)
            await publish(hitMessage);
        const cancelled = !!attacker.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
        let damage = call.context.damage;
        if (cancelled) {
            // no message if attacker has been cancelled
            damage = 0;
        }
        else if (negated) {
            damage = 0;
            await publish('You avoid harm.');
        }
        else {
            await publish('You get zapped!');
            if (state.u.shockResistance) {
                await publish("The zap doesn't shock you!");
                monstersObserveHeroResistance(M_SEEN_ELEC, state);
                damage = 0;
            }
            else {
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
    }
    else {
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
export function physicalDamage(monster, { state, damage, attack, specialDamage }) {
    if (monsterIsShade(monster))
        damage = 0;
    damage += specialDamage;
    if (attack[0] === AT_WEAP)
        return 0;
    if ([AT_KICK, AT_CLAW, AT_TUCH, AT_HUGS].includes(attack[0])) {
        if (monsterIsThickSkinned(monster))
            damage = attack[0] === AT_KICK ? 0 : Math.trunc((damage + 1) / 2);
        const bonus = state.u.udaminc ?? 0;
        if (bonus > 0)
            damage += bonus;
        else if (damage > 0)
            damage = Math.max(1, damage + bonus);
    }
    return damage;
}
// C mondata.c:can_blnd() for the hero's own contact attack; the monster
// defender twin lives with mhitm_ad_blnd's monster-versus-monster branch.
function naturalAttackCanBlind(monster, { state, attack }) {
    if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES || !monster.mcansee && !monster.mblinded)
        return false;
    if (heroSpecies(state) === PM_RAVEN && monster.mnum === PM_RAVEN)
        return false;
    const method = attack[0];
    if ([AT_EXPL, AT_BOOM, AT_GAZE, AT_MAGC, AT_BREA].includes(method))
        return !monsterResistsBlindingLight(monster, state);
    if ([AT_WEAP, AT_SPIT, AT_NONE].includes(method))
        return false;
    if (method === AT_ENGL)
        return !monster.msleeping;
    if (method !== AT_CLAW)
        return true;
    if (state.u.uswallow)
        return false;
    return !(monster.minvent ?? []).some(object => (object.owornmask ?? 0) & W_ARMH
        && (state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
}
function statusContinueResult(damage) {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}
// C uhitm.c:mhitm_ad_drli().
export async function mhitmAdDrli(call) {
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
        if (mdef.mhpmax - damage > mdef.m_lev)
            mdef.mhpmax -= damage;
        else if (mdef.mhpmax > mdef.m_lev)
            mdef.mhpmax = mdef.m_lev + 1;
        mdef.mhp -= damage;
        /* !m_lev: level 0 monster is killed regardless of hit points
           rather than drop to level -1; note: some non-living creatures
           (golems, vortices) are subject to life-drain */
        if (mdef.mhp <= 0 || !mdef.m_lev) {
            await publish(`${monsterName(mdef, { state, capitalized: true })} ${monsterIsNonliving(mdef.mnum) ? 'expires' : 'dies'}!`);
            await finishHeroMonsterKillOutcome(mdef, mdef.mx, mdef.my, {
                showKillMessage: false, publish,
            });
        }
        else
            mdef.m_lev--;
        // damage has already been inflicted; unlike hitting with
        // Stormbringer, the wounded hero doesn't heal any from the drained
        // life.
        return statusContinueResult(0);
    }
    else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with life drainage */
        const { state, attacker, hitMessage, publish, die, random, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage)
            await publish(hitMessage);
        if (recordRandom(random, calls, 3) === 0 && !heroHasDrainResistance(state)) {
            // mhitm_mgc_atk_negated(magr, mdef, TRUE), which owns the
            // "You avoid harm." line; a cancelled attacker returns quietly.
            const negated = specialAttackNegated(attacker, state.u, {
                state, random: limit => recordRandom(random, calls, limit),
            });
            if (negated && !attacker.mcan)
                await publish('You avoid harm.');
            // unlike hitting with Stormbringer, the wounded attacker doesn't
            // heal any from the drained life
            if (!negated && await loseHeroExperience('life drainage', { die, publish }))
                return { damage: call.context.damage, nativeResult: M_ATTK_MISS,
                    done: false, heroDied: true };
        }
        return statusContinueResult(call.context.damage);
    }
    else {
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
            if (defender.mhpmax - damage > defender.m_lev)
                defender.mhpmax -= damage;
            else if (defender.mhpmax > defender.m_lev)
                defender.mhpmax = defender.m_lev + 1;
            if (defender.m_lev === 0) /* automatic kill if drained past level 0 */
                damage = defender.mhp;
            else
                defender.m_lev--;
            // unlike hitting with Stormbringer, the wounded attacker doesn't
            // heal any from the drained life
        }
        return statusContinueResult(damage);
    }
}
// C uhitm.c:mhitm_ad_blnd().
export async function mhitmAdBlnd(call) {
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
            if (damage > 127)
                damage = 127;
            mdef.mblinded = damage;
        }
        return statusContinueResult(0);
    }
    else if ('mdef' in call) {
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
    }
    else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        await applyMonsterCombatBlindness(attacker, defender, context.attack, context);
        return statusContinueResult(0);
    }
}
// C uhitm.c:mhitm_ad_ench().
export async function mhitmAdEnch(call) {
    if ('magr' in call) {
        /* uhitm: there's no msomearmor() function, so just do damage */
        return statusContinueResult(call.context.damage);
    }
    else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero's worn gear */
        const { state, attacker, hitMessage, publish, random, calls } = call.context;
        // mhitm_mgc_atk_negated(magr, mdef, FALSE) precedes hitmsg(); a
        // cancelled attacker returns without rolling.
        const negated = !!attacker.mcan
            || recordRandom(random, calls, 10) < 3 * magicNegation(state.u, state);
        // hitmsg(magr, mattk)
        if (hitMessage)
            await publish(hitMessage);
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
    }
    else {
        /* mhitm: there's no msomearmor() function, so just do damage */
        return statusContinueResult(call.context.damage);
    }
}
// C uhitm.c:mhitm_ad_stun().
export async function mhitmAdStun(call) {
    if ('magr' in call) {
        /* uhitm: the hero attacks a monster with a stunning blow */
        const mdef = call.defender;
        const { state, publish } = call.context;
        if (!heroIsBlind(state))
            await publish(`${monsterName(mdef, { state, capitalized: true })} ${staggerVerb(mdef.mnum)} for a moment.`);
        mdef.mstun = 1;
        // mhitm_ad_phys(); its uhitm branch never sets mhm->done.
        return statusContinueResult(physicalDamage(mdef, call.context));
    }
    else if ('mdef' in call) {
        /* mhitu: a monster attacks the hero with a stunning blow */
        const { state, attacker, hitMessage, publish, random, calls } = call.context;
        // hitmsg(magr, mattk)
        if (hitMessage)
            await publish(hitMessage);
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
    }
    else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        if (attacker.mcan)
            return statusContinueResult(context.damage);
        if (canSeeMonster(defender))
            await context.publish(`${monsterName(defender, { state: context.state, capitalized: true })} ${staggerVerb(defender.mnum)} for a moment.`);
        defender.mstun = 1;
        // mhitm_ad_phys(); its mhitm branch can finish the attack itself.
        return await context.applyPhysical();
    }
}
// C uhitm.c:mhitm_ad_legs().
export async function mhitmAdLegs(call) {
    if ('magr' in call) {
        /* uhitm: the #if 0 u.ucancelled probe is disabled upstream, so the
           branch reduces to mhitm_ad_phys(), whose uhitm branch never sets
           mhm->done. */
        return statusContinueResult(physicalDamage(call.defender, call.context));
    }
    else if ('mdef' in call) {
        /* mhitu: a xan pricks the hero's leg */
        const { state, attacker, publish, random, rollOne, calls } = call.context;
        const side = recordRandom(random, calls, 2) ? 'right' : 'left';
        const leg = heroLegName(state);
        const subject = monsterName(attacker, { capitalized: true });
        let damage = call.context.damage;
        // This case is too obvious to ignore, but Nethack is not in
        // general very good at considering height--most short monsters
        // still _can_ attack you when you're flying or mounted.
        const airborneHero = !!(state.u.usteed ||
            state.u.levitating ||
            state.u.levitation ||
            state.u.flying);
        const attackerFlies = !!((MONSTER_FLAGS1[attacker.mnum] ?? 0) & M1_FLY);
        if (airborneHero && !attackerFlies) {
            await publish(`${subject} tries to reach your ${side} ${leg}!`);
            damage = 0;
        }
        else if (attacker.mcan) {
            await publish(`${subject} nuzzles against your ${side} ${leg}!`);
            damage = 0;
        }
        else {
            const boots = state.uarmf || state.u.uarmf;
            if (boots) {
                if (recordRandom(random, calls, 2) !== 0
                    && [LOW_BOOTS, IRON_SHOES].includes(boots.otyp)) {
                    await publish(`${subject} pricks the exposed part of your ${side} ${leg}!`);
                }
                else if (recordRandom(random, calls, 5) === 0) {
                    await publish(`${subject} pricks through your ${side} boot!`);
                }
                else {
                    await publish(`${subject} scratches your ${side} boot!`);
                    damage = 0;
                    return statusContinueResult(damage);
                }
            }
            else {
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
    }
    else {
        /* mhitm: monster versus monster */
        const { attacker, defender, context } = call;
        if (attacker.mcan)
            return statusContinueResult(0);
        return await context.applyPhysical();
    }
}
const M1_UNSOLID = 0x00100000;
const S_EYE = 5;
const S_LIGHT = 25;
function isHeroActor(actor, state) {
    return actor === state.u;
}
function species(actor, state) {
    if (!isHeroActor(actor, state))
        return actor.mnum;
    requireInitializedHero(actor);
    return actor.umonnum;
}
function inventory(actor, state) {
    return isHeroActor(actor, state) ? state.inventory : actor.minvent ?? [];
}
function wieldedWeapon(actor, state) {
    return isHeroActor(actor, state) ? state.uwep : monsterWieldedWeapon(actor);
}
export function isSteadfast(actor, state) {
    requirePlayingGame(state);
    const mnum = species(actor, state);
    const floating = isHeroActor(actor, state)
        ? actor.levitating || actor.levitation || actor.flying
        : ((MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY)
            || [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[mnum] ?? -1);
    if (floating || Is_airlevel(state.u.uz)
        || (Is_waterlevel(state.u.uz)
            && !isPoolAt(state.u.ux, state.u.uy, state)))
        return false;
    if (artifactById(wieldedWeapon(actor, state)?.oartifact)?.name === 'Giantslayer')
        return true;
    return inventory(actor, state).some(object => object.otyp === LOADSTONE)
        || (actor === state.u.usteed
            && state.inventory.some(object => object.otyp === LOADSTONE));
}
// C uhitm.c:mhitm_knockback().
export async function tryKnockback(attacker, defender, attack, { state = game, random = rn2, publish = plineWithContinuation, weaponUsed = false, hit = true, finishMonsterDeath, finishLiquidDeath, nameMonster = monster => monsterName(monster, {
    state, article: 'your',
    suppressSaddle: !!MGIVENNAME(monster) || monster === state.u.usteed,
}), wakeDefender, } = {}) {
    requirePlayingGame(state);
    const distance = random(3) ? 1 : 2;
    const weapon = weaponUsed ? wieldedWeapon(attacker, state) : null;
    const chance = artifactById(weapon?.oartifact)?.name === 'Ogresmasher' ? 2 : 6;
    if (random(chance) !== 0)
        return { knocked: false };
    if (attack.damageType !== AD_PHYS
        || ![AT_CLAW, AT_KICK, AT_BUTT, AT_WEAP].includes(attack.attackType))
        return { knocked: false };
    const attackerForm = species(attacker, state);
    if ((MONSTER_ATTACKS[attackerForm] || []).some(([method, damage]) => [AT_ENGL, AT_HUGS].includes(method) || [AD_STCK, AD_WRAP].includes(damage)))
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
        if (!canKnockHeroToward(dx, dy))
            return { knocked: false };
    }
    else {
        if (!isok(x + dx, y + dy))
            return { knocked: false };
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
    let target = defenderMonster;
    let dismount = false;
    if (heroTarget && state.u.usteed) {
        const saddle = (state.u.usteed.minvent ?? []).find(object => (object.owornmask ?? 0) & W_SADDLE);
        if (saddle?.cursed) {
            target = state.u.usteed;
            movingHero = false;
        }
        else
            dismount = true;
    }
    if ((attackerMonster && (attackerMonster.dead || attackerMonster.mhp <= 0))
        || (target && (target.dead || target.mhp <= 0)))
        return { knocked: false };
    const attackerSize = MONSTER_SIZE[attackerForm];
    const defenderForm = species(target ?? state.u, state);
    const defenderSize = MONSTER_SIZE[defenderForm];
    if (attackerSize === undefined || defenderSize === undefined)
        throw new Error(`Knockback requires known species sizes (${attackerForm}, ${defenderForm}).`);
    if (attackerSize <= defenderSize + 1)
        return { knocked: false };
    if (weapon && (isFlimsyObject(weapon) || !isBluntWeapon(weapon)))
        return { knocked: false };
    if (((MONSTER_FLAGS1[attackerForm] ?? 0) & M1_UNSOLID)
        || ((heroAttacks || movingHero) && !hit))
        return { knocked: false };
    if (isSteadfast(target ?? state.u, state)) {
        if (movingHero || target === state.u.usteed) {
            await publish(state.u.usteed
                ? `You and ${nameMonster(state.u.usteed)} don't budge.` : "You don't budge.");
        }
        else if (target && canSeeMonster(target)) {
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
        if (heroTarget && target)
            object = `you and ${nameMonster(target)}`;
        const strength = random(2) ? 'forceful' : 'powerful';
        const blow = random(2) ? 'blow' : 'strike';
        await publish(`${subject} ${heroAttacks ? 'knock' : 'knocks'} ${object} ${how} with a ${strength} ${blow}!`);
    }
    else if (heroAttacks && target) {
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
        }
        else
            await hurtleHero(dx, dy, distance, finishMonsterDeath ? { finishMonsterDeath } : {});
        moved = state.u.ux !== x || state.u.uy !== y;
        // A fatal hurtle ends the game inside C's hurtle(); nothing follows.
        if (state.program_state.gameover)
            return { knocked: true, moved, heroDied: true, defenderDied: true };
        if (attackerMonster)
            setMonsterApparentHeroPosition(attackerMonster, state, random);
        if (!state.u.stunned && !((state.u.stunnedTurns ?? 0) > 0) && random(4) === 0) {
            await makeStunned(distance + 1, { state, publish });
        }
    }
    else {
        if (!target)
            throw new Error('Monster knockback requires a monster target.');
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
                if (attackerMonster)
                    setMonsterApparentHeroPosition(attackerMonster, state, random);
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
//# sourceMappingURL=uhitm.js.map