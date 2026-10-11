import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
// C refs: mon.c can_touch_safely(), curr_mon_load(), max_mon_load(), and can_carry().

import { LARGEST_INT, MAX_CARR_CAP, W_ARMG, WT_HUMAN } from './const.js';
import { monsterCanTouchArtifact } from './artifacts.js';
import { game } from './gstate.js';
import {
    MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL,
    monsterHatesSilver, monsterIsCovetous,
} from './monster_data.js';
import { AT_ENGL } from './monster_attack_types.js';
import { BELL_OF_OPENING, BOULDER, CORPSE } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { rn2 } from './rng.js';
import { touchPetrifies } from './stoning.js';

const COIN_CLASS = 12, GEM_CLASS = 13, ROCK_CLASS = 14;
const M1_NOTAKE = 0x00000800;
const M1_NOHANDS = 0x00002000;
const M2_STRONG = 0x04000000;
const M2_ROCKTHROW = 0x08000000;
const M2_GREEDY = 0x10000000;
const M2_JEWELS = 0x20000000;
const M2_COLLECT = 0x40000000;
const M2_MAGIC = 0x80000000;
const MZ_HUMAN = 2;
const S_DRAGON = 30;
const S_NYMPH = 14;
const SILVER = 14;
const RIDERS = new Set(['Death', 'Pestilence', 'Famine']
    .map(name => MONSTER_NAME.indexOf(name)));

export function monsterCanTouchObject(monster: Monster, object: GameObject, state: GameState = game): boolean {
    if (object.otyp === CORPSE && object.corpsenm !== undefined) {
        if (touchPetrifies(object.corpsenm)
            && !((monster.misc_worn_check ?? 0) & W_ARMG)
            && !monsterHasStoneResistance(monster)) return false;
        if (RIDERS.has(object.corpsenm)) return false;
    }
    if (objectMaterial(object, state) === SILVER && monsterHatesSilver(monster)
        && (object.otyp !== BELL_OF_OPENING || !monsterIsCovetous(monster))) return false;
    return monsterCanTouchArtifact(monster, object, state);
}

export function currentMonsterLoad(monster: Monster): number {
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    return (monster.minvent ?? []).reduce((total, object) => {
        if (object.otyp === BOULDER && (flags & M2_ROCKTHROW)) return total;
        return total + object.owt;
    }, 0);
}

export function maxMonsterLoad(monster: Monster): number {
    const bodyWeight = MONSTER_BODY_META[monster?.mnum]?.[0] ?? 0;
    const size = MONSTER_SIZE[monster?.mnum] ?? 0;
    const strong = !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_STRONG);
    let capacity;
    if (!bodyWeight)
        capacity = Math.trunc(MAX_CARR_CAP * size / MZ_HUMAN);
    else if (!strong || bodyWeight > WT_HUMAN)
        capacity = Math.trunc(MAX_CARR_CAP * bodyWeight / WT_HUMAN);
    else capacity = MAX_CARR_CAP;
    if (!strong) capacity = Math.trunc(capacity / 2);
    return Math.max(1, capacity);
}

export function monsterCarryAmount(
    monster: Monster | null | undefined, object: GameObject | null | undefined,
    state: GameState = game, random: typeof rn2 = rn2,
): number {
    if (!monster || !object) return 0;
    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const flags2 = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if ((flags1 & M1_NOTAKE) || !monsterCanTouchObject(monster, object, state)) return 0;
    const quantity = object.quan > LARGEST_INT
        ? 20000 + random(LARGEST_INT - 20000 + 1) : object.quan;
    if (quantity > 1) {
        const canTakeWholeStack = MONSTER_SYMBOL[monster.mnum] === S_DRAGON
            && (object.oclass === COIN_CLASS || object.oclass === GEM_CLASS)
            || (MONSTER_ATTACKS[monster.mnum] || [])
                .some(([attackType]) => attackType === AT_ENGL);
        if ((flags1 & M1_NOHANDS) && !canTakeWholeStack) return 1;
    }
    if (monster === state.u.usteed) return 0;
    if (monster.isshk) return quantity;
    if (monster.mpeaceful && !monster.mtame) return 0;
    if ((flags2 & M2_ROCKTHROW) && object.otyp === BOULDER) return quantity;
    if (MONSTER_SYMBOL[monster.mnum] === S_NYMPH)
        return object.oclass === ROCK_CLASS ? 0 : quantity;
    return currentMonsterLoad(monster) + object.owt
        <= maxMonsterLoad(monster) ? quantity : 0;
}

export function monsterCanCarryObject(
    monster: Monster | null | undefined, object: GameObject | null | undefined,
    state: GameState = game, random: typeof rn2 = rn2,
): boolean {
    return monsterCarryAmount(monster, object, state, random) > 0;
}

export function monsterLikesObjects(monster: Monster): boolean {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return !!(flags & (M2_GREEDY | M2_JEWELS | M2_COLLECT | M2_MAGIC))
        || MONSTER_HAS_WEAPON_ATTACK.has(monster?.mnum);
}
