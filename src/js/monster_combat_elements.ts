// Native uhitm.c monster-vs-monster fire, cold, electricity, acid and erosion.
import { M_ATTK_MISS, STRAT_WAITFORU } from './const.js';
import { canSeeMonster, displayLiquidName, shieldeff } from './display.js';
import { igniteItems } from './light.js';
import { applyMonsterGolemEffects } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { AD_ACID, AD_COLD, AD_CORR, AD_DCAY, AD_ELEC, AD_FIRE, AD_RUST } from './monster_attack_types.js';
import { monsterCombatDefense } from './monster_combat_defense.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { monsterName } from './monster_name.js';
import {
    monsterHasAcidResistance, monsterHasColdResistance,
    monsterHasFireResistance, monsterHasShockResistance,
} from './monster_resistance.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { damageObjectWithAcid, erodeArmor } from './object_erosion.js';
import { destroyMonsterInventoryByElement } from './zap.js';
import type { MonsterCombatEffectContext, MonsterCombatEffectResult } from './monster_combat_effect_types.js';
import type { Monster } from './monster_types.js';

export async function applyMonsterElementEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const type = context.attack[1];
    if (type === AD_FIRE || type === AD_COLD || type === AD_ELEC)
        return await elementalContact(attacker, defender, type, context);
    if (type === AD_RUST || type === AD_CORR || type === AD_DCAY)
        return await erosionContact(attacker, defender, type, context);
    if (type === AD_ACID) return await acidContact(attacker, defender, context);
    throw new RangeError(`Unsupported monster elemental damage type: ${type}`);
}

async function elementalContact(
    attacker: Monster, defender: Monster, type: typeof AD_FIRE | typeof AD_COLD | typeof AD_ELEC,
    context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const { state, visible, publish, random, rollOne } = context;
    if (await monsterCombatAttackNegated(attacker, defender, { state, visible, publish, random }))
        return damageResult(0);
    const seen = visible && canSeeMonster(defender);
    const fire = type === AD_FIRE;
    const cold = type === AD_COLD;
    if (seen) {
        const subject = monsterName(defender, { state, capitalized: true });
        await publish(`${subject} ${fire ? `is ${monsterFireDescription(defender, context.attack[0])}`
            : cold ? 'is covered in frost' : 'gets zapped'}!`);
    }
    const species = MONSTER_NAME[defender.mnum];
    if (fire && (species === 'paper golem' || species === 'straw golem')) {
        if (seen) await publish(`${monsterName(defender, { state, capitalized: true })} ${wornMonsterLifeSaver(defender)
            ? 'is totally engulfed in flames' : 'burns completely'}!`);
        return await killGolem(type, context);
    }
    const element = fire ? 'fire' : cold ? 'cold' : 'electric';
    const resistance = fire ? monsterHasFireResistance(defender)
        : cold ? monsterHasColdResistance(defender) : monsterHasShockResistance(defender);
    let damage = context.damage;
    if (resistance || monsterCombatDefense(defender, type, state)) {
        if (seen) await publish(`The ${fire ? 'fire' : cold ? 'frost' : 'zap'} doesn't ${fire
            ? 'seem to burn' : cold ? 'seem to chill' : 'shock'} ${monsterName(defender, { state })}!`);
        await shieldeff(defender.mx, defender.my, state);
        await applyMonsterGolemEffects(defender, type, damage, { state, publish });
        damage = 0;
    }
    damage += await destroyMonsterInventoryByElement(defender, element, context.damage, {
        state, publish, random, rollOne, visible: canSeeMonster(defender),
    });
    if (fire) await igniteItems(defender.minvent, {
        state, publish, random, carrier: defender, visible: canSeeMonster(defender),
    });
    return damageResult(damage);
}

async function erosionContact(
    attacker: Monster, defender: Monster, type: typeof AD_RUST | typeof AD_CORR | typeof AD_DCAY,
    context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    // Unlike elemental cancellation, cancelled erosion retains rolled damage.
    if (attacker.mcan) return damageResult(context.damage);
    const { state, visible, publish, random } = context;
    const species = MONSTER_NAME[defender.mnum];
    if (type === AD_RUST && species === 'iron golem'
        || type === AD_DCAY && (species === 'wood golem' || species === 'leather golem')) {
        if (visible && canSeeMonster(defender))
            await publish(`${monsterName(defender, { state, capitalized: true })} ${wornMonsterLifeSaver(defender)
                ? 'starts to fall' : 'falls'} to pieces!`);
        return await killGolem(type, context);
    }
    await erodeArmor(defender, type === AD_RUST ? 'rust' : type === AD_CORR ? 'corrosion' : 'rot', {
        state, publish, random,
    });
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    return damageResult(0);
}

async function acidContact(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (attacker.mcan) return damageResult(0);
    const { state, visible, publish, random } = context;
    const resisted = monsterHasAcidResistance(defender)
        || monsterCombatDefense(defender, AD_ACID, state);
    if (visible && canSeeMonster(defender)) {
        const subject = monsterName(defender, { state, capitalized: true });
        const liquid = displayLiquidName('acid', state);
        await publish(`${subject} is covered in ${liquid}${resisted ? ', but it seems harmless.' : '!'}`);
        if (!resisted) await publish(`It burns ${monsterName(defender, { state })}!`);
    }
    if (!random(30)) await erodeArmor(defender, 'corrosion', { state, publish, random });
    if (!random(6)) await damageObjectWithAcid(monsterWieldedWeapon(defender), { state, publish, random });
    return damageResult(resisted ? 0 : context.damage);
}

async function killGolem(
    type: typeof AD_FIRE | typeof AD_RUST | typeof AD_DCAY, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const death = await context.killDefender({ damageType: type, cause: null });
    return { damage: context.damage, nativeResult: death.nativeResult, done: true, heroDied: death.heroDied };
}

function damageResult(damage: number): MonsterCombatEffectResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}
