// Native uhitm.c:mhitm_ad_tlpt()/poly()/slim() and mhitm.c:mon_poly().
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, NON_PM, RLOC_MSG, RLOC_NOMSG, STRAT_WAITFORU } from './const.js';
import { canSeeMonster, canSpotMonster, shieldeff } from './display.js';
import { AD_POLY, AD_RBRE, AD_SLIM, AD_TLPT } from './monster_attack_types.js';
import { monsterCombatAttackNegated } from './monster_combat_negation.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { finishMonsterKilled } from './monster_death.js';
import { monsterName, namelessMonsterName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { monsterIsSlimeproof, tryMonsterUnslime } from './monster_unslime.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { cansee } from './vision.js';
const M1_TPORT = 0x02000000;
const M2_SHAPESHIFTER = 0x00004000;
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
export async function applyMonsterTransformEffect(attacker, defender, context) {
    const damageType = context.attack[1];
    if (damageType === AD_TLPT)
        return teleportDefender(attacker, defender, context);
    if (damageType === AD_POLY)
        return polymorphDefender(attacker, defender, context);
    if (damageType === AD_SLIM)
        return slimeDefender(attacker, defender, context);
    throw new RangeError(`Unsupported transformation attack ${damageType}`);
}
async function teleportDefender(attacker, defender, context) {
    const { state, publish, visible, random, rollOne } = context;
    const result = transformationResult(context.damage);
    if (attacker.mcan || context.damage >= defender.mhp
        || await reportMonsterTeleportRestriction(defender, { state, publish }))
        return result;
    if (await monsterCombatAttackNegated(attacker, defender, { state, publish, visible, random })) {
        if (visible)
            await publish(`${monsterName(defender, { state, capitalized: true })} is not affected.`);
        return result;
    }
    const spotted = canSpotMonster(defender);
    const before = visible && spotted ? monsterName(defender, { state, capitalized: true }) : '';
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const relocation = await randomMonsterRelocation(defender, { state, random, rollOne, flags: RLOC_NOMSG });
    if (relocation?.died || state.program_state.gameover)
        return { ...result, done: true, heroDied: true };
    if (visible && spotted && !canSpotMonster(defender) && defender !== state.u.usteed)
        await publish(`${before} suddenly disappears!`);
    if (result.damage >= defender.mhp) {
        if (defender.mhp === 1)
            defender.mhp++;
        result.damage = defender.mhp - 1;
    }
    return result;
}
async function polymorphDefender(attacker, defender, context) {
    const { state, publish, visible, random, rollOne, finishDeath } = context;
    const negated = await monsterCombatAttackNegated(attacker, defender, {
        state, publish, visible, random, verbose: false,
    }) || !!attacker.mspec_used;
    if (context.damage >= defender.mhp || negated)
        return transformationResult(context.damage);
    const oldSpecies = defender.mnum;
    const before = monsterName(defender, { state, capitalized: true });
    let damage = context.damage;
    if (monsterHasMagicResistance(defender)) {
        if (visible)
            await showPolymorphResistance(defender, context);
    }
    else if (monsterResistsEffect(defender, 12, random)) {
        await showPolymorphResistance(defender, context);
    }
    else if (random(25) === 0 && (defender.cham ?? NON_PM) === NON_PM
        && (defender.mcan || ((MONSTER_FLAGS2[defender.mnum] ?? 0) & M2_SHAPESHIFTER))) {
        if (visible)
            await publish(`${before} shudders!`);
        defender.mhp -= damage + Math.trunc((defender.mhpmax + 1) / 2);
        damage = 0;
        if (defender.mhp <= 0) {
            // mon_poly's system shock uses monkilled but never grow_up.
            const death = await finishMonsterKilled(defender, state, {
                damageType: AD_RBRE, cause: '', publish, random, rollDice: context.rollDice,
            });
            if (death.heroDied)
                return { ...transformationResult(0), done: true, heroDied: true };
        }
    }
    else {
        const change = await changeMonsterForm(defender, null, state, {
            publish, finishDeath, creditHero: false,
        });
        if (change?.heroDied)
            return { ...transformationResult(0), done: true, heroDied: true };
        if (change) {
            if (visible)
                await announcePolymorph(defender, before, context);
            damage = 0;
            if (((MONSTER_FLAGS1[attacker.mnum] ?? 0) & M1_TPORT)
                && !await reportMonsterTeleportRestriction(attacker, { state, publish })) {
                const relocation = await randomMonsterRelocation(attacker, { state, random, rollOne, flags: RLOC_MSG });
                if (relocation?.died || state.program_state.gameover)
                    return { ...transformationResult(0), done: true, heroDied: true };
            }
        }
        else if (visible && state.flags.verbose) {
            await publish('Nothing happens.');
        }
    }
    if (defender.mnum !== oldSpecies)
        attacker.mspec_used = (attacker.mspec_used ?? 0) + rollOne(2);
    // mon_poly consumes this attack even when resistance left its damage
    // unchanged; the common hit-point subtraction must not run afterward.
    return {
        damage, nativeResult: M_ATTK_HIT | (defender.mhp <= 0 ? M_ATTK_DEF_DIED : 0),
        done: true, heroDied: false,
    };
}
async function showPolymorphResistance(defender, { state, publish }) {
    await shieldeff(defender.mx, defender.my, state);
    if (cansee(defender.mx, defender.my))
        await publish(`${monsterName(defender, { state, capitalized: true })} resists!`);
}
async function announcePolymorph(defender, before, { state, publish }) {
    const wasSeen = before.toLowerCase() !== 'it';
    if (canSpotMonster(defender)) {
        const description = namelessMonsterName(defender, {
            state, article: 'a', suppressIt: true, suppressInvisible: true,
        });
        const transformation = state.flags.verbose || !wasSeen ? ' undergoes a freakish metamorphosis and' : '';
        await publish(`${before}${transformation} turns into ${description}.`);
    }
    else if (wasSeen) {
        await publish(`${before} undergoes a freakish metamorphosis and disappears.`);
    }
}
async function slimeDefender(attacker, defender, context) {
    const { state, visible, publish, random, rollDice, rollOne, finishDeath } = context;
    const result = transformationResult(context.damage);
    if (await monsterCombatAttackNegated(attacker, defender, {
        state, visible, publish, random, verbose: false,
    }) || random(4) !== 0 || monsterIsSlimeproof(defender))
        return result;
    const cure = await tryMonsterUnslime(defender, { state, byHero: false, publish, random, rollDice, rollOne });
    if (cure.heroDied)
        return { ...result, done: true, heroDied: true };
    if (!cure.cured && defender.mhp > 0) {
        const change = await changeMonsterForm(defender, PM_GREEN_SLIME, state, {
            showMessage: visible && canSeeMonster(defender), publish, finishDeath, creditHero: false,
        });
        if (change?.heroDied)
            return { ...result, done: true, heroDied: true };
        defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
        result.nativeResult = M_ATTK_HIT;
    }
    if (attacker.mhp <= 0)
        result.nativeResult |= M_ATTK_AGR_DIED;
    if (defender.mhp <= 0)
        result.nativeResult |= M_ATTK_DEF_DIED;
    result.damage = 0;
    // Unlike polymorph, sliming retains the common knockback/zero-damage path,
    // even when the defender's cure killed one or both participants.
    return result;
}
function transformationResult(damage) {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}
//# sourceMappingURL=monster_combat_transform.js.map