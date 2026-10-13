// Retaliation from the hero's current or just-lost monster body.
// C mhitu.c:passiveum() and assess_dmg().
import { heroIsHallucinating } from './senses.js';
import { Upolyd } from './const.js';
import { canSpotMonster, plineWithContinuation, randomDisplayMonsterSubject, shieldeff, } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { splitHeroMonsterForm } from './mklev.js';
import { applyMonsterGolemEffects, paralyzeMonster } from './mon.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DGST, AD_DISE, AD_DISN, AD_DRCO, AD_DREN, AD_DRIN, AD_DRLI, AD_DRST, AD_DRDX, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RBRE, AD_RUST, AD_SAMU, AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPC1, AD_SPC2, AD_SPEL, AD_SSEX, AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BOOM, AT_NONE, AT_WEAP, } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_NAME, requireMonsterData } from './monster_data.js';
import { staggerVerb } from './monster_hurtle.js';
import { passiveDamage } from './monster_passive.js';
import { monsterHasAcidResistance, monsterHasColdResistance, monsterHasFireResistance, monsterHasShockResistance, monsterHasStoneResistance, } from './monster_resistance.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { petrifyMonsterAttacker } from './monster_stoning.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { damageObjectWithAcid, erodeArmor } from './object_erosion.js';
import { learnObjectType } from './object_knowledge.js';
import { drainObjectEnchantment } from './object_state.js';
import { returnHeroToHumanForm } from './polyself.js';
import { monsterReflectionSource } from './ray.js';
import { d, rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { contactIsProtected } from './stoning.js';
const M1_NOEYES = 0x00001000;
const M1_SEE_INVIS = 0x01000000;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
export async function applyHeroFormPassive(monster, oldForm, attackType, { state = game, random = rn2, rollDice = d, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    const passive = (MONSTER_ATTACKS[oldForm] || []).find(([method]) => method === AT_NONE || method === AT_BOOM);
    if (!passive)
        return { attackerStopped: false };
    const type = passive[1];
    let damage = passiveDamage(requireMonsterData(MONSTER_LEVEL, oldForm), passive, rollDice);
    const weapon = monsterWieldedWeapon(monster);
    if (type === AD_ACID) {
        if (random(2) === 0) {
            await publish(`${subject(monster)} is splashed by ${Upolyd(state.u) ? 'your ' : ''}acid!`);
            if (monsterHasAcidResistance(monster)) {
                await publish(`${subject(monster)} is not affected.`);
                damage = 0;
            }
        }
        else
            damage = 0;
        if (random(30) === 0)
            await erodeArmor(monster, 'corrosion', { state, random, publish });
        if (random(6) === 0)
            await damageObjectWithAcid(weapon, { state, random, publish });
        return damageAttacker(monster, damage, publish);
    }
    if (type === AD_STON) {
        if (monsterHasStoneResistance(monster)
            || contactIsProtected(attackType, monster.misc_worn_check ?? 0, !!weapon))
            return { attackerStopped: false };
        const petrification = await petrifyMonsterAttacker(monster, {
            publish, visible: true, creditHero: true,
            finishDeath: (target, death = {}) => finishHeroMonsterKill(target, target.mx, target.my, {
                ...death, showKillMessage: false, recordConduct: false,
            }),
        });
        if (petrification.heroDied)
            return { heroDied: true, attackerStopped: true };
        const died = !!monster.dead || monster.mhp <= 0;
        return { attackerDied: died, attackerStopped: died };
    }
    if (type === AD_ENCH) {
        if (attackType === AT_WEAP && weapon)
            await drainObjectEnchantment(weapon, { random, byHero: true, state });
        return { attackerStopped: false };
    }
    if (!Upolyd(state.u) || random(3) === 0)
        return { attackerStopped: false };
    switch (type) {
        case AD_PHYS:
            if (passive[0] === AT_BOOM) {
                await publish('You explode!');
                const restored = await returnHeroToHumanForm(state, { publish });
                if (restored.died)
                    return { heroDied: true, attackerStopped: true };
            }
            break;
        case AD_PLYS:
            return freezeAttacker(monster, damage, { state, random, publish });
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
            }
            else {
                const feeling = type === AD_COLD ? 'suddenly very cold'
                    : type === AD_FIRE ? 'suddenly very hot' : 'jolted with your electricity';
                await publish(`${subject(monster)} is ${feeling}!`);
                if (type === AD_COLD) {
                    state.u.mh += Math.trunc((damage + random(2)) / 2);
                    state.u.mhmax = Math.max(state.u.mhmax, state.u.mh);
                    const formLevel = MONSTER_LEVEL[state.u.umonnum];
                    if (formLevel !== undefined && state.u.mhmax > (formLevel + 1) * 8) {
                        const clone = await splitHeroMonsterForm(state);
                        if (clone)
                            await publish(`You multiply from ${possessive(monster)} heat!`);
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
    return damageAttacker(monster, damage, publish);
}
async function freezeAttacker(monster, turns, { state, random, publish }) {
    turns = Math.min(127, turns);
    if (state.u.umonnum === PM_FLOATING_EYE) {
        if (random(4) === 0)
            turns = 127;
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (!monster.mcansee || (flags & M1_NOEYES) || random(3) === 0
            || (heroIsInvisible(state) && !(flags & M1_SEE_INVIS)))
            return { attackerStopped: false };
        if (heroIsBlind(state)) {
            await publish('As a blind floating eye, you cannot defend yourself.');
            return { attackerStopped: false };
        }
        const reflection = monsterReflectionSource(monster, state);
        if (reflection) {
            await publish(`Your gaze is reflected by ${possessive(monster)} ${reflection.noun}.`);
            if (reflection.object && ['shield', 'amulet'].includes(reflection.noun))
                learnObjectType(reflection.object.otyp, state);
            return { attackerStopped: false };
        }
        await publish(`${subject(monster)} is frozen by your gaze!`);
    }
    else
        await publish(`${subject(monster)} is frozen by you.`);
    paralyzeMonster(monster, turns);
    return { attackerStopped: true };
}
async function damageAttacker(monster, damage, publish) {
    monster.mhp -= damage;
    if (monster.mhp > 0)
        return { attackerStopped: false, damage };
    await publish(`${subject(monster)} dies!`);
    await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
    const died = !!monster.dead || monster.mhp <= 0;
    return { attackerDied: died, attackerStopped: died, damage };
}
function subject(monster) {
    if (!canSpotMonster(monster))
        return 'It';
    return heroIsHallucinating(game)
        ? randomDisplayMonsterSubject() : monsterSentenceSubject(monster);
}
function possessive(monster) {
    const name = subject(monster).replace(/^The /u, 'the ');
    return name === 'It' ? 'its' : name.endsWith('s') ? `${name}'` : `${name}'s`;
}
//# sourceMappingURL=hero_form_passive.js.map