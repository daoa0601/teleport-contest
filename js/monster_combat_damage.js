// Native mhitm.c:mdamagem(). Effects own their special state changes;
// this owner settles pending damage, knockback, death, and kill growth.
import { artifactById } from './artifacts.js';
import { M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS } from './const.js';
import { isZombieMaker, zombieForm } from './corpse_species.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { tryKnockback } from './knockback.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DGST, AD_DISE, AD_DISN, AD_DRCO, AD_DREN, AD_DRIN, AD_DRLI, AD_DRST, AD_DRDX, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE, AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RBRE, AD_RUST, AD_SAMU, AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPC1, AD_SPC2, AD_SPEL, AD_SSEX, AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BITE, AT_CLAW, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { resolveMonsterBrainAttack } from './monster_brain_attack.js';
import { applyMonsterDigestionEffect, finishMonsterDigestion } from './monster_combat_digestion.js';
import { applyMonsterDrainEffect } from './monster_combat_drain.js';
import { applyMonsterElementEffect } from './monster_combat_elements.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import { applyMonsterStatusEffect } from './monster_combat_status.js';
import { applyMonsterTheftEffect } from './monster_combat_theft.js';
import { applyMonsterTransformEffect } from './monster_combat_transform.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { finishEnvironmentalMonsterDeath, finishMonsterKilled } from './monster_death.js';
import { finishMonsterGrowth, growMonster } from './monster_growth.js';
import { exposeEngulfedDefenderForDeath } from './monster_location.js';
import { resolveMonsterPhysicalDamage } from './monster_physical_damage.js';
import { poisonMonsterFromAttack } from './monster_poison.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { petrifyMonsterAttacker, petrifyMonsterDefender } from './monster_stoning.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { d, rn2, rnd } from './rng.js';
import { contactIsProtected, touchPetrifies } from './stoning.js';
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const S_TROLL = 46;
export async function resolveMonsterCombatDamage(attacker, defender, attack, { state = game, visible, weapon = null, dieRoll = 0, target = { x: defender.mx, y: defender.my }, notOnHead = state.notonhead, publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, calls = [], }) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const attackerSpecies = attacker.mnum;
    const defenderSpecies = defender.mnum;
    const damage = rollDice(attack[2], attack[3]);
    calls.push(`d(${attack[2]},${attack[3]})`);
    let death = null;
    function recordDeath(outcome) {
        death = { survived: outcome.survived, corpseCreated: !!outcome.corpse,
            corpse: outcome.corpse, growth: null, aggressor: attacker,
            ...(outcome.heroDied ? { heroDied: true } : {}) };
    }
    async function finishDeath(monster, options = {}) {
        const outcome = await finishEnvironmentalMonsterDeath(monster, state, {
            random, rollDice, publish, ...options,
        });
        if (monster === defender)
            recordDeath(outcome);
        return outcome;
    }
    async function growAttacker(victim) {
        const growth = growMonster(attacker, { victim, state, random, rollOne, calls });
        if (death)
            death.growth = growth;
        if (growth.changedSpecies) {
            if (canSpotMonster(attacker))
                await publish(growth.message);
            finishMonsterGrowth(attacker, growth);
            newsym(attacker.mx, attacker.my);
            if (growth.genocided)
                await finishDeath(attacker);
        }
        return { survived: growth.alive && attacker.mhp > 0 && !attacker.dead,
            heroDied: !!state.program_state.gameover };
    }
    const context = {
        state, attack, damage, visible, notOnHead,
        dieRoll, weapon, random, rollOne, rollDice, publish, finishDeath, growAttacker,
        applyPhysical: () => physicalEffect(attacker, defender, context),
        killDefender: async (options = {}) => {
            const outcome = await finishMonsterKilled(defender, state, {
                damageType: options.damageType ?? attack[1], random, rollDice, publish,
                ...(options.cause === undefined ? {} : { cause: options.cause }),
            });
            recordDeath(outcome);
            if (outcome.heroDied)
                return { nativeResult: M_ATTK_DEF_DIED, heroDied: true };
            if (outcome.survived)
                return { nativeResult: M_ATTK_MISS, heroDied: false };
            const growth = await growAttacker(defender);
            return { nativeResult: M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED),
                heroDied: growth.heroDied };
        },
    };
    const result = (effect) => ({
        damage: effect.damage, nativeResult: effect.nativeResult,
        heroDied: effect.heroDied, skipBrainDrain: !!effect.skipBrainDrain, death,
    });
    if ((touchPetrifies(defenderSpecies) || attack[1] === AD_DGST && defenderSpecies === PM_MEDUSA)
        && !monsterHasStoneResistance(attacker)
        && !contactIsProtected(attack[0], attacker.misc_worn_check ?? 0, !!weapon)) {
        const stone = await petrifyMonsterAttacker(attacker, {
            state, visible: visible && canSpotMonster(attacker), publish, finishDeath,
        });
        if (stone.heroDied)
            return result(effectResult(0, M_ATTK_AGR_DIED, true));
        if (!stone.survived && attacker.mtame && !visible)
            await publish('You have a peculiarly sad feeling for a moment, then it passes.');
        return result(effectResult(0, stone.survived ? M_ATTK_HIT : M_ATTK_AGR_DIED));
    }
    const effect = await applyMonsterCombatEffect(attacker, defender, context);
    if (effect.heroDied)
        return result(effect);
    // Even an effect that set done or zero damage reaches native knockback.
    const knockback = await tryKnockback(attacker, defender, { attackType: attack[0], damageType: attack[1] }, {
        state, random, publish, weaponUsed: !!monsterWieldedWeapon(attacker),
        finishMonsterDeath: finishDeath,
        finishLiquidDeath: (monster, liquid) => finishDeath(monster, {
            noCorpse: !liquid.leaveCorpse, random: liquid.random,
        }),
    });
    if (knockback.heroDied)
        return result({ ...effect, heroDied: true });
    if (knockback.knocked) {
        return result({ ...effect, damage: 0,
            nativeResult: effect.nativeResult | M_ATTK_HIT
                | (knockback.defenderDied ? M_ATTK_DEF_DIED : 0)
                | (knockback.aggressorDied ? M_ATTK_AGR_DIED : 0) });
    }
    if (effect.done || !effect.damage)
        return result(effect);
    defender.mhp -= effect.damage;
    if (defender.mhp > 0)
        return result({ ...effect, nativeResult: effect.nativeResult === M_ATTK_AGR_DIED
                ? M_ATTK_AGR_DIED : M_ATTK_HIT });
    exposeEngulfedDefenderForDeath(attacker, defender, state);
    const outcome = await finishMonsterKilled(defender, state, {
        damageType: attack[1], random, rollDice, publish,
        noRevive: (attack[0] === AT_WEAP || attack[0] === AT_CLAW)
            && MONSTER_SYMBOL[defender.mnum] === S_TROLL
            && artifactById(weapon?.oartifact, state)?.enumName === 'TROLLSBANE',
        zombifyCorpse: !weapon && isZombieMaker(attacker.mnum, !!attacker.mcan)
            && (attack[0] === AT_CLAW || attack[0] === AT_BITE || attack[0] === AT_TUCH)
            && zombieForm(defender.mnum) != null,
    });
    recordDeath(outcome);
    if (outcome.heroDied)
        return result({ ...effect, heroDied: true });
    if (outcome.survived)
        return result(effect);
    if (effect.nativeResult === M_ATTK_AGR_DIED)
        return result({ ...effect, nativeResult: M_ATTK_DEF_DIED | M_ATTK_AGR_DIED });
    if (attack[1] === AD_DGST) {
        const digestion = await finishMonsterDigestion(attacker, {
            state, attackerSpecies, defenderSpecies, defenderShapechanger: defender.cham, publish, growAttacker,
        });
        if (digestion.heroDied || !digestion.growNormally)
            return result({ ...effect, nativeResult: M_ATTK_DEF_DIED
                    | (attacker.mhp <= 0 || attacker.dead ? M_ATTK_AGR_DIED : 0),
                heroDied: digestion.heroDied });
    }
    const growth = await growAttacker(defender);
    return result({ ...effect, nativeResult: M_ATTK_DEF_DIED
            | (growth.survived ? 0 : M_ATTK_AGR_DIED), heroDied: growth.heroDied });
}
async function applyMonsterCombatEffect(attacker, defender, context) {
    switch (context.attack[1]) {
        case AD_PHYS: return context.applyPhysical();
        case AD_FIRE:
        case AD_COLD:
        case AD_ELEC:
        case AD_ACID:
        case AD_RUST:
        case AD_CORR:
        case AD_DCAY:
            return applyMonsterElementEffect(attacker, defender, context);
        case AD_BLND:
        case AD_HALU:
        case AD_PLYS:
        case AD_SLEE:
        case AD_SLOW:
        case AD_CONF:
        case AD_STUN:
        case AD_LEGS:
        case AD_WERE:
        case AD_HEAL:
        case AD_STCK:
        case AD_WRAP:
        case AD_ENCH:
            return applyMonsterStatusEffect(attacker, defender, context);
        case AD_DRLI:
        case AD_DREN:
        case AD_DETH:
        case AD_PEST:
        case AD_FAMN:
        case AD_DISE:
        case AD_CURS:
            return applyMonsterDrainEffect(attacker, defender, context);
        case AD_SEDU:
        case AD_SITM:
        case AD_SSEX:
        case AD_SGLD:
            return applyMonsterTheftEffect(attacker, defender, context);
        case AD_TLPT:
        case AD_POLY:
        case AD_SLIM:
            return applyMonsterTransformEffect(attacker, defender, context);
        case AD_DGST: return applyMonsterDigestionEffect(attacker, defender, context);
        case AD_DRIN: {
            const brain = await resolveMonsterBrainAttack(attacker, defender, context.damage, context);
            return { damage: brain.damage, nativeResult: brain.hitFlags, done: false,
                skipBrainDrain: brain.skipBrainDrain, heroDied: brain.heroDied };
        }
        case AD_STON: return petrifyingEffect(attacker, defender, context);
        case AD_DRST:
        case AD_DRDX:
        case AD_DRCO: {
            let damage = context.damage;
            if (!await monsterCombatAttackNegated(attacker, defender, { ...context, verbose: false })
                && context.random(8) === 0)
                damage = await poisonMonsterFromAttack(attacker, defender, context.attack[0], damage, context);
            return effectResult(damage);
        }
        case AD_SAMU:
        case AD_MAGM:
        case AD_DISN:
        case AD_SPC1:
        case AD_SPC2:
        case AD_CLRC:
        case AD_SPEL:
        case AD_RBRE:
            return effectResult(0);
    }
}
async function physicalEffect(attacker, defender, context) {
    let grew = false;
    const physical = await resolveMonsterPhysicalDamage(attacker, defender, { attackType: context.attack[0] }, context.damage, {
        ...context, hitOnHead: !context.notOnHead,
        finishDeath: async (monster, options) => {
            const outcome = await context.finishDeath(monster, options);
            if (!outcome.survived && !outcome.heroDied && monster === defender) {
                grew = true;
                return { ...outcome, heroDied: (await context.growAttacker(defender)).heroDied };
            }
            return outcome;
        },
    });
    let nativeResult = physical.hitFlags;
    let heroDied = physical.heroDied;
    if ((nativeResult & M_ATTK_DEF_DIED) && !heroDied && !grew) {
        const growth = await context.growAttacker(defender);
        heroDied = growth.heroDied;
        if (!growth.survived)
            nativeResult |= M_ATTK_AGR_DIED;
    }
    if (attacker.mhp <= 0 || attacker.dead)
        nativeResult |= M_ATTK_AGR_DIED;
    return { damage: physical.damage, done: physical.done, nativeResult, heroDied };
}
async function petrifyingEffect(attacker, defender, context) {
    if (attacker.mcan)
        return effectResult(context.damage);
    const stone = await petrifyMonsterDefender(defender, {
        ...context, visible: context.visible && canSeeMonster(defender),
    });
    if (stone.heroDied)
        return effectResult(0, M_ATTK_MISS, true);
    let nativeResult = M_ATTK_MISS;
    let heroDied = false;
    if (!stone.survived) {
        if (defender.mtame && !context.visible)
            await context.publish('You have a peculiarly sad feeling for a moment, then it passes.');
        const growth = await context.growAttacker(defender);
        nativeResult = M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED);
        heroDied = growth.heroDied;
    }
    return { damage: 0, nativeResult, done: stone.stopped, heroDied };
}
function effectResult(damage, nativeResult = M_ATTK_MISS, heroDied = false) {
    return { damage, nativeResult, heroDied, done: false };
}
//# sourceMappingURL=monster_combat_damage.js.map