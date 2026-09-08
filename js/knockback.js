// A physical blow can throw a much smaller opponent backward.
// C uhitm.c:mhitm_knockback() and m_is_steadfast().

import { artifactById } from './artifacts.js';
import {
    D_BROKEN, DISMOUNT_KNOCKED, DOOR, IS_POOL, Is_airlevel, Is_waterlevel,
    W_SADDLE, isok,
} from './const.js';
import {
    canSeeMonster, canSpotMonster, plineWithContinuation, randomDisplayMonsterSubject,
} from './display.js';
import { game } from './gstate.js';
import { canKnockHeroToward, hurtleHero } from './hero_hurtle.js';
import {
    AD_PHYS, AD_STCK, AD_WRAP, AT_BUTT, AT_CLAW, AT_ENGL, AT_HUGS, AT_KICK, AT_WEAP,
} from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL } from './monster_data.js';
import { hurtleMonster, staggerVerb, willMonsterHurtle } from './monster_hurtle.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { LOADSTONE } from './object_data.js';
import { isBluntWeapon, isFlimsyObject } from './object_properties.js';
import { rn2 } from './rng.js';
import { dismountHero } from './steed.js';
import { heroIsUnaware } from './teleport.js';

const M1_FLY = 0x00000001;
const M1_UNSOLID = 0x00100000;
const S_EYE = 5;
const S_LIGHT = 25;

function species(actor, state) {
    return actor === state.u ? actor.umonnum : actor.mnum;
}

function inventory(actor, state) {
    return actor === state.u ? state.inventory : actor.minvent;
}

function wieldedWeapon(actor, state) {
    return actor === state.u ? state.uwep : monsterWieldedWeapon(actor);
}

function isSteadfast(actor, state) {
    const hero = actor === state.u;
    const mnum = species(actor, state);
    const floating = hero ? actor.levitating || actor.levitation || actor.flying
        : (MONSTER_FLAGS1[mnum] & M1_FLY)
            || [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[mnum]);
    if (floating || Is_airlevel(state.u.uz)
        || (Is_waterlevel(state.u.uz)
            && !IS_POOL(state.level.at(state.u.ux, state.u.uy).typ))) return false;
    if (artifactById(wieldedWeapon(actor, state)?.oartifact)?.name === 'Giantslayer')
        return true;
    return (inventory(actor, state) || []).some(object => object.otyp === LOADSTONE)
        || (actor === state.u.usteed
            && state.inventory.some(object => object.otyp === LOADSTONE));
}

function monsterObjectName(monster) {
    if (!canSpotMonster(monster, monster.mx, monster.my)) return 'something';
    const name = monsterSubject(monster).replace(/^The /u, 'the ');
    return monster.mtame ? name.replace(/^the /u, 'your ') : name;
}

function monsterSubject(monster) {
    if (!canSpotMonster(monster, monster.mx, monster.my)) return 'It';
    return game.u.hallucinating || game.u.hallucinationTurns > 0
        ? randomDisplayMonsterSubject() : monsterSentenceSubject(monster);
}

