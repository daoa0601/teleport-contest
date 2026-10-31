// C uhitm.c:mhitm_ad_fire(), mhitm_ad_cold() and mhitm_ad_elec(): each
// attack's three actor branches (hero attacking a monster, monster
// attacking the hero, monster versus monster) share a single owner, in
// native order. Every message is awaited directly, so a --More--
// suspends the attack at the same source boundary as C and no
// elemental progress flags survive the call.
//
// C uhitm.c:mhitm_knockback() and m_is_steadfast(): a physical blow can
// throw a much smaller opponent backward. The shared owner tests the
// knockback destination through dothrow.c:will_hurtle(), words the
// message, then hurtles the defender.
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { formatFeltMessage } from './hero_speech.js';
import { artifactById } from './artifacts.js';
import { DOOR, DISMOUNT_KNOCKED, Is_airlevel, Is_waterlevel, M_ATTK_MISS, MGIVENNAME, MM_IGNORELAVA, MM_IGNOREWATER, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, Upolyd, W_SADDLE, isok, } from './const.js';
import { doorlessDoor } from './hack.js';
import { canSeeMonster, shieldeff } from './display.js';
import { plineWithContinuation } from './pline.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { requireInitializedHero } from './hero_types.js';
import { igniteItems } from './light.js';
import { applyMonsterGolemEffects } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { magicNegation, specialAttackNegated } from './magic_negation.js';
import { AD_COLD, AD_ELEC, AD_FIRE, AD_PHYS, AD_STCK, AD_WRAP, AT_BUTT, AT_CLAW, AT_ENGL, AT_HUGS, AT_KICK, AT_WEAP, } from './monster_attack_types.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import { monsterCombatDefense } from './monster_combat_defense.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, } from './monster_data.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { monsterName } from './monster_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, setMonsterApparentHeroPosition, } from './monster_perception.js';
import { monsterHasColdResistance, monsterHasFireResistance, monsterHasShockResistance, } from './monster_resistance.js';
import { recordRandom } from './monster_action_types.js';
import { returnHeroToHumanForm } from './polyself.js';
import { heroIsBlind } from './senses.js';
import { burnAwayHeroSlime } from './slime.js';
import { destroyColdInventory, destroyElectricInventory, destroyFireInventory, destroyMonsterInventoryByElement, } from './zap.js';
import { canKnockHeroToward, hurtleHero } from './hero_hurtle.js';
import { hurtleMonster, willMonsterHurtle } from './monster_hurtle.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { LOADSTONE } from './object_data.js';
import { isBluntWeapon, isFlimsyObject } from './object_properties.js';
import { rn2 } from './rng.js';
import { dismountHero } from './steed.js';
import { makeStunned } from './hero_mental_status.js';
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
const M1_FLY = 0x00000001;
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