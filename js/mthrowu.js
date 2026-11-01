// mthrowu.js — the mthrowu.c owner: missiles and rays a monster launches at
// the hero or at another monster. thitu(), drop_throw(), monmulti(),
// monshoot(), ohitmon(), ucatchgem(), u_catch_thrown_obj(), m_throw(),
// return_from_mtoss(), thrwmm(), spitmm()/spitmu(), breamm(), thrwmu(),
// breamu(), blocking_terrain(), linedup() and m_lined_up().
import { currentAttribute } from './attrib.js';
import { artifactToHitBonus } from './artifacts.js';
import { applyArtifactHit } from './artifacts.js';
import { heroArmName, monsterFootName, monsterHandName } from './body_parts.js';
import { applyMonsterBlindness, monsterCanBeBlindedByObject, prepareHeroThrownBlindness, finishHeroThrownBlindness, } from './blinding_attack.js';
import { breatheFromMonster, breathWeaponName } from './breath_ray.js';
import { endVoluntaryMultiTurn } from './hack.js';
import { isPolearm, ammunitionMatchesLauncher, isAmmunition } from './object_properties.js';
import { returningWeaponRangeSquared, rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero, } from './weapon.js';
import { willWeld } from './wield.js';
import { heroHasFreeHand } from './engrave.js';
import { monsterWeaponSwingVerb } from './mhitu.js';
import { rangedTargetHitBonus } from './dothrow.js';
import { couldsee, cansee, clearPath } from './vision.js';
import { clearDescriptionKnowledge, linkObjectToMonsterInventory, unlinkMonsterObject, mksobj, unlinkObject } from './mkobj.js';
import { destroyObjectFromMonsterInventory, findMonsterArmorClass } from './monworn.js';
import { objectWeight, calcCapacity } from './weight.js';
import { A_DEX, A_STR, BOLT_LIM, COULD_SEE, D_CLOSED, D_LOCKED, IRONBARS, IS_DOOR, IS_OBSTRUCTED, IS_WATERWALL, LAVAWALL, M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE, M_ATTK_HIT, M_ATTK_MISS, MGIVENNAME, M_SEEN_REFL, NEED_RANGED_WEAPON, NEED_WEAPON, NON_PM, P_BOW, P_DAGGER, P_DART, P_SHURIKEN, P_SLING, P_SPEAR, SINK, SLT_ENCUMBER, Upolyd, W_WEP, isok, } from './const.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, canSpotMonster, displayLiquidName, newsym, flush_screen, lastDirtyMapCursor, transientObjectGlyph, } from './display.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
import { applyFloorEffects, landFloorObject } from './floor_effects.js';
import { placeObject, stack_object } from './floor_object.js';
import { game, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import { dist2, distmin, possessiveName } from './hacklib.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { rejectMonsterShadeContact, applyMonsterPassiveToObject } from './uhitm.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { captureHeroProjectileName } from './hero_physical_messages.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { heroSpecies } from './hero_species.js';
import { formatHeardMessage, publishHeardMessage } from './hero_speech.js';
import { objectShedsLight } from './light.js';
import { revealMonsterAppearance } from './mon.js';
import { AD_ACID, AD_BLND, AD_DRST, AD_MAGM, AD_PHYS, AD_RBRE, AD_SLEE, AD_SPC2 } from './monster_attack_types.js';
import { finishHeroDeathAfterMonsterMessage } from './end.js';
import { recordRandom } from './monster_action_types.js';
import { petrifyMonsterFromContact } from './trap.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SIZE, monsterHatesSilver, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsNonliving, monsterIsPlayerMonster, monsterIsUnicorn, monsterIsVampireShifter, } from './monster_data.js';
import { monsterName } from './do_name.js';
import { monsterAtPosition } from './steed.js';
import { monsterObjectPronoun, monsterPossessive, seenResistanceForDamage, monsterHasAcidResistance, monsterHasPoisonResistance, monsterHasStoneResistance, } from './mondata.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { monsterSentenceSubject } from './ambient_sounds.js';
import { monsterWieldedWeapon, selectMonsterRangedWeapon, unwieldMonsterWeapon, wieldMonsterWeapon, } from './weapon.js';
import { delobj } from './invent.js';
import { deleteObject } from './shk.js';
import { ACID_VENOM, BLINDING_VENOM, BOULDER, CREAM_PIE, EGG, ELVEN_ARROW, ELVEN_BOW, OBJECT_NAMES, OBJECT_PROPERTY, OBJECT_SUBTYPE, TALLOW_CANDLE, WAN_FIRE, WAN_STRIKING, WAX_CANDLE, } from './object_data.js';
import { dropObjectAtHero } from './object_drop.js';
import { makePlural, withIndefiniteArticle, verbForSubject } from './object_grammar.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { objectMaterial } from './o_init.js';
import { shipObject } from './dokick.js';
import { isPoisonableObject } from './object_properties.js';
import { splitObjectStack } from './object_stack.js';
import { definiteName, definiteObjectAction, objectCombatName, objectHasPersonalName, killerObjectName, observeObjectForNaming, simpleObjectName, } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { heroHasNoHands } from './polyself.js';
import { poisonHero } from './poison.js';
import { hitMonsterWithSupportedPotion } from './potion.js';
import { shouldMulchMissile } from './projectile.js';
import { projectileHitsIronBars } from './projectile_bars.js';
import { rayDamageType } from './zap.js';
import { displayRayName } from './ray_name.js';
import { castNativeRay } from './ray_attack.js';
import { capitalizedDefiniteName, rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { hitByPetrifyingEgg, touchPetrifies } from './stoning.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { snuffThrownCandle } from './thrown_object.js';
import { plineWithContinuation } from './pline.js';
import { requirePerceivedHero } from './monmove.js';
import { angerAttackedMonster, finishEnvironmentalMonsterDeath, finishMonsterKilled } from './mon.js';
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
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
const LIQUID = 1;
const WOOD = 8;
const PLASTIC = 18;
export function objectTypeName(object) {
    return object ? OBJECT_NAMES[object.otyp] || '' : '';
}
// C mthrowu.c:thitu(). The hero is struck by a missile thrown or shot by a
// monster: accuracy and damage rolls, poison, blinding payload, and the
// petrifying-egg edge.
async function hitHeroWithProjectile(shot, context) {
    const { state, source, random, rollOne, rollDice, publish, volley } = context;
    const object = shot.weapon;
    const hero = state.u;
    const zeroDamage = object.otyp === EGG || object.otyp === CREAM_PIE || object.otyp === BLINDING_VENOM;
    if (object.otyp === EGG && !touchPetrifies(object.corpsenm)) {
        await impossible(`monster throwing egg type ${object.corpsenm ?? NON_PM}`, { state });
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
        ...(volley ? { volley } : {}),
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
// C mthrowu.c:drop_throw(). A spent missile lands, breaks, or suffers floor
// effects where it stops.
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
// C mthrowu.c:monmulti(). Role and launcher multipliers decide how many
// missiles leave the source's hands in one volley.
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
// C mthrowu.c:monmulti().
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
// C mthrowu.c:monshoot(). Announces the volley, then throws each missile in
// turn; a dead shooter cancels the shots that remain.
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
            // C singular() names the stack itself, so xname() observes it.
            observeObjectForNaming(weapon, { state });
            const single = { ...weapon, quan: 1, quantity: 1 };
            const name = objectCombatName(single, { state });
            appearance = objectHasPersonalName(single, state)
                ? capitalizedDefiniteName(name, state).replace(/^The /u, 'the ') : withIndefiniteArticle(name);
        }
        // C monshoot() names the target with some_mon_nam() before Monnam(source).
        const targetName = target ? monsterName(target, {
            state, augmentIt: true, suppressSaddle: !!MGIVENNAME(target),
        }) : '';
        await publish(`${monsterName(source, { state, capitalized: true })} ${launched ? 'shoots' : 'throws'} ${appearance}${target ? ` at ${targetName}` : ''}!`);
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
// C mthrowu.c:ohitmon(). An object launched by a monster strikes another
// monster; shades shrug it off, potions burst, and silver, poison, venom, and
// petrifying eggs apply before the drop.
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
        await revealMonsterAppearance(defender);
    defender.msleeping = 0;
    if (object.oclass === POTION_CLASS) {
        const potion = await hitMonsterWithSupportedPotion({
            state, monster: defender, potion: object, target: point, publish,
            wakeNearby: (x, y, distance) => wakeMonstersNearWithMessages(x, y, distance, state, publish),
            resolveVapor: true,
            // potionhit measures vapor distance from the monster's head.
            distance: dist2(state.u.ux, state.u.uy, defender.mx, defender.my),
            // C ohitmon() uses POTHIT_OTHER_THROW, so the hero is never at
            // fault; holy water and rust still end in killed() there.
            heroCaused: false,
            finishKill: (victim, options) => finishHeroMonsterKillOutcome(victim, victim.mx, victim.my, options),
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
// C mthrowu.c:ucatchgem(). A polymorphed unicorn hero catches a thrown gem.
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
// C mthrowu.c:u_catch_thrown_obj(). An adept, unencumbered hero may snatch a
// missile out of the air.
async function catchThrownObject(object, { state, random, publish }) {
    const hero = state.u;
    // freehand() can reveal a welded curse, so keep the native eligibility order.
    if (heroIsBlind(state) || hero.confused || hero.stunned || hero.fumbling
        || object.oclass === VENOM_CLASS || heroHasNoHands(state) || !heroHasFreeHand(state)
        || calcCapacity(state, object.owt) > SLT_ENCUMBER)
        return false;
    const chance = 100 - currentAttribute(A_DEX, state)
        - (state.urole.key === 'monk' || state.urole.key === 'rogue' ? 20 : 0);
    if (random(chance) !== 0)
        return false;
    const name = simpleObjectName(object, state);
    await holdAnotherObject(object, {
        state, publish, dropMessage: `You catch, but drop, the ${name}.`,
        holdMessage: `You catch the ${name}!`,
    });
    return true;
}
// ---------------------------------------------------------------------------
// Native m_throw() and bhit() tmp_at flight. Impacts run between frames, so a
// suspended hit message retains the last flight cell until the input resumes.
// ---------------------------------------------------------------------------
export function monsterProjectileDisplay(object, state, { tethered = false, } = {}) {
    const glyph = transientObjectGlyph(object);
    const topRow = state.nhDisplay?.grid[0]?.map(cell => ({ ...cell }));
    const retainedTopline = !state._pending_message && topRow?.some(cell => cell.ch !== ' ') ? topRow : null;
    const effect = new TemporaryMapEffect(tethered ? 'tether' : 'flash', glyph);
    let first = true;
    async function flushFrame() {
        const cursor = lastDirtyMapCursor();
        await flush_screen(1);
        if (retainedTopline && !state._pending_message) {
            for (const [column, cell] of retainedTopline.entries())
                state.nhDisplay?.setCell(column, 0, cell.ch, cell.color, cell.attr);
        }
        if (cursor)
            state.nhDisplay?.setCursor(...cursor);
        await state.animationFrame?.();
    }
    async function clear() {
        await effect.clear();
    }
    return {
        glyph,
        async show(position) {
            if (!isok(position.x, position.y))
                return;
            if (first)
                await effect.start();
            first = false;
            // Native tmp_at() stops before show_glyph() and its
            // flush_screen(0) when the flash cell cannot be seen, so an
            // impact that just blinded the hero hides its trailing frame
            // and any pending status update stays unpublished; the
            // caller's nh_delay_output() still runs.
            if (await effect.draw(position.x, position.y))
                await flushFrame();
            else
                await state.animationFrame?.();
        },
        async backtrack() {
            // DISP_END/BACKTRACK moves inward before the first return frame.
            while (await effect.retract()) {
                await flushFrame();
            }
            await clear();
        },
        clear,
    };
}
// C mthrowu.c:m_throw(). Detaches one missile from the thrower and flies it
// along its line; each projectile completes its visible flight and world
// effects before the next is detached.
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
                dropTether: async () => await flightDisplay.clear(),
            });
        }
    }
    finally {
        await display?.clear();
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
export async function returnMonsterWeapon(monster, weapon, impactX, impactY, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, animateReturn, dropTether, } = {}) {
    const impaired = monster.mconf || monster.mstun || monster.mblinded;
    const visible = canSeeMonster(monster);
    const name = () => monsterName(monster, { state });
    let x = impactX, y = impactY;
    if (random(100)) {
        await animateReturn?.();
        x = monster.mx;
        y = monster.my;
        if (!impaired && random(100)) {
            const lastMessage = state.lastMonsterWeaponReturnMessage;
            if (!lastMessage || state.moves - lastMessage > 500) {
                await publish(`${definiteObjectAction(weapon, 'return', state)} to ${possessiveName(name())} ${monsterHandName(monster.mnum)}!`);
                state.lastMonsterWeaponReturnMessage = state.moves;
            }
            const carried = await linkObjectToMonsterInventory(monster, weapon, { state });
            if (!carried)
                throw new Error('A caught returning weapon must enter monster inventory');
            monster.mw = carried;
            carried.owornmask = (carried.owornmask ?? 0) | W_WEP;
            carried.worn = true;
            carried.wielded = true;
            if (cansee(x, y))
                await newsym(x, y);
            // C return_from_mtoss() then falls through to its closing redraw.
            if (cansee(x, y))
                await newsym(x, y);
            return;
        }
        let damage = random(2);
        if (!damage) {
            if (visible) {
                const feet = makePlural(monsterFootName(monster.mnum));
                await publish(`${definiteObjectAction(weapon, 'return', state)} back to ${name()}, landing at ${monsterPossessive(monster, { state })} ${feet}.`);
            }
            else if (!heroIsDeaf(state)) {
                await publishHeardMessage(`Something land near ${name()}.`, publish, state);
            }
        }
        else {
            damage += rollOne(3);
            if (visible) {
                // C uses body_part(ARM), which describes the hero's form.
                await publish(`${definiteObjectAction(weapon, 'fly', state)} back toward ${name()}, hitting ${monsterPossessive(monster, { state })} ${heroArmName(state)}!`);
            }
            else if (!heroIsDeaf(state)) {
                await publishHeardMessage(`something hit ${name()} with a thud!`, publish, state);
            }
            if (weapon.oartifact) {
                // C mthrowu.c:934-936: the weapon itself struck its thrower,
                // so artifact_hit() runs with no attacker and may add its
                // own damage and messages before mhp loses the total.
                const artifact = await applyArtifactHit(weapon, monster, damage, {
                    state, publish, random, rollOne,
                });
                if ('damage' in artifact)
                    damage = artifact.damage;
            }
            monster.mhp -= damage;
            if (monster.mhp <= 0) {
                await finishMonsterKilled(monster, state, {
                    publish, random, damageType: AD_PHYS,
                    cause: canSpotMonster(monster) ? '' : null,
                });
            }
        }
    }
    else {
        await dropTether?.();
        await publishHeardMessage('a loud snap!', publish, state);
    }
    const options = { state: requireInitializedGame(state), publish, random };
    await snuffThrownCandle(weapon, state, publish);
    if (!await shipObject(weapon, x, y, options)) {
        const landed = await landFloorObject(weapon, x, y, { ...options, verb: 'drop' });
        if (!landed) {
            if (cansee(x, y))
                await newsym(x, y);
            return;
        }
    }
    if (!heroIsDeaf(state) && !state.underwater && !state.u.uinwater) {
        const material = objectMaterial(weapon, state);
        const flammable = ![TALLOW_CANDLE, WAX_CANDLE, WAN_FIRE].includes(weapon.otyp)
            && OBJECT_PROPERTY[weapon.otyp] !== 'fireResistance'
            && (material <= WOOD && material !== LIQUID || material === PLASTIC);
        if (isPoolAt(x, y, state) || isLavaAt(x, y, state) && !flammable)
            await publish(objectWeight(weapon) > 9 ? 'Splash!' : 'Plop!');
    }
    if (objectShedsLight(weapon))
        state.vision_full_recalc = 1;
    if (cansee(x, y))
        await newsym(x, y);
}
// C mthrowu.c:thrwmm() and thrwmu() open with the same weapon_check swap.
// Switching to a launcher consumes this action. If no launcher is needed,
// or the correct launcher is already wielded, the monster may shoot now.
export async function readyRangedMonsterWeapon(monster, state = game) {
    const current = monsterWieldedWeapon(monster);
    if (monster?.weaponCheck !== NEED_WEAPON && current)
        return null;
    monster.weaponCheck = NEED_RANGED_WEAPON;
    return wieldMonsterWeapon(monster, state);
}
// C mthrowu.c:thrwmm().
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
// C mthrowu.c:thrwmm(). A weapon change spends the slot without a hit.
export async function resolveMonsterCombatThrow(source, target, { state, random, rollOne, publish, }) {
    const volley = await throwMonsterWeaponAtMonster(source, target, state, {
        ...(random ? { random } : {}), ...(rollOne ? { rollOne } : {}), ...(publish ? { publish } : {}),
    });
    return {
        nativeResult: volley?.madeAttack ? M_ATTK_HIT : M_ATTK_MISS,
        heroDied: volley?.heroDied ?? false,
    };
}
export function resolveMonsterCombatSpit(source, target, attack, options) {
    return spitAtTarget(source, target, attack, options);
}
export function resolveMonsterSpitAtHero(source, attack, options) {
    return spitAtTarget(source, null, attack, options);
}
async function spitAtTarget(source, target, attack, { state, random = rn2, rollOne = rnd, publish = plineWithContinuation, }) {
    requireLiveGame(state);
    if (source.mcan) {
        await reportDryThroat(source, state, publish);
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    }
    const aligned = target
        ? monsterLinedUpWithMonster(source, target, state)
        : monsterLinedUpWithHero(source, state, random);
    if (!aligned)
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    const targetX = target ? target.mx : source.mux ?? 0;
    const targetY = target ? target.my : source.muy ?? 0;
    const blinding = attack[1] === AD_BLND || attack[1] === AD_DRST;
    if (!blinding && attack[1] !== AD_ACID)
        await impossible('bad attack type in spitmm');
    const venomType = blinding ? BLINDING_VENOM : ACID_VENOM;
    const venom = await mksobj(venomType, true, false);
    const distance = distmin(source.mx, source.my, targetX, targetY);
    if (random(BOLT_LIM - distance)) {
        await deleteObject(venom, state);
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    }
    if (canSeeMonster(source))
        await publish(`${monsterName(source, { state, capitalized: true })} spits venom!`);
    const flight = await throwMonsterProjectile(source, venom, {
        state, dx: Math.sign(targetX - source.mx), dy: Math.sign(targetY - source.my),
        range: distance, target, random, rollOne, publish,
    });
    if (flight.heroDied)
        return { nativeResult: M_ATTK_HIT, heroDied: true };
    endVoluntaryMultiTurn(state);
    if (source.mtame && !source.isminion) {
        const pet = source.edog ?? source.mextra?.edog;
        if (!pet)
            throw new Error(`Spitting pet ${source.m_id} has no pet state.`);
        if (pet.hungrytime > 1)
            pet.hungrytime -= 5;
    }
    return { nativeResult: M_ATTK_HIT, heroDied: false };
}
async function reportDryThroat(source, state, publish) {
    if (heroIsDeaf(state)
        || dist2(source.mx, source.my, state.u.ux, state.u.uy) >= BOLT_LIM * BOLT_LIM)
        return;
    if (canSpotMonster(source)) {
        const owner = possessiveName(monsterName(source, { state }));
        await publish(`A dry rattle comes from ${owner} throat.`);
    }
    else {
        const message = formatHeardMessage('a dry rattle nearby.', state);
        if (message)
            await publish(message);
    }
}
export async function resolveMonsterCombatBreath(source, target, attack, { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
    const damageType = attack[1] === AD_RBRE ? rayDamageType(random(8)) : attack[1];
    if (!monsterLinedUpWithMonster(source, target, state))
        return { nativeResult: M_ATTK_HIT, heroDied: false };
    if (source.mcan) {
        if (!heroIsDeaf(state)) {
            if (canSeeMonster(source))
                await publish(`${monsterName(source, { state, capitalized: true })} coughs.`);
            else
                await publishHeardMessage('a cough.', publish, state);
        }
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    }
    if (source.mspec_used || !random(3))
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    if (damageType < AD_MAGM || damageType > AD_SPC2) {
        await impossible(`Breath weapon ${damageType - 1} used`, { state });
        return { nativeResult: M_ATTK_HIT, heroDied: !!state.program_state.gameover };
    }
    if (canSeeMonster(source)) {
        const name = monsterName(source, { state, capitalized: true });
        const weapon = heroIsHallucinating(state)
            ? displayRayName(damageType, 'breath', { state, random }).replace(/^blast of /, '')
            : breathWeaponName(damageType);
        await publish(`${name} breathes ${weapon}!`);
    }
    const ray = await breatheFromMonster(source, target, {
        state, random, rollOne, rollDice, publish,
        attack: [attack[0], damageType, attack[2], attack[3]],
    });
    if (ray.heroDied)
        return { nativeResult: M_ATTK_HIT, heroDied: true };
    endVoluntaryMultiTurn(state);
    source.mspec_used = 8 + random(18);
    if (source.mtame && !source.isminion) {
        const pet = source.edog || source.mextra?.edog;
        if (!pet)
            throw new Error(`Breathing pet ${source.m_id} has no feeding state`);
        if (pet.hungrytime >= 10)
            pet.hungrytime -= 10;
    }
    return { nativeResult: M_ATTK_HIT, heroDied: false };
}
// C mthrowu.c:breamu() -> breamm() with &gy.youmonst as the target
// (mthrowu.c:1275-1278, 1093-1155). The mattacku() AT_BREA case awaits
// this one transaction: m_lined_up(), the mcan cough, the seen-resistance
// and recharge gates, the breath line, dobuzz(), nomul(0) and the
// recharge, sleep and pet-hunger tail all run in C order here.
export async function resolveMonsterBreathAtHero(monster, attack, { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
    let damageType = attack[1];
    const dice = attack[2];
    if (damageType === AD_RBRE)
        damageType = 1 + random(8);
    if (!monsterLinedUpWithHero(monster, state, random))
        return { nativeResult: M_ATTK_HIT, heroDied: false };
    if (monster.mcan) {
        // C mthrowu.c:1101-1108: a cancelled breather only coughs.
        if (!heroIsDeaf(state)) {
            if (canSeeMonster(monster))
                await publish(`${monsterName(monster, { state, capitalized: true })} coughs.`);
            else
                await publishHeardMessage('a cough.', publish, state);
        }
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    }
    // C mthrowu.c:1110-1113: skip a hero the monster has seen resist the
    // element, or that reflects at bow range.
    if ((monster.seen_resistance || 0) & (seenResistanceForDamage(damageType) | M_SEEN_REFL))
        return { nativeResult: M_ATTK_HIT, heroDied: false };
    // C mthrowu.c:1114-1115: a recharging monster, or a two-in-three lull,
    // spends the slot without a message.
    if ((monster.mspec_used ?? 0) || random(3) === 0)
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    if (damageType < AD_MAGM || damageType > AD_SPC2) {
        await impossible(`Breath weapon ${damageType - 1} used`, { state });
        return { nativeResult: M_ATTK_HIT, heroDied: !!state.program_state.gameover };
    }
    if (canSeeMonster(monster)) {
        const weapon = heroIsHallucinating(state)
            ? displayRayName(damageType, 'breath', { state, random }).replace(/^blast of /, '')
            : breathWeaponName(damageType);
        await publish(`${monsterName(monster, { state, capitalized: true })} breathes ${weapon}!`);
    }
    // dobuzz() follows the line m_lined_up() retained towards the hero's
    // remembered square; gt.tbx/tby are that delta's signs.
    const targetX = isFiniteNumber(monster.mux) ? monster.mux : (state?.u?.ux ?? monster.mx);
    const targetY = isFiniteNumber(monster.muy) ? monster.muy : (state?.u?.uy ?? monster.my);
    const dx = Math.sign(targetX - monster.mx);
    const dy = Math.sign(targetY - monster.my);
    const direction = [
        ['y', 'k', 'u'],
        ['h', null, 'l'],
        ['b', 'j', 'n'],
    ][dy + 1]?.[dx + 1];
    if (!direction)
        throw new Error('A launched breath needs a nonzero unit direction');
    const result = await castNativeRay(-(20 + damageType - 1), dice, direction, {
        state,
        sourceMonster: monster,
        originX: monster.mx,
        originY: monster.my,
        publish,
        random,
        rollDice,
        rollOne,
        sayHit: true,
        sayMiss: true,
    });
    if (result.heroDied)
        return { nativeResult: M_ATTK_HIT, heroDied: true };
    // C mthrowu.c:1128: nomul(0) — a breath never spends the hero's next
    // movement ration.
    endVoluntaryMultiTurn(state);
    // C mthrowu.c:1131-1133: breath runs out sometimes; a monster whose
    // target fell asleep keeps its charge.
    if (!random(3))
        monster.mspec_used = 8 + random(18);
    if (damageType === AD_SLEE && !state.u.sleepResistance)
        monster.mspec_used = (monster.mspec_used || 0) + rollOne(20);
    // C mthrowu.c:1138-1144: a pet grows hungrier; minions do not.
    if (monster.mtame && !monster.isminion && monster.edog && monster.edog.hungrytime >= 10)
        monster.edog.hungrytime -= 10;
    return { nativeResult: M_ATTK_HIT, heroDied: false };
}
// C mthrowu.c:thrwmu(). Readies the launcher, then throws the selected
// weapon at the hero; a polearm pokes instead, and a returning weapon only
// flies inside its Mjollnir-band squared distance.
export async function attackHeroWithRangedWeapon(monster, state, random, rollOne, calls, publish) {
    requirePerceivedHero(monster);
    if (await readyRangedMonsterWeapon(monster, state)) {
        return;
    }
    const weapon = selectMonsterRangedWeapon(monster, state)?.weapon;
    if (!weapon)
        return;
    if (isPolearm(weapon)) {
        await attackHeroWithPolearm(monster, weapon, state, { random, rollOne });
        return;
    }
    const returnRange = returningWeaponRangeSquared(weapon);
    const returning = returnRange !== null && !willWeld(weapon);
    if (returning &&
        (dist2(monster.mx, monster.my, monster.mux, monster.muy) > returnRange ||
            !couldsee(monster.mx, monster.my)))
        return;
    if (!monsterLinedUpWithPerceivedHero(monster, state, random, calls))
        return;
    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const distance = distmin(monster.mx, monster.my, heroX, heroY);
    const previousDistance = distmin(monster.mx, monster.my, state?.u?.ux0 ?? heroX, state?.u?.uy0 ?? heroY);
    if (distance > previousDistance &&
        !returning &&
        recordRandom(random, calls, BOLT_LIM - distmin(monster.mx, monster.my, monster.mux, monster.muy)) !== 0)
        return;
    return await throwMonsterWeaponAtHero(monster, state, weapon, {
        random: (range) => recordRandom(random, calls, range),
        rollOne, publish,
    });
}
export async function attackHeroWithPolearm(monster, weapon, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    if (!isPolearm(weapon) || weapon !== monsterWieldedWeapon(monster))
        return;
    if (monster.mux === undefined || monster.muy === undefined)
        throw new Error('A polearm attack requires a perceived hero position');
    const distance = (monster.mx - monster.mux) ** 2 + (monster.my - monster.muy) ** 2;
    if (distance > 5 || !couldsee(monster.mx, monster.my))
        return;
    if (canSeeMonster(monster)) {
        const name = objectCombatName(weapon, { state });
        const description = objectHasPersonalName(weapon, state)
            ? definiteName(name, state) : withIndefiniteArticle(name);
        const verb = monsterWeaponSwingVerb(weapon, distance <= 2, random);
        await publish(`${monsterSentenceSubject(monster)} ${verb} ${description}.`);
    }
    let damage = Math.max(1, rollPhysicalWeaponDamageAgainstHero(weapon, state, { rollOne }));
    if (state.u.halfPhysicalDamage)
        damage = Math.ceil(damage / 2);
    const heroDistance = Math.max(Math.abs(state.u.ux - monster.mx), Math.abs(state.u.uy - monster.my));
    let accuracy = Math.max(-4, 3 - heroDistance) + 8 + (weapon.spe ?? 0);
    if ((MONSTER_SIZE[heroSpecies(state)] ?? 0) >= 3)
        accuracy++;
    const result = await hitHeroWithObject(weapon, damage, accuracy, { state, publish, rollOne });
    if (!result.died)
        await stopHeroOccupation(state, publish);
}
// C mthrowu.c:m_throw() and thrwmu() end in a throw at the hero.
export async function throwMonsterWeaponAtHero(source, state, weapon, options = {}) {
    requirePlayingGame(state);
    return { ...await launchVolley(source, weapon, null, state, options), targetKind: 'hero', aimedAt: null };
}
// C mthrowu.c:blocking_terrain().
export function blockingTerrain(state, x, y) {
    if (!isok(x, y))
        return true;
    const square = state.level.at(x, y);
    return !square || IS_OBSTRUCTED(square.typ)
        || IS_DOOR(square.typ) && !!((square.doormask ?? 0) & (D_CLOSED | D_LOCKED))
        || IS_WATERWALL(square.typ) || square.typ === LAVAWALL;
}
// C mthrowu.c:linedup().
function linedUp(source, target, state, boulders, random) {
    const dx = target.x - source.mx;
    const dy = target.y - source.my;
    if ((!dx && !dy) || (dx && dy && Math.abs(dx) !== Math.abs(dy))
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM)
        return false;
    const targetsHeroSquare = target.x === state.u.ux && target.y === state.u.uy;
    const clear = targetsHeroSquare
        ? !!((state.viz_array?.[source.my]?.[source.mx] ?? 0) & COULD_SEE)
        : clearPath(target.x, target.y, source.mx, source.my);
    if (clear)
        return true;
    if (boulders === 'block')
        return false;
    const stepX = Math.sign(dx), stepY = Math.sign(dy);
    let x = source.mx, y = source.my;
    let boulderSquares = 0;
    do {
        x += stepX;
        y += stepY;
        if (blockingTerrain(state, x, y))
            return false;
        if ((state.level.objects[x]?.[y] ?? []).some(object => object.otyp === BOULDER))
            boulderSquares++;
    } while (x !== target.x || y !== target.y);
    return boulders === 'ignore' || random(2 + boulderSquares) < 2;
}
const M2_ROCKTHROW = 0x08000000;
export function monsterLinedUpWithMonster(source, target, state) {
    return linedUp(source, { x: target.mx, y: target.my }, state, 'block', rn2);
}
export function monsterLinedUpWithHero(source, state, random = rn2) {
    const appearance = M_AP_TYPE(state.u);
    if (Upolyd(state.u) && random(25)
        && (state.u.uundetected
            || appearance !== M_AP_NOTHING && appearance !== M_AP_MONSTER))
        return false;
    const inventory = source.minvent ?? source.inventory ?? [];
    const ignoresBoulders = !!((MONSTER_FLAGS2[source.mnum] ?? 0) & M2_ROCKTHROW)
        || inventory.some(object => object.otyp === WAN_STRIKING);
    // A native monster that has not located the hero has zeroed mux/muy.
    const target = { x: source.mux ?? 0, y: source.muy ?? 0 };
    return linedUp(source, target, state, ignoresBoulders ? 'ignore' : 'chance', random);
}
// C mthrowu.c:m_lined_up().  Ranged natural attacks aim at the monster's
// retained apparent hero coordinate, not necessarily the live hero square.
// A polymorphed hero's concealment test precedes the geometric line check.
export function monsterLinedUpWithPerceivedHero(monster, state, random, calls) {
    return monsterLinedUpWithHero(monster, state, range => recordRandom(random, calls, range));
}
// C mthrowu.c:m_useup(): remove one item from a monster's inventory,
// preserving the remaining stack's identity.
export async function consumeMonsterItem(monster, object, state) {
    if (object.quan > 1) {
        object.quan--;
        object.quantity = object.quan;
        object.owt = objectWeight(object);
    }
    else if (!await destroyObjectFromMonsterInventory(monster, object, state)) {
        throw new Error('A used monster item must belong to its monster.');
    }
}
//# sourceMappingURL=mthrowu.js.map