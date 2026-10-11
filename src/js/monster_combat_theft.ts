// Native uhitm.c:mhitm_ad_sedu()/sgld(), monster attacking monster.
import { DISMOUNT_POLY, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED,
    M_ATTK_MISS, RLOC_NOMSG, STRAT_WAITFORU, W_SADDLE } from './const.js';
import { canSeeMonster, canSpotMonster } from './display.js';
import { inventoryItemDescription } from './invent.js';
import { AD_SGLD } from './monster_attack_types.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { linkObjectToMonsterInventory, removeObjectFromMonsterInventory, unlinkMonsterObject } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import { monsterSelfTouch } from './monster_stoning.js';
import { updateMonsterWeaponAfterPolymorph } from './monster_weapon.js';
import { dismountHero } from './steed.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import type { MonsterCombatEffectContext, MonsterCombatEffectResult } from './monster_combat_effect_types.js';
import type { Monster } from './monster_types.js';

const COIN_CLASS = 12;
const S_NYMPH = 14;

export async function applyMonsterTheftEffect(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    return context.attack[1] === AD_SGLD
        ? stealGold(attacker, defender, context) : stealItem(attacker, defender, context);
}

async function stealGold(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    const result = theftResult(0);
    if (attacker.mcan) return result;
    const gold = (defender.minvent || defender.inventory || [])
        .find(object => object.oclass === COIN_CLASS);
    if (!gold) return result;
    const { state, visible, publish } = context;
    unlinkMonsterObject(defender, gold);
    await linkObjectToMonsterInventory(attacker, gold, { state });
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const thiefName = monsterName(attacker, { state, capitalized: true });
    if (visible && canSeeMonster(defender))
        await publish(`${thiefName} steals some gold from ${monsterName(defender, { state })}.`);
    return escapeAfterTheft(attacker, thiefName, context);
}

async function stealItem(
    attacker: Monster, defender: Monster, context: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (attacker.mcan) return theftResult(context.damage);
    const object = (defender.minvent || defender.inventory || [])
        .find(candidate => !attacker.mtame || !candidate.cursed);
    if (!object) return theftResult(0);
    const { state, publish, visible, random, finishDeath } = context;
    const nymph = MONSTER_SYMBOL[attacker.mnum] === S_NYMPH;
    const victimName = monsterName(defender, { state, suppressSaddle: false });
    if (state.u.usteed === defender && ((object.owornmask ?? 0) & W_SADDLE)) {
        const dismount = await dismountHero(DISMOUNT_POLY, { state, random, announce: publish });
        if (dismount.died) return { ...theftResult(0), done: true, heroDied: true };
    }
    await removeObjectFromMonsterInventory(defender, object, state, { publish });
    if (state.program_state.gameover) return { ...theftResult(0), done: true, heroDied: true };
    const description = visible ? inventoryItemDescription(object) : '';
    // add_to_minv retains ownership without mpickobj's pickup side effects.
    await linkObjectToMonsterInventory(attacker, object, { state });
    const thiefName = monsterName(attacker, { state, capitalized: true });
    if (visible && canSeeMonster(defender))
        await publish(`${thiefName} steals ${description} from ${victimName}!`);
    await updateMonsterWeaponAfterPolymorph(defender, state, { publish });
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const touch = await monsterSelfTouch(defender, { state, publish, finishDeath, creditHero: false });
    if (touch.heroDied) return { ...theftResult(0), done: true, heroDied: true };
    if (defender.mhp <= 0) {
        const growth = await context.growAttacker(defender);
        return {
            damage: context.damage,
            nativeResult: M_ATTK_DEF_DIED | (growth.survived ? 0 : M_ATTK_AGR_DIED),
            done: true, heroDied: growth.heroDied,
        };
    }
    return nymph ? escapeAfterTheft(attacker, thiefName, context) : theftResult(0);
}

async function escapeAfterTheft(
    attacker: Monster, before: string, { state, publish, visible, random, rollOne }: MonsterCombatEffectContext,
): Promise<MonsterCombatEffectResult> {
    if (await reportMonsterTeleportRestriction(attacker, { state, publish })) return theftResult(0);
    const spotted = canSpotMonster(attacker);
    const relocation = await randomMonsterRelocation(attacker, { state, random, rollOne, flags: RLOC_NOMSG });
    if (state.program_state.gameover || relocation?.died)
        return { ...theftResult(0), nativeResult: M_ATTK_AGR_DONE, done: true, heroDied: true };
    if (visible && spotted && !canSpotMonster(attacker))
        await publish(`${before} suddenly disappears!`);
    return { ...theftResult(0), nativeResult: M_ATTK_AGR_DONE };
}

function theftResult(damage: number): MonsterCombatEffectResult {
    return { damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false };
}
