// C refs: mon.c:curr_mon_load(), max_mon_load(), and can_carry().

import { MAX_CARR_CAP, WT_HUMAN } from './const.js';
import {
    MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import { AT_ENGL } from './monster_attack_types.js';
import {
    BOULDER, CORPSE, GOLD_PIECE, OBJECT_WEIGHT,
} from './object_data.js';

const GEM_CLASS = 13;
const M1_NOHANDS = 0x00002000;
const M2_STRONG = 0x04000000;
const M2_ROCKTHROW = 0x08000000;
const M2_GREEDY = 0x10000000;
const M2_JEWELS = 0x20000000;
const M2_COLLECT = 0x40000000;
const M2_MAGIC = 0x80000000;
const MZ_HUMAN = 2;
const S_DRAGON = 30;

function monsterObjectWeight(object) {
    if (!object) return 0;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.otyp === GOLD_PIECE)
        return Math.trunc((quantity + 50) / 100);
    if (object.otyp === CORPSE && Number.isInteger(object.corpsenm))
        return MONSTER_BODY_META[object.corpsenm]?.[0] ?? 0;
    if (Number.isFinite(object.owt) && object.owt > 0) return object.owt;
    return (OBJECT_WEIGHT[object.otyp] ?? 0) * quantity;
}

export function currentMonsterLoad(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    const inventory = monster?.minvent || monster?.inventory || [];
    const saddle = monster?.saddle && !inventory.includes(monster.saddle)
        ? [monster.saddle] : [];
    return [...inventory, ...saddle].reduce((total, object) => {
        if (object?.otyp === BOULDER && (flags & M2_ROCKTHROW)) return total;
        return total + monsterObjectWeight(object);
    }, 0);
}

function maxMonsterLoad(monster) {
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

export function monsterCarryAmount(monster, object) {
    if (!monster || !object) return 0;
    const quantity = object.quan ?? object.quantity ?? 1;
    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const flags2 = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if (quantity > 1) {
        const canTakeWholeStack = MONSTER_SYMBOL[monster.mnum] === S_DRAGON
            && (object.otyp === GOLD_PIECE || object.oclass === GEM_CLASS)
            || (MONSTER_ATTACKS[monster.mnum] || [])
                .some(([attackType]) => attackType === AT_ENGL);
        if ((flags1 & M1_NOHANDS) && !canTakeWholeStack) return 1;
    }
    if ((flags2 & M2_ROCKTHROW) && object.otyp === BOULDER) return quantity;
    if (monster.isshk) return quantity;
    if (monster.mpeaceful && !monster.mtame && !monster.pet) return 0;
    return currentMonsterLoad(monster) + monsterObjectWeight(object)
        <= maxMonsterLoad(monster) ? quantity : 0;
}

export function monsterCanCarryObject(monster, object) {
    return monsterCarryAmount(monster, object) > 0;
}

export function monsterLikesObjects(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return !!(flags & (M2_GREEDY | M2_JEWELS | M2_COLLECT | M2_MAGIC))
        || MONSTER_HAS_WEAPON_ATTACK.has(monster?.mnum);
}