export async function tryKnockback(attacker, defender, attack, {
    state = game, random = rn2, publish = plineWithContinuation,
    weaponUsed = false, hit = true, finishMonsterDeath, finishLiquidDeath,
    nameMonster = monsterObjectName, wakeDefender,
} = {}) {
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

    const heroAttacks = attacker === state.u;
    const heroTarget = defender === state.u;
    let movingHero = heroTarget;
    const x = heroTarget ? defender.ux : defender.mx;
    const y = heroTarget ? defender.uy : defender.my;
    const dx = Math.sign(x - (heroAttacks ? attacker.ux : attacker.mx));
    const dy = Math.sign(y - (heroAttacks ? attacker.uy : attacker.my));
    if (heroTarget) {
        if (!canKnockHeroToward(dx, dy)) return { knocked: false };
    } else {
        if (!isok(x + dx, y + dy)) return { knocked: false };
        const doorway = state.level.at(x, y);
        if (dx && dy && doorway.typ === DOOR && (doorway.doormask & ~D_BROKEN))
            return { knocked: false };
    }

    let target = defender;
    let dismount = false;
    if (heroTarget && state.u.usteed) {
        const saddle = state.u.usteed.minvent.find(object => object.owornmask & W_SADDLE);
        if (saddle?.cursed) {
            target = state.u.usteed;
            movingHero = false;
        } else dismount = true;
    }
    if ((!heroAttacks && (attacker.dead || attacker.mhp <= 0))
        || (!movingHero && (target.dead || target.mhp <= 0))) return { knocked: false };
    if (MONSTER_SIZE[attackerForm] <= MONSTER_SIZE[species(target, state)] + 1)
        return { knocked: false };
    if (weapon && (isFlimsyObject(weapon) || !isBluntWeapon(weapon)))
        return { knocked: false };
    if ((MONSTER_FLAGS1[attackerForm] & M1_UNSOLID)
        || ((heroAttacks || movingHero) && !hit)) return { knocked: false };

    if (isSteadfast(target, state)) {
        if (movingHero || target === state.u.usteed) {
            await publish(state.u.usteed
                ? `You and ${nameMonster(state.u.usteed)} don't budge.` : "You don't budge.");
        } else if (canSeeMonster(target, target.mx, target.my)) {
            await publish(`${monsterSubject(target)} doesn't budge.`);
        }
        return { knocked: false };
    }

    const openPath = movingHero || willMonsterHurtle(target, state, x + dx, y + dy);
    const how = dismount ? 'out of your saddle' : openPath ? 'backward' : 'back';
    if (movingHero || canSeeMonster(target, target.mx, target.my)) {
        const subject = heroAttacks ? 'You' : monsterSubject(attacker);
        let object = heroTarget ? 'you' : nameMonster(target);
        if (heroTarget && !movingHero) object += ` and ${nameMonster(target)}`;
        const strength = random(2) ? 'forceful' : 'powerful';
        const blow = random(2) ? 'blow' : 'strike';
        await publish(`${subject} ${heroAttacks ? 'knock' : 'knocks'} ${object} ${how} with a ${strength} ${blow}!`);
    } else if (heroAttacks) {
        await publish(`You feel ${nameMonster(target)} be knocked ${how}!`);
    }

    if (heroAttacks || movingHero) state.u.ustuck = null;
    let moved;
    const level = state.level;
    if (movingHero) {
        if (dismount) {
            state.u.dx = dx;
            state.u.dy = dy;
            await dismountHero(DISMOUNT_KNOCKED, { state, random, announce: publish });
        } else await hurtleHero(dx, dy, distance, { finishMonsterDeath });
        moved = state.u.ux !== x || state.u.uy !== y;
        setMonsterApparentHeroPosition(attacker, state, random);
        if (!state.u.stunned && !(state.u.stunnedTurns > 0) && random(4) === 0) {
            if (!heroIsUnaware(state)) {
                await publish(state.u.usteed ? 'You wobble in the saddle.'
                    : `You ${staggerVerb(state.u.umonnum).replace(/s$/u, '')}...`);
            }
            state.u.stunnedTurns = distance + 1;
            state.u.stunned = true;
        }
    } else {
        const result = await hurtleMonster(target, dx, dy, distance, {
            state, announce: publish, nameMonster,
            wakeMonster: wakeDefender,
            finishLiquidDeath, finishMonsterDeath,
            monsterMoving: !heroAttacks, random,
        });
        moved = result.moved;
        if (!target.dead && target.mhp > 0 && random(4) === 0) {
            target.mstun = 1;
            if (target === state.u.usteed)
                setMonsterApparentHeroPosition(attacker, state, random);
        }
    }
    return {
        knocked: true, moved,
        defenderDied: heroTarget ? !!state.program_state.gameover : !!target.dead || target.mhp <= 0,
        aggressorDied: !heroAttacks && (!!attacker.dead || attacker.mhp <= 0),
        defenderLeftLevel: level !== state.level
            || (!heroTarget && target !== state.u.usteed && !state.level.monsters.includes(target)),
    };
}
