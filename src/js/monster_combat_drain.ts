// C uhitm.c:mhitm_ad_drli/dren/deth/pest/famn/dise/curs(), monster defenders.

import { publishHeardMessage } from './hero_speech.js';
import { M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_MISS, STRAT_WAITFORU } from './const.js';
import { canSeeMonster, canSpotMonster } from './display.js';
import { monsterCombatDefense } from './monster_combat_defense.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import {
    AD_CURS, AD_DETH, AD_DISE, AD_DREN, AD_DRLI, AD_FAMN, AD_PEST, AT_ENGL,
} from './monster_attack_types.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterIsUndead } from './monster_data.js';
import { drainMonsterEnergy } from './monster_energy.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterHasDrainResistance } from './monster_resistance.js';
import { sessionIsNight } from './monster_sound.js';
import { heroIsDeaf } from './senses.js';
import { isHumanWereMonster, isWereMonster, wereChange } from './were.js';
import type { MonsterCombatEffectContext, MonsterCombatEffectResult } from './monster_combat_effect_types.js';
import type { DamageType } from './monster_attack_types.js';
import type { Monster } from './monster_types.js';

const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_METALLIVORE = 0x80000000;
const S_FUNGUS = 32;
const PM_GHOUL = MONSTER_NAME.indexOf('ghoul');
const PM_GREMLIN = MONSTER_NAME.indexOf('gremlin');
const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');

type DrainDamageType = typeof AD_DRLI | typeof AD_DREN | typeof AD_DETH
    | typeof AD_DISE | typeof AD_PEST | typeof AD_FAMN | typeof AD_CURS;

export async function applyMonsterDrainEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const damageType = context.attack[1];
    if (!isDrainDamageType(damageType))
        throw new Error(`Unsupported monster drain effect ${damageType}`);
    const result: MonsterCombatEffectResult = {
        damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
    };
    switch (damageType) {
    case AD_DRLI:
        result.damage = await drainLife(attacker, defender, context, result.damage);
        return result;
    case AD_DREN:
        await drainEnergy(attacker, defender, context);
        result.damage = 0;
        return result;
    case AD_DETH:
        if (monsterIsUndead(defender.mnum) && result.damage > 1) {
            result.damage = context.rollOne(Math.trunc(result.damage / 2));
        }
        result.damage = await drainLife(attacker, defender, context, result.damage);
        return result;
    case AD_DISE:
    case AD_PEST:
        if (MONSTER_SYMBOL[defender.mnum] === S_FUNGUS || defender.mnum === PM_GHOUL
            || monsterCombatDefense(defender, AD_DISE, context.state)) {
            result.damage = 0;
        }
        return result;
    case AD_FAMN:
        if (!((MONSTER_FLAGS1[defender.mnum] ?? 0)
            & (M1_CARNIVORE | M1_HERBIVORE | M1_METALLIVORE))) result.damage = 0;
        return result;
    case AD_CURS:
        return curseDefender(attacker, defender, context, result);
    }
}

function isDrainDamageType(damageType: DamageType): damageType is DrainDamageType {
    return damageType === AD_DRLI || damageType === AD_DREN || damageType === AD_DETH
        || damageType === AD_DISE || damageType === AD_PEST || damageType === AD_FAMN
        || damageType === AD_CURS;
}

async function drainLife(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext, damage: number,
): Promise<number> {
    const { state, visible, random, rollDice, publish } = context;
    if (context.attack[1] !== AD_DETH) {
        if (random(3) || monsterHasDrainResistance(defender)
            || monsterCombatDefense(defender, AD_DRLI, state)
            || await monsterCombatAttackNegated(attacker, defender, {
                state, visible, random, publish, verbose: true,
            })) return damage;
        damage = rollDice(2, 6);
    }
    if (visible && canSpotMonster(defender)) {
        await publish(`${monsterName(defender, { state, capitalized: true })} becomes weaker!`);
    }
    if (defender.mhpmax - damage > defender.m_lev) defender.mhpmax -= damage;
    else if (defender.mhpmax > defender.m_lev) defender.mhpmax = defender.m_lev + 1;
    if (defender.m_lev === 0) return defender.mhp;
    defender.m_lev--;
    return damage;
}

async function drainEnergy(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<void> {
    const { state, visible, random, rollDice, publish } = context;
    if (await monsterCombatAttackNegated(attacker, defender, {
        state, visible, random, publish, verbose: false,
    }) || random(4)) return;
    await drainMonsterEnergy(defender, {
        state, publish, rollDice,
        giveMessage: visible && canSpotMonster(defender) && context.attack[0] !== AT_ENGL,
    });
}

async function curseDefender(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
    result: MonsterCombatEffectResult,
): Promise<MonsterCombatEffectResult> {
    const { state, visible, random, rollDice, publish, finishDeath, growAttacker } = context;
    if (attacker.mnum === PM_GREMLIN && !sessionIsNight(state.datetime)) return result;
    if (attacker.mcan || random(10)) return result;

    defender.mcan = 1;
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    if (isWereMonster(defender) && !isHumanWereMonster(defender)) {
        // The curse calls were_change, so an unprotected beast still has
        // only its ordinary one-in-thirty chance to revert.
        await wereChange(defender, state, random, { publish });
        if (state.program_state.gameover) return { ...result, heroDied: true };
    }
    if (defender.mnum === PM_CLAY_GOLEM) {
        if (visible && canSeeMonster(defender)) {
            const name = possessiveName(monsterName(defender, { state }));
            await publish(`Some writing vanishes from ${name} head!`);
            await publish(`${monsterName(defender, { state, capitalized: true })} is destroyed!`);
        }
        const death = await finishDeath(defender, { random, rollDice, publish });
        result.done = true;
        result.heroDied = !!death.heroDied;
        if (death.survived) return result;
        result.nativeResult = M_ATTK_DEF_DIED;
        if (result.heroDied) return result;
        if (defender.mtame && !visible) {
            await publish('You have a strangely sad feeling for a moment, then it passes.');
        }
        const growth = await growAttacker(defender);
        if (!growth.survived) result.nativeResult |= M_ATTK_AGR_DIED;
        result.heroDied = growth.heroDied;
        return result;
    }
    if (!heroIsDeaf(state)) {
        if (!visible) await publishHeardMessage('laughter.', publish, state);
        else if (canSeeMonster(attacker)) {
            await publish(`${monsterName(attacker, { state, capitalized: true })} chuckles.`);
        }
    }
    return result;
}
