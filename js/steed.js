// steed.js — Which monsters can wear saddles and how saddles are equipped.
// C ref: steed.c can_saddle(), put_saddle_on_mon().

import { W_SADDLE } from './const.js';
import {
    MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';

const M1_AMORPHOUS = 0x00000004;
const M1_HUMANOID = 0x00020000;
const M1_UNSOLID = 0x00100000;
const MZ_MEDIUM = 2;
const S_QUADRUPED = 17;
const S_UNICORN = 21;
const S_VORTEX = 22;
const S_ANGEL = 27;
const S_CENTAUR = 29;
const S_DRAGON = 30;
const S_ELEMENTAL = 31;
const S_JABBERWOCK = 36;
const S_GHOST = 54;
const PM_AIR_ELEMENTAL = 154;
const SADDLE_CLASSES = new Set([
    S_QUADRUPED,
    S_UNICORN,
    S_ANGEL,
    S_CENTAUR,
    S_DRAGON,
    S_JABBERWOCK,
]);

export function canSaddleMonster(monster) {
    if (!Number.isInteger(monster?.mnum)) return false;
    const monsterClass = MONSTER_SYMBOL[monster.mnum];
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return SADDLE_CLASSES.has(monsterClass)
        && (MONSTER_SIZE[monster.mnum] ?? 0) >= MZ_MEDIUM
        && (!(flags & M1_HUMANOID) || monsterClass === S_CENTAUR)
        && !(flags & (M1_AMORPHOUS | M1_UNSOLID))
        && monsterClass !== S_GHOST
        && monsterClass !== S_VORTEX
        && !(monsterClass === S_ELEMENTAL
            && monster.mnum === PM_AIR_ELEMENTAL);
}

export function monsterSaddle(monster) {
    if (monster?.saddle) return monster.saddle;
    return (monster?.minvent || monster?.inventory || []).find(object =>
        (object.owornmask ?? 0) & W_SADDLE) ?? null;
}

export function putSaddleOnMonster(saddle, monster) {
    if (!saddle || !canSaddleMonster(monster) || monsterSaddle(monster))
        return null;
    const carriedSaddle = addObjectToMonsterInventory(monster, saddle);
    carriedSaddle.owornmask = W_SADDLE;
    carriedSaddle.leashmon = monster.m_id;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_SADDLE;
    monster.saddled = true;
    monster.saddle = carriedSaddle;
    return carriedSaddle;
}
