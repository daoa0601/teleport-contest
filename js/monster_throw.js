// Native mthrowu.c:monshoot(), m_throw(), ohitmon(), and drop_throw().
// Each projectile completes its visible flight and world effects before the
// next projectile is detached from the attacker's inventory.
import { A_DEX, A_STR, BOLT_LIM, D_CLOSED, D_LOCKED, IRONBARS, IS_DOOR, IS_OBSTRUCTED, M_AP_MONSTER, M_AP_TYPE, NEED_RANGED_WEAPON, NEED_WEAPON, P_BOW, P_DAGGER, P_DART, P_SHURIKEN, P_SLING, P_SPEAR, SINK, SLT_ENCUMBER, isok, } from './const.js';
import { currentAttribute } from './attrib.js';
import { artifactToHitBonus } from './artifacts.js';
import { applyMonsterBlindness, monsterCanBeBlindedByObject, prepareHeroThrownBlindness, finishHeroThrownBlindness } from './blinding_attack.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { canSeeMonster, canSpotMonster, displayLiquidName, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, stack_object } from './floor_object.js';
import { game, requirePlayingGame } from './gstate.js';
import { dist2, distmin } from './hacklib.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { captureHeroProjectileName } from './hero_physical_messages.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { heroSpecies } from './hero_species.js';
import { angerAttackedMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { finishHeroDeathAfterMonsterMessage } from './monster_attack_death.js';
import { rejectMonsterShadeContact } from './monster_combat_messages.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SIZE, monsterHatesSilver, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsNonliving, monsterIsPlayerMonster, monsterIsUnicorn, monsterIsVampireShifter } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { clearDescriptionKnowledge, unlinkMonsterObject } from './monster_inventory.js';
import { unlinkObject } from './object_location.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, monsterObjectPronoun, possessiveName } from './monster_name.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { applyMonsterPassiveToObject } from './monster_passive.js';
import { monsterProjectileDisplay } from './monster_projectile_display.js';
import { monsterLinedUpWithMonster } from './monster_ranged_alignment.js';
import { returnMonsterWeapon } from './monster_returning_weapon.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance, monsterHasStoneResistance } from './monster_resistance.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { monsterWieldedWeapon, selectMonsterRangedWeapon, unwieldMonsterWeapon, wieldMonsterWeapon } from './monster_weapon.js';
import { findMonsterArmorClass } from './monworn.js';
import { delobj } from './object_delete.js';
import { ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EGG, ELVEN_ARROW, ELVEN_BOW, OBJECT_NAMES, OBJECT_SUBTYPE } from './object_data.js';
import { dropObjectAtHero } from './object_drop.js';
import { withIndefiniteArticle, verbForSubject } from './object_grammar.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { objectMaterial } from './object_material.js';
import { shipObject } from './object_migration.js';
import { isPoisonableObject } from './object_properties.js';
import { splitObjectStack } from './object_stack.js';
import { objectCombatName, objectHasPersonalName, killerObjectName } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { heroHasNoHands } from './polyself.js';
import { poisonHero } from './poison.js';
import { hitMonsterWithSupportedPotion } from './potion_hit.js';
import { shouldMulchMissile } from './projectile.js';
import { projectileHitsIronBars } from './projectile_bars.js';
import { capitalizedDefiniteName, rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { hitByPetrifyingEgg, touchPetrifies } from './stoning.js';
import { cansee } from './vision.js';
import { calcCapacity } from './weight.js';
import { ammunitionMatchesLauncher, heroHasFreeHand, isAmmunition, isPolearm, returningWeaponRangeSquared } from './weapon_type.js';
import { rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';
const WEAPON_CLASS = 2, GEM_CLASS = 13, VENOM_CLASS = 17, POTION_CLASS = 8;
const M2_ELF = 0x10, M2_GNOME = 0x40, M2_ORC = 0x80, M2_LORD = 0x400, M2_PRINCE = 0x800;
const M1_WALLWALK = 0x08, M1_UNSOLID = 0x00100000;
const SILVER = 14, GEMSTONE = 20, MINERAL = 21;
const PM_CAVE_DWELLER = MONSTER_NAME.indexOf('cave dweller');
const PM_MONK = MONSTER_NAME.indexOf('monk');
const PM_RANGER = MONSTER_NAME.indexOf('ranger');
const PM_ROGUE = MONSTER_NAME.indexOf('rogue');
const PM_SAMURAI = MONSTER_NAME.indexOf('samurai');
const PM_NINJA = MONSTER_NAME.indexOf('ninja');
const FIRST_GLASS_GEM = OBJECT_NAMES.indexOf('worthless piece of white glass');
const LAST_GLASS_GEM = OBJECT_NAMES.indexOf('worthless piece of violet glass');
export async function throwMonsterProjectile(source, object, { state = game, dx, dy, range, target = null, archer = null, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, volley, }) {
    requirePlayingGame(state);
    const tethered = object === monsterWieldedWeapon(source) && returningWeaponRangeSquared(object) !== null;
    const launched = ammunitionMatchesLauncher(object, monsterWieldedWeapon(source));
    const missile = await detachMissile(source, object, state, publish);
    state._thrownObject = missile;
    state.bhitpos = { x: source.mx, y: source.my };
    state.notonhead = false;
    if (!canSeeMonster(source))
        clearDescriptionKnowledge(missile);
    const context = { state, source, target, archer, random, rollOne, rollDice, publish,
        ...(volley ? { volley } : {}) };
    const shot = {
        source, weapon: missile, launched,
        heroTarget: false, target: null, hit: false, damage: 0, targetDied: false,
        heroDied: false, caught: false, projectileBroken: false, flightPath: [],
        impactX: source.mx, impactY: source.my,
    };
    let display = null;
    let blindness = null;
    let returning = false;
    try {
        if ((missile.cursed || missile.greased) && (dx || dy) && random(7) === 0) {
            if (canSeeMonster(source) && state.flags.verbose) {
                if (isAmmunition(missile))
                    await publish(`${monsterName(source, { state, capitalized: true })} misfires!`);
                else {
                    const name = objectCombatName(missile, { state });
                    await publish(`${capitalizedDefiniteName(name, state)} ${verbForSubject(name, 'slip')} as ${monsterName(source, { state })} throws it!`);
                }
            }
            dx = random(3) - 1;
            dy = random(3) - 1;
            if (!dx && !dy) {
                await dropMonsterProjectile(shot, false, state.bhitpos, context);
                return shot;
            }
        }
        if (await flightBlocked(missile, dx, dy, false, context)) {
            if (missile.where !== 'gone')
                await dropMonsterProjectile(shot, false, state.bhitpos, context);
            return shot;
        }
        const flightDisplay = monsterProjectileDisplay(missile, state, { tethered });
        display = flightDisplay;
        while (range-- > 0) {
            const point = { x: state.bhitpos.x + dx, y: state.bhitpos.y + dy };
            state.bhitpos = point;
            missile.ox = shot.impactX = point.x;
            missile.oy = shot.impactY = point.y;
            shot.flightPath.push(point);
            if (cansee(point.x, point.y))
                observeObject(missile, state);
            const monster = monsterAtPosition(state.level, point.x, point.y);
            if (monster) {
                const shadeMiss = await rejectMonsterShadeContact(source, monster, missile, {
                    state, visible: true, thrown: true, publish, rollOne, rollDice,
                });
                if (!shadeMiss && await hitMonsterWithProjectile(monster, shot, range, context))
                    break;
            }
            else if (point.x === state.u.ux && point.y === state.u.uy) {
                if (state.multi)
                    endVoluntaryMultiTurn(state);
                shot.heroTarget = true;
                shot.target = null;
                if (await catchUnicornGift(missile, context)
                    || !tethered && await catchThrownObject(missile, context)) {
                    shot.caught = true;
                    break;
                }
                if (missile.oclass === POTION_CLASS) {
                    const potion = await hitHeroWithThrownPotion(missile, { state, publish, random, rollOne, rollDice });
                    shot.heroDied = potion.heroDied;
                    break;
                }
                const hit = await hitHeroWithProjectile(shot, context);
                blindness = hit.blindness;
                if (shot.heroDied)
                    break;
                if (shot.hit) {
                    if (tethered)
                        returning = true;
                    else
                        await dropMonsterProjectile(shot, true, point, context);
                    break;
                }
            }
            if (state.program_state.gameover)
                break;
            const forceHit = random(5) === 0;
            if (!range || await flightBlocked(missile, dx, dy, forceHit, context)
                || state.level.at(point.x, point.y)?.typ === SINK) {
                if (missile.where !== 'gone') {
                    if (range && state.level.at(point.x, point.y)?.typ === SINK && cansee(point.x, point.y)) {
                        const name = captureHeroProjectileName(missile, state, volley);
                        await publish(`${capitalizedDefiniteName(name, state)} ${verbForSubject(name, heroIsHallucinating(state) ? 'plop' : 'drop')} onto the sink.`);
                    }
                    else if (volley && volley.count > 1
                        && (!shot.heroTarget || point.x !== state.u.ux || point.y !== state.u.uy)
                        && (cansee(point.x, point.y) || archer && canSeeMonster(archer))) {
                        await publish(`${capitalizedDefiniteName(captureHeroProjectileName(missile, state, volley), state)} misses.`);
                    }
                    if (tethered)
                        returning = true;
                    else
                        await dropMonsterProjectile(shot, false, point, context);
                }
                break;
            }
            await flightDisplay.show(point);
        }
        if (!state.program_state.gameover)
            await flightDisplay.show(state.bhitpos);
        if (returning && !state.program_state.gameover) {
            await returnMonsterWeapon(source, missile, state.bhitpos.x, state.bhitpos.y, {
                state, publish, random, rollOne,
                animateReturn: () => flightDisplay.backtrack(),
            });
        }
    }
    finally {
        display?.clear();
        if (state._thrownObject === missile)
            state._thrownObject = null;
        shot.heroDied = !!state.program_state.gameover;
        shot.projectileBroken = missile.where === 'gone';
    }
    if (blindness && !state.program_state.gameover)
        await finishHeroThrownBlindness(blindness, state, publish);
    shot.heroDied = !!state.program_state.gameover;
    shot.projectileBroken = missile.where === 'gone';
    return shot;
}
export function objectTypeName(object) {
    return object ? OBJECT_NAMES[object.otyp] || '' : '';
}
// Switching to a launcher consumes this action. If no launcher is needed,
// or the correct launcher is already wielded, the monster may shoot now.
export async function readyRangedMonsterWeapon(monster, state = game) {
    const current = monsterWieldedWeapon(monster);
    if (monster?.weaponCheck !== NEED_WEAPON && current)
        return null;
    monster.weaponCheck = NEED_RANGED_WEAPON;
    return wieldMonsterWeapon(monster, state);
}
function monsterClassVolleyBonus(monster, missile, launcher) {
    const skill = OBJECT_SUBTYPE[missile.otyp] ?? 0;
    if (monster.mnum === PM_CAVE_DWELLER)
        return skill === -P_SLING || skill === P_SPEAR ? 1 : 0;
    if (monster.mnum === PM_MONK)
        return skill === -P_SHURIKEN ? 1 : 0;
    if (monster.mnum === PM_RANGER)
        return skill !== P_DAGGER ? 1 : 0;
    if (monster.mnum === PM_ROGUE)
        return skill === P_DAGGER ? 1 : 0;
    let bonus = 0;
    if (monster.mnum === PM_NINJA
        && (skill === -P_SHURIKEN || skill === -P_DART)) {
        bonus++;
    }
    if ((monster.mnum === PM_NINJA || monster.mnum === PM_SAMURAI)
        && objectTypeName(missile) === 'ya'
        && objectTypeName(launcher) === 'yumi') {
        bonus++;
    }
    return bonus;
}
export function monsterVolleyCount(monster, missile, launcher, rollOne = rnd) {
    const quantity = missile?.quan ?? missile?.quantity ?? 1;
    const missileName = objectTypeName(missile);
    const ammunition = isAmmunition(missile);
    const matchingLauncher = ammunitionMatchesLauncher(missile, launcher);
    const stackableWeapon = missile.oclass === WEAPON_CLASS;
    if (quantity <= 1 || monster?.mconf
        || (ammunition ? !matchingLauncher : !stackableWeapon))
        return 1;
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    let maximum = 1;
    if (flags & M2_PRINCE)
        maximum += 2;
    else if (flags & M2_LORD)
        maximum++;
    else if (monsterIsPlayerMonster(monster.mnum))
        maximum++;
    if (missileName === 'elven arrow' && !missile.cursed)
        maximum++;
    if (objectTypeName(launcher) === 'elven bow'
        && matchingLauncher && !launcher?.cursed)
        maximum++;
    if (matchingLauncher && (launcher?.spe ?? 0) > 1)
        maximum += Math.trunc(((launcher?.spe ?? 0) + 1) / 3);
    let volley = rollOne(maximum);
    volley += monsterClassVolleyBonus(monster, missile, launcher);
    if (((flags & M2_ELF)
        && missileName === 'elven arrow'
        && objectTypeName(launcher) === 'elven bow')
        || ((flags & M2_ORC)
            && missileName === 'orcish arrow'
            && objectTypeName(launcher) === 'orcish bow')
        || ((flags & M2_GNOME)
            && missileName === 'crossbow bolt'
            && objectTypeName(launcher) === 'crossbow')) {
        volley++;
    }
    return Math.max(1, Math.min(quantity, volley));
}
async function detachMissile(source, object, state, publish) {
    if (object.quan > 1) {
        const split = splitObjectStack(object, 1, state);
        if (!split)
            throw new Error(`Cannot detach projectile from object ${object.o_id}`);
        return unlinkObject(split, state);
    }
    if (monsterWieldedWeapon(source) === object)
        await unwieldMonsterWeapon(source, state, { weapon: object, publish });
    if (object.where === 'minvent')
        unlinkMonsterObject(source, object);
    if (object.where !== 'free')
        throw new Error('A monster projectile must be free or carried by its source');
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    return object;
}
async function flightBlocked(object, dx, dy, forceHit, { state, publish, random, }) {
    const { x, y } = state.bhitpos;
    const nextX = x + dx, nextY = y + dy;
    if (!isok(nextX, nextY))
        return true;
    const cell = state.level.at(nextX, nextY);
    if (!cell || IS_OBSTRUCTED(cell.typ)
        || IS_DOOR(cell.typ) && !!((cell.doormask ?? 0) & (D_CLOSED | D_LOCKED)))
        return true;
    if (cell.typ !== IRONBARS)
        return false;
    const bars = await projectileHitsIronBars(object, {
        state, x, y, barsX: nextX, barsY: nextY, forceHit, heroCaused: false, publish, random,
    });
    return bars.blocked || bars.heroDied;
}
async function dropMonsterProjectile(shot, hit, point, context) {
    const { state, publish, random } = context;
    const object = shot.weapon;
    const broken = object.otyp === CREAM_PIE || object.oclass === VENOM_CLASS
        || hit && object.otyp === EGG
        || hit && shouldMulchMissile(object, { monsterMoving: !!state.context.mon_moving });
    if (broken) {
        await delobj(object, state);
    }
    else if (!await shipObject(object, point.x, point.y, { state, publish, random })) {
        const actor = monsterAtPosition(state.level, point.x, point.y)
            || (point.x === state.u.ux && point.y === state.u.uy ? state.u : null);
        const floor = await applyFloorEffects(object, point.x, point.y, { state, publish, random, verb: 'fall' });
        if (!floor.finished && !state.program_state.gameover) {
            await placeObject(object, point.x, point.y, state);
            if (actor && hit)
                await applyMonsterPassiveToObject(actor, object, { state, publish, random });
            if (!state.program_state.gameover)
                await stack_object(object, state);
        }
    }
    if (state._thrownObject === object)
        state._thrownObject = null;
}
async function hitMonsterWithProjectile(defender, shot, remaining, context) {
    const { state, archer, target, publish, random, rollOne, rollDice, volley } = context;
    const object = shot.weapon;
    const point = { ...state.bhitpos };
    state.notonhead = point.x !== defender.mx || point.y !== defender.my;
    const disguised = M_AP_TYPE(defender) !== 0 && M_AP_TYPE(defender) !== M_AP_MONSTER;
    const visible = cansee(point.x, point.y);
    if (visible)
        observeObject(object, state);
    let accuracy = 5 + findMonsterArmorClass(defender)
        + rangedTargetHitBonus(object, defender, { state, random, rollOne });
    if (archer && defender === target) {
        if (archer.m_lev > 5)
            accuracy += archer.m_lev - 5;
        const launcher = monsterWieldedWeapon(archer);
        if (launcher?.oartifact)
            accuracy += artifactToHitBonus(launcher, defender, rollOne, { state, random });
    }
    shot.target = defender;
    shot.heroTarget = false;
    shot.hit = accuracy >= rollOne(20);
    if (!shot.hit) {
        if (!disguised) {
            if (visible) {
                const name = captureHeroProjectileName(object, state, volley);
                await publish(rayMissMessage(name, defender, { ...point, state }));
            }
            else if (!target)
                await publish('It is missed.');
        }
        if (remaining)
            return false;
        await dropMonsterProjectile(shot, false, { x: defender.mx, y: defender.my }, context);
        return true;
    }
    if (disguised)
        revealMonsterAppearance(defender);
    defender.msleeping = 0;
    if (object.oclass === POTION_CLASS) {
        const potion = await hitMonsterWithSupportedPotion({
            state, monster: defender, potion: object, target: point, publish,
            wakeNearby: (x, y, distance) => wakeMonstersNearWithMessages(x, y, distance, state, publish),
            resolveVapor: true,
            // potionhit measures vapor distance from the monster's head.
            distance: dist2(state.u.ux, state.u.uy, defender.mx, defender.my),
            heroCaused: !state.context.mon_moving,
            finishKill: async (victim, options) => {
                if (!state.context.mon_moving)
                    return finishHeroMonsterKillOutcome(victim, victim.mx, victim.my, options);
                const death = await finishEnvironmentalMonsterDeath(victim, state, { ...options, publish });
                return { killed: !death.survived, heroDied: !!death.heroDied };
            },
        });
        if (!potion)
            throw new Error(`Unsupported thrown potion ${object.otyp}`);
        return true;
    }
    const material = objectMaterial(object, state);
    const defenderFlags = MONSTER_FLAGS1[defender.mnum] ?? 0;
    const harmless = object.oclass !== 4 && (material === GEMSTONE || material === MINERAL)
        && !!(defenderFlags & M1_WALLWALK) && !(defenderFlags & M1_UNSOLID);
    let damage = rollPhysicalWeaponDamage(object, defender, { state, rollOne, rollDice });
    if (object.otyp === ACID_VENOM && monsterHasAcidResistance(defender))
        damage = 0;
    if (visible) {
        if (object.otyp === EGG) {
            const egg = object.known && object.corpsenm !== undefined
                ? `${withIndefiniteArticle(MONSTER_NAME[object.corpsenm] ?? 'unknown')} egg` : 'an egg';
            await publish(`Splat!  ${monsterName(defender, { state, capitalized: true })} is hit with ${egg}!`);
        }
        else {
            const name = captureHeroProjectileName(object, state, volley);
            await publish(rayHitMessage(name, defender, {
                ...point, state, damage,
                ...(harmless ? { ending: ` but passes harmlessly through ${monsterObjectPronoun(defender, { state })}.` } : {}),
            }));
        }
    }
    else if (!target) {
        await publish(`${object.otyp === EGG ? 'Splat!  ' : ''}${monsterName(defender, { state, capitalized: true })} is hit${damage > 4 ? '!' : '.'}`);
    }
    if (object.opoisoned && isPoisonableObject(object)) {
        if (monsterHasPoisonResistance(defender)) {
            if (visible)
                await publish(`The poison doesn't seem to affect ${monsterName(defender, { state })}.`);
        }
        else if (random(30) !== 0)
            damage += rollOne(6);
        else {
            if (visible)
                await publish('The poison was deadly...');
            damage = defender.mhp;
        }
    }
    if (material === SILVER && monsterHatesSilver(defender)) {
        const flesh = !monsterIsNoncorporeal(defender) && !monsterIsAmorphous(defender);
        if (visible) {
            const subject = monsterName(defender, { state });
            await publish(`The silver sears ${flesh ? `${possessiveName(subject)} flesh` : subject}!`);
        }
        else if (!target)
            await publish(`${flesh ? 'Its flesh' : 'It'} is seared!`);
    }
    if (object.otyp === ACID_VENOM && cansee(defender.mx, defender.my)) {
        if (monsterHasAcidResistance(defender)) {
            if (visible || !target)
                await publish(`${monsterName(defender, { state, capitalized: true })} is unaffected.`);
        }
        else if (visible) {
            await publish(`The ${displayLiquidName('acid', state)} burns ${monsterName(defender, { state })}!`);
        }
        else if (!target)
            await publish('It is burned!');
    }
    if (object.otyp === EGG && touchPetrifies(object.corpsenm)) {
        const stone = await petrifyMonsterFromContact(defender, {
            state, publish, rollOne,
            finishDeath: (victim, options) => finishEnvironmentalMonsterDeath(victim, state, { ...options, publish, random, rollDice }),
        });
        if (stone.heroDied)
            return true;
        if (monsterHasStoneResistance(defender))
            damage = 0;
    }
    shot.damage = harmless ? 0 : damage;
    if (!harmless && defender.mhp > 0) {
        defender.mhp -= damage;
        if (defender.mhp <= 0) {
            if (visible || !target) {
                const destroyed = monsterIsNonliving(defender.mnum) || monsterIsVampireShifter(defender)
                    || !canSpotMonster(defender);
                await publish(`${monsterName(defender, { state, capitalized: true })} is ${destroyed ? 'destroyed' : 'killed'}!`);
            }
            if (!state.context.mon_moving)
                await finishHeroMonsterKillOutcome(defender, defender.mx, defender.my, { showKillMessage: false, publish });
            else
                await finishEnvironmentalMonsterDeath(defender, state, { publish, random, rollDice });
            if (state.program_state.gameover)
                return true;
        }
    }
    shot.targetDied = defender.mhp <= 0;
    if (!shot.targetDied && monsterCanBeBlindedByObject(defender, object.otyp, { state })) {
        if (visible && defender.mcansee) {
            const cause = object.oclass === VENOM_CLASS ? 'venom' : object.otyp === CREAM_PIE ? 'pie' : objectCombatName(object, { state });
            await publish(`${monsterName(defender, { state, capitalized: true })} is blinded by the ${cause}.`);
        }
        applyMonsterBlindness(defender, rollOne(25) + 20);
    }
    if (!shot.targetDied && !state.context.mon_moving)
        await angerAttackedMonster(defender);
    if (!state.program_state.gameover)
        await dropMonsterProjectile(shot, true, point, context);
    return true;
}
async function catchUnicornGift(object, { state, source, publish }) {
    if (object.oclass !== GEM_CLASS || object.otyp > LAST_GLASS_GEM || !monsterIsUnicorn(heroSpecies(state)))
        return false;
    const name = objectCombatName(object, { state });
    const owner = possessiveName(monsterName(source, { state }));
    if (object.otyp >= FIRST_GLASS_GEM) {
        await publish(`You catch the ${name}.`);
        await publish(`You are not interested in ${owner} junk.`);
        learnObjectType(object.otyp, state);
        await dropObjectAtHero(object, { state, publish });
    }
    else {
        await publish(`You accept ${owner} gift in the spirit in which it was intended.`);
        await holdAnotherObject(object, {
            state, publish, dropMessage: `You catch, but drop, ${name}.`, holdMessage: 'You catch:',
        });
    }
    return true;
}
async function catchThrownObject(object, { state, random, publish }) {
    const hero = state.u;
    if (heroIsBlind(state) || heroHasNoHands(state) || !heroHasFreeHand(state)
        || hero.confused || hero.stunned || hero.fumbling || object.oclass === VENOM_CLASS
        || calcCapacity(state, object.owt) > SLT_ENCUMBER)
        return false;
    const chance = 100 - currentAttribute(A_DEX, state)
        - (state.urole.key === 'monk' || state.urole.key === 'rogue' ? 20 : 0);
    if (random(chance) !== 0)
        return false;
    const name = objectCombatName(object, { state });
    await holdAnotherObject(object, {
        state, publish, dropMessage: `You catch, but drop, the ${name}.`,
        holdMessage: `You catch the ${name}!`,
    });
    return true;
}
async function hitHeroWithProjectile(shot, context) {
    const { state, source, random, rollOne, rollDice, publish, volley } = context;
    const object = shot.weapon;
    const hero = state.u;
    const zeroDamage = object.otyp === EGG || object.otyp === CREAM_PIE || object.otyp === BLINDING_VENOM;
    if (object.otyp === EGG && !touchPetrifies(object.corpsenm)) {
        await stopHeroOccupation(state, publish);
        return { blindness: null };
    }
    let damage = zeroDamage ? 0 : rollPhysicalWeaponDamageAgainstHero(object, state, { rollOne, rollDice });
    let accuracy = Math.max(-4, 3 - distmin(hero.ux, hero.uy, source.mx, source.my));
    if (((MONSTER_FLAGS2[source.mnum] ?? 0) & M2_ELF) && OBJECT_SUBTYPE[object.otyp] === -P_BOW) {
        accuracy++;
        if (monsterWieldedWeapon(source)?.otyp === ELVEN_BOW)
            accuracy++;
        if (object.otyp === ELVEN_ARROW)
            damage++;
    }
    if ((MONSTER_SIZE[heroSpecies(state)] ?? 0) >= 3)
        accuracy++;
    accuracy += 8 + object.spe;
    if (zeroDamage)
        accuracy = 8;
    else
        damage = Math.max(1, damage);
    if (object.otyp !== ACID_VENOM && hero.halfPhysicalDamage)
        damage = Math.ceil(damage / 2);
    shot.damage = damage;
    const mortality = hero.umortality ?? 0;
    const die = finishHeroDeathAfterMonsterMessage;
    const hit = await hitHeroWithObject(object, damage, accuracy, {
        state, publish, rollOne, die,
        name: captureHeroProjectileName(object, state, volley), killer: killerObjectName(object, state),
    });
    shot.hit = hit.hit;
    shot.heroDied = hit.died;
    if (hit.died)
        return { blindness: null };
    if (hit.hit && object.opoisoned && isPoisonableObject(object)) {
        const poison = await poisonHero({
            reason: objectCombatName(object, { state }), killer: killerObjectName(object, state),
            attribute: A_STR, fatal: (hero.umortality ?? 0) > mortality ? 0 : 10,
            state, random, rollDice, rollOne, publish, die, thrownWeapon: true,
        });
        if (poison.died) {
            shot.heroDied = true;
            return { blindness: null };
        }
    }
    const blindness = hit.hit ? prepareHeroThrownBlindness(object.otyp, state, rollOne) : null;
    if (blindness)
        await publish(blindness.message);
    if (hit.hit && object.otyp === EGG)
        await hitByPetrifyingEgg(object, state);
    await stopHeroOccupation(state, publish);
    return { blindness };
}
async function launchVolley(source, weapon, target, state, { random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
    const launcher = monsterWieldedWeapon(source);
    const launched = ammunitionMatchesLauncher(weapon, launcher);
    const targetX = target?.mx ?? source.mux ?? 0;
    const targetY = target?.my ?? source.muy ?? 0;
    const range = distmin(source.mx, source.my, targetX, targetY);
    const dx = Math.sign(targetX - source.mx), dy = Math.sign(targetY - source.my);
    const volley = monsterVolleyCount(source, weapon, launcher, rollOne);
    const visible = canSeeMonster(source);
    if (visible) {
        let appearance;
        if (volley > 1)
            appearance = `${volley} ${objectCombatName(weapon, { state })}`;
        else {
            const single = { ...weapon, quan: 1, quantity: 1 };
            const name = objectCombatName(single, { state });
            appearance = objectHasPersonalName(single, state)
                ? capitalizedDefiniteName(name, state).replace(/^The /u, 'the ') : withIndefiniteArticle(name);
        }
        await publish(`${monsterName(source, { state, capitalized: true })} ${launched ? 'shoots' : 'throws'} ${appearance}${target ? ` at ${canSpotMonster(target) ? monsterName(target, { state }) : 'something'}` : ''}!`);
    }
    const shots = [];
    for (let index = 1; index <= volley; index++) {
        const shot = await throwMonsterProjectile(source, weapon, {
            state, dx, dy, range, target, archer: target ? source : null,
            random, rollOne, rollDice, publish,
            volley: { count: volley, index, objectType: visible ? weapon.otyp : 0 },
        });
        shots.push(shot);
        if (shot.heroDied || source.mhp <= 0 || source.dead)
            break;
    }
    endVoluntaryMultiTurn(state);
    return { attempted: true, madeAttack: true,
        source, missileStack: weapon, volley, launched, shots,
        heroDied: !!state.program_state.gameover };
}
export async function throwMonsterWeaponAtHero(source, state, weapon, options = {}) {
    requirePlayingGame(state);
    return { ...await launchVolley(source, weapon, null, state, options), targetKind: 'hero', aimedAt: null };
}
export async function throwMonsterWeaponAtMonster(source, target, state, options = {}) {
    requirePlayingGame(state);
    if (await readyRangedMonsterWeapon(source, state))
        return { attempted: true, launched: false, spentWielding: true, heroDied: !!state.program_state.gameover };
    const weapon = selectMonsterRangedWeapon(source, state)?.weapon;
    if (!weapon || isPolearm(weapon) || !monsterLinedUpWithMonster(source, target, state))
        return null;
    const chance = Math.max(BOLT_LIM - distmin(source.mx, source.my, target.mx, target.my), 1);
    if (target.mflee && (options.random ?? rn2)(chance) !== 0)
        return null;
    if (ammunitionMatchesLauncher(weapon, monsterWieldedWeapon(source))
        && dist2(source.mx, source.my, target.mx, target.my) > 36)
        return null;
    return { ...await launchVolley(source, weapon, target, state, options), targetKind: 'monster', aimedAt: target };
}
//# sourceMappingURL=monster_throw.js.map