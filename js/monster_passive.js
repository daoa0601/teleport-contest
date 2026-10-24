// A monster's passive response when the hero or an object strikes it.
// C ref: uhitm.c passive() and passive_obj().
import { formatFeltMessage } from './hero_speech.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeStunned } from './hero_mental_status.js';
import { nomul } from './command_state.js';
import { changeHeroLuck, currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { heroSpecies } from './hero_species.js';
import { A_DEX, A_STR, A_WIS, STONING, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, } from './const.js';
import { canSeeMonster, displayLiquidName, plineWithContinuation, shieldeff, } from './display.js';
import { game } from './gstate.js';
import { damageHeroFromMonster } from './hero_damage.js';
import { healMonster } from './mon.js';
import { finishMonsterAttackDeath } from './monster_attack_death.js';
import { observeObjectForNaming, ownedObjectAction } from './objnam.js';
import { erodeArmor, erodeObject } from './object_erosion.js';
import { MONSTER_ATTACKS, MONSTER_NAME, MONSTER_RESISTS, monsterTypeName, requireMonsterData, } from './monster_data.js';
import { splitMonster } from './monster_clone.js';
import { monsterName as displayedMonsterName, namelessMonsterName, possessiveName } from './monster_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, } from './monster_perception.js';
import { AD_ACID, AD_COLD, AD_CORR, AD_ELEC, AD_ENCH, AD_FIRE, AD_MAGM, AD_PHYS, AD_PLYS, AD_RUST, AD_STON, AD_STUN, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { OBJECT_NAMES } from './object_data.js';
import { drainObjectEnchantment } from './object_state.js';
import { hasWornProperty } from './properties.js';
import { applyHeroGolemEffects, heroMonsterForm, polymonHero, } from './polyself.js';
import { heroReflectionSource, heroReflectsRay } from './ray.js';
import { d, rn2 } from './rng.js';
import { contactIsProtected, formCanBecomeStoneGolem } from './stoning.js';
const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_ELEC = 0x10;
const MR_ACID = 0x40;
const MR_STONE = 0x80;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_STONE_GOLEM = MONSTER_NAME.indexOf('stone golem');
export async function applyHeroContactPassive(monster, { hit, defenderSurvived = !monster.dead && monster.mhp > 0, attackType = AT_WEAP, weapon = null, weaponWasDestroyed = false, state = game, publish = plineWithContinuation, random = rn2, rollDice = d, die, } = {}) {
    const attack = passiveAttack(monster);
    if (!attack)
        return { handled: false, heroDied: false };
    const damageType = attack[1];
    const damage = passiveDamage(monster.m_lev, attack, rollDice);
    const context = {
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
    let surviving = {};
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
async function applyImmediatePassive(context) {
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
async function applyAcidPassive({ monster, damage, hit, attackType, weapon, state, publish, random, die, }) {
    let appliedDamage = 0;
    let heroDied = false;
    const splashed = hit && random(2) !== 0;
    if (splashed) {
        if (heroIsBlind(state) || state.flags?.verbose === false) {
            await publish('You are splashed!');
        }
        else {
            await publish(`You are splashed by ${possessiveName(displayedMonsterName(monster, { state }))} ${displayLiquidName('acid', state)}!`);
        }
        if (heroResistsAcid(state)) {
            monstersObserveHeroResistance(M_SEEN_ACID, state);
        }
        else {
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
    if (!heroDied)
        await exerciseAttribute(A_STR, false, state);
    return { splashed, appliedDamage, heroDied };
}
async function applyEquipmentPassive(context) {
    const { monster, hit, attackType, weapon, state, } = context;
    if (!hit || monster.mcan || !weapon
        || ![AT_KICK, AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH]
            .includes(attackType))
        return { heroDied: false };
    await applyMonsterPassiveToObject(monster, weapon, {
        carried: true,
        attackType,
        state,
    });
    return { heroDied: false };
}
async function applyStonePassive({ monster, hit, attackType, weaponWasDestroyed, state, publish, die, }) {
    const wornMask = (state.inventory || []).reduce((mask, object) => mask | (object.owornmask ?? 0), 0);
    // hmonas turns a small caster's spell slot into a hand strike. Its
    // contact needs the same insulation as a claw, rather than a spell.
    const contactType = attackType === AT_MAGC ? AT_CLAW : attackType;
    if (!hit || contactIsProtected(contactType, wornMask, !!(state.uwep || state.u.uwep) || weaponWasDestroyed) || heroResists(state, 'stoneResistance', MR_STONE)) {
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
            killer: monsterName(monster), deathVerb: 'turned to stone',
            deathLineShown: true, deathType: STONING,
        });
        return { heroDied, stopped: true };
    }
    return {
        heroDied: await finishMonsterAttackDeath(monster, { deathType: STONING }),
        stopped: true,
    };
}
async function applyMagicMissilePassive({ monster, damage, state, publish, die, }) {
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
async function applyEnchantmentPassive({ monster, hit, attackType, weapon, state, random, }) {
    if (!hit)
        return { heroDied: false };
    const object = objectTouchedByEnchantment(state, attackType, weapon, random);
    if (!object)
        return { heroDied: false };
    await applyMonsterPassiveToObject(monster, object, {
        carried: true,
        attackType,
        state,
        random,
    });
    return { heroDied: false };
}
async function applySurvivingMonsterPassive(context) {
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
async function applyParalysisPassive({ monster, damage, state, publish, random, }) {
    if (monster.mnum !== PM_FLOATING_EYE) {
        if (heroHasFreeAction(state)) {
            await publish('You momentarily stiffen.');
            return { resisted: true, heroDied: false };
        }
        await publish(`You are frozen by ${displayedMonsterName(monster, { state })}!`);
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
            await publish(`${reflectionOwner} gaze is reflected by your ${source?.noun || 'body'}.`);
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
    await publish(`${displayedMonsterName(monster, { state, capitalized: true, adjective: 'blind' })} cannot defend itself.`);
    if (random(500) === 0) {
        changeHeroLuck(-1, state);
    }
    return { heroDied: false };
}
async function applyColdPassive(context) {
    const { monster, damage, state, publish, random, die, } = context;
    if (!monsterNearHero(monster, state))
        return { heroDied: false };
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
    if (heroDied)
        return { appliedDamage: damage, heroDied };
    healMonster(monster, Math.trunc((damage + random(2)) / 2), Math.trunc((damage + 1) / 2));
    if ((monster.mhpmax ?? 0) > ((monster.m_lev ?? 0) + 1) * 8)
        await splitMonster(monster, state, { heatSource: 'hero', publish });
    return { appliedDamage: damage, heroDied: false };
}
async function applyStunPassive({ damage, state, publish }) {
    const hero = state.u;
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0 || damage <= 0)
        return { heroDied: false };
    await makeStunned(damage, { state, publish });
    return { heroDied: false };
}
async function applyFirePassive({ monster, damage, state, publish, die }) {
    if (!monsterNearHero(monster, state))
        return { heroDied: false };
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
async function applyElectricPassive({ monster, damage, state, publish, die }) {
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
async function damageHero(monster, amount, { state, publish, die }) {
    if (!die)
        return damageHeroFromMonster(monster, amount, { state, publish });
    return damageHeroFromMonster(monster, amount, {
        state, publish, die: async (victim) => die({ killer: monsterName(victim) }),
    });
}
function heroResists(state, property, mask) {
    const hero = state.u;
    if (hero[property] || hasWornProperty(property, state))
        return true;
    const form = heroMonsterForm(state);
    return form != null && ((MONSTER_RESISTS[form] ?? 0) & mask) !== 0;
}
function heroResistsAcid(state) {
    return heroResists(state, 'acidResistance', MR_ACID);
}
function heroResistsMagic(state) {
    const hero = state.u;
    if (hero.antimagic
        || hasWornProperty('antimagic', state))
        return true;
    const form = heroMonsterForm(state);
    if (form == null)
        return false;
    const name = MONSTER_NAME[form];
    return name === 'baby gray dragon'
        || (MONSTER_ATTACKS[form] || []).some(attack => attack[1] === AD_MAGM);
}
function objectTouchedByAttack(state, attackType, weapon) {
    if (attackType === AT_KICK)
        return weapon || state.uarmf || state.u?.uarmf || null;
    return [AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH].includes(attackType)
        ? weapon : null;
}
function objectTouchedByEnchantment(state, attackType, weapon, random = rn2) {
    if (attackType === AT_KICK)
        return weapon;
    if (attackType === AT_BITE || attackType === AT_BUTT
        || (attackType >= AT_STNG && attackType < AT_WEAP))
        return null;
    if (weapon)
        return weapon;
    // C passive_obj() with no object picks the secondary weapon half the
    // time while dual-wielding, then the gloves.
    const secondary = state.uswapwep || state.u?.uswapwep || null;
    if (state.u.twoweap && secondary && random(2) === 0)
        return secondary;
    return state.uwep || state.u?.uwep || state.uarmg || state.u?.uarmg || null;
}
// C uhitm.c:passive() sets nomovemsg to You_can_move_again for the cube and
// clears it for the floating eye, which unmul() also turns into that message.
function freezeHero(state, turns, reason) {
    state._occupation = null;
    nomul(-Math.max(0, turns), state);
    state._helplessReason = reason;
    state._helplessDoneMessage = 'You can move again.';
}
function monsterNearHero(monster, state) {
    return Math.max(Math.abs((monster.mx ?? 0) - (state.u?.ux ?? 0)), Math.abs((monster.my ?? 0) - (state.u?.uy ?? 0))) <= 1;
}
export function passiveAttack(monster) {
    if (!monster)
        return null;
    return (MONSTER_ATTACKS[monster.mnum] || []).find(([attackType]) => attackType === AT_NONE) || null;
}
export function passiveDamage(level, attack, rollDice) {
    const [, , dice, sides] = attack;
    if (dice > 0)
        return rollDice(dice, sides);
    if (sides > 0)
        return rollDice(level + 1, sides);
    return 0;
}
function monsterName(monster) {
    return monster.name || monsterTypeName(monster.mnum, !!monster.female);
}
function passiveParalysisReason(monster, state, gaze) {
    const species = namelessMonsterName(monster, {
        state, article: 'a', suppressIt: true, suppressInvisible: true,
        suppressHallucination: true, suppressSaddle: true,
    });
    return { monsterId: monster.m_id, text: `frozen by ${gaze ? `${possessiveName(species)} gaze` : species}` };
}
function isHeroDefender(defender, state) {
    return defender === state.u;
}
// passive_obj() also applies to the hero's current body after a missile hits.
// The caller still owns the object's eventual inventory or floor location.
export async function applyMonsterPassiveToObject(defender, object, { carried = object.where === 'inventory', attackType = null, state = game, publish = plineWithContinuation, random = rn2, } = {}) {
    const species = isHeroDefender(defender, state) ? heroSpecies(state) : defender.mnum;
    const passive = requireMonsterData(MONSTER_ATTACKS, species)
        .find(([method]) => method === AT_NONE);
    if (!passive)
        return;
    const type = passive[1];
    if (type === AD_ENCH) {
        if (defender.mcan)
            return;
        if (!await drainObjectEnchantment(object, { state, random, byHero: true }))
            return;
        if (carried)
            state._armorClassDirty = true;
        if (carried && (object.known || object.oclass === 3)) {
            observeObjectForNaming(object, { state });
            await publish(`${ownedObjectAction(object, 'seem', state)} less effective.`);
        }
        return;
    }
    let kind;
    if (type === AD_FIRE) {
        if (random(6) !== 0 || defender.mcan
            || (attackType !== AT_KICK
                && MONSTER_NAME[species] === 'steam vortex'))
            return;
        kind = 'burn';
    }
    else if (type === AD_RUST || type === AD_CORR) {
        if (defender.mcan)
            return;
        kind = type === AD_RUST ? 'rust' : 'corrosion';
    }
    else if (type === AD_ACID) {
        if (random(6) !== 0)
            return;
        kind = 'corrosion';
    }
    else {
        return;
    }
    await erodeObject(object, kind, {
        state, publish, random, verbose: attackType === AT_KICK,
        position: isHeroDefender(defender, state)
            ? { x: defender.ux, y: defender.uy }
            : { x: defender.mx, y: defender.my },
    });
}
//# sourceMappingURL=monster_passive.js.map