// A monster's passive response to another monster's melee attack.
// C mhitm.c:passivemm() and paralyze_monst().

import { canSeeMonster, canSpotMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { applyMonsterGolemEffects, healMonster, paralyzeMonster } from './mon.js';
import {
    AD_ACID, AD_COLD, AD_ELEC, AD_ENCH, AD_FIRE, AD_PLYS, AD_STUN,
} from './monster_attack_types.js';
import { splitMonster } from './monster_clone.js';
import { showMonsterCombatDeath } from './monster_combat_messages.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { staggerVerb } from './monster_hurtle.js';
import { passiveAttack, passiveDamage } from './monster_passive.js';
import {
    monsterHasAcidResistance, monsterHasColdResistance,
    monsterHasFireResistance, monsterHasShockResistance,
} from './monster_resistance.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { damageObjectWithAcid, erodeArmor } from './object_erosion.js';
import { learnObjectType } from './object_knowledge.js';
import { drainObjectEnchantment } from './object_state.js';
import { monsterReflectionSource } from './ray.js';
import { d, rn2 } from './rng.js';

const M1_NOEYES = 0x00001000;
const M1_SEE_INVIS = 0x01000000;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');

export async function applyMonsterContactPassive(attacker, defender, {
    hit, weapon = null, state = game, random = rn2, rollDice = d,
    publish = plineWithContinuation,
} = {}) {
    const passive = passiveAttack(defender);
    if (!passive) return { stopped: false };
    const type = passive[1];
    let damage = passiveDamage(defender.mnum, passive, rollDice);
    const visible = canSeeMonster(attacker, attacker.mx, attacker.my);

    if (type === AD_ACID) {
        if (hit && random(2) === 0) {
            if (visible)
                await publish(`${monsterSentenceSubject(attacker)} is splashed by ${possessive(defender)} acid!`);
            if (monsterHasAcidResistance(attacker)) {
                if (visible) await publish(`${monsterSentenceSubject(attacker)} is not affected.`);
                damage = 0;
            }
        } else damage = 0;
        if (random(30) === 0) await erodeArmor(attacker, 'corrosion', { state, random, publish });
        if (random(6) === 0)
            await damageObjectWithAcid(monsterWieldedWeapon(attacker), { state, random, publish });
    } else {
        if (type === AD_ENCH && hit && !defender.mcan && weapon)
            await drainObjectEnchantment(weapon, { random, state });
        if (defender.dead || defender.mhp <= 0 || defender.mcan || random(3) === 0)
            return { stopped: false };
        switch (type) {
        case AD_PLYS:
            return paralyzeAttacker(attacker, defender, damage, { state, random, publish, visible });
        case AD_COLD:
        case AD_FIRE:
        case AD_ELEC: {
            const resists = type === AD_COLD ? monsterHasColdResistance
                : type === AD_FIRE ? monsterHasFireResistance : monsterHasShockResistance;
            if (resists(attacker)) {
                if (visible) {
                    const feeling = type === AD_COLD ? 'chilly' : type === AD_FIRE ? 'warmed' : 'tingled';
                    await publish(`${monsterSentenceSubject(attacker)} is mildly ${feeling}.`);
                    await applyMonsterGolemEffects(attacker, type, damage, { state, publish });
                }
                damage = 0;
            } else {
                if (visible) {
                    const feeling = type === AD_COLD ? 'suddenly very cold'
                        : type === AD_FIRE ? 'suddenly very hot' : 'jolted with electricity';
                    await publish(`${monsterSentenceSubject(attacker)} is ${feeling}!`);
                }
                if (type === AD_COLD) {
                    const healing = Math.trunc(damage / 2);
                    healMonster(defender, healing, healing);
                    if (defender.mhpmax > (defender.m_lev + 1) * 8) {
                        const clone = splitMonster(defender, state, { monsterMoving: true, random });
                        if (clone && canSpotMonster(defender, defender.mx, defender.my))
                            await publish(`${monsterSentenceSubject(defender)} multiplies from ${possessive(attacker)} heat!`);
                    }
                }
            }
            break;
        }
        case AD_STUN:
            if (!attacker.mstun) {
                attacker.mstun = 1;
                if (visible)
                    await publish(`${monsterSentenceSubject(attacker)} ${staggerVerb(attacker.mnum)}...`);
            }
            damage = 0;
            break;
        default:
            damage = 0;
        }
    }

    attacker.mhp -= damage;
    if (attacker.mhp > 0) return { stopped: false, damage };
    await showMonsterCombatDeath(attacker, state);
    await finishEnvironmentalMonsterDeath(attacker, state, { random, publish });
    // C ends this attack sequence even when life saving revives the attacker.
    return { stopped: true, fatal: true, damage };
}

async function paralyzeAttacker(attacker, defender, duration, {
    state, random, publish, visible,
}) {
    duration = Math.min(127, duration);
    if (defender.mnum === PM_FLOATING_EYE) {
        if (random(4) === 0) duration = 127;
        const flags = MONSTER_FLAGS1[attacker.mnum];
        if (!attacker.mcansee || (flags & M1_NOEYES) || !defender.mcansee
            || (defender.minvis && !(flags & M1_SEE_INVIS))) {
            // passivemm returns M_ATTK_HIT here even after a missed attack.
            return { stopped: false, hit: true };
        }
        const reflection = monsterReflectionSource(attacker, state);
        if (reflection) {
            if (visible) {
                await publish(`${possessive(defender, true)} gaze is reflected by ${possessive(attacker)} ${reflection.noun}.`);
                if (['shield', 'amulet'].includes(reflection.noun))
                    learnObjectType(reflection.object.otyp, state);
            }
            return { stopped: false };
        }
        if (visible)
            await publish(`${monsterSentenceSubject(attacker)} is frozen by ${possessive(defender)} gaze!`);
    } else if (visible) {
        await publish(`${monsterSentenceSubject(attacker)} is frozen by ${monsterSentenceSubject(defender).replace(/^The /u, 'the ')}.`);
    }
    paralyzeMonster(attacker, duration);
    return { stopped: true };
}

function possessive(monster, capitalized = false) {
    const subject = monsterSentenceSubject(monster);
    const name = capitalized ? subject : subject.replace(/^The /u, 'the ');
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}
