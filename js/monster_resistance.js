// Monster resistance checks shared by attacks and item effects.
// C refs: zap.c resist() and mondata.c Resists_Elem().

import { W_ARMC, W_ARMOR } from './const.js';
import {
    MONSTER_MAGIC_RESISTANCE, MONSTER_RESISTS,
} from './monster_data.js';
import {
    ALCHEMY_SMOCK, YELLOW_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES,
} from './object_data.js';
import { rn2 } from './rng.js';

const MR_ACID = 0x40;
const MR_POISON = 0x20;
const MR_STONE = 0x80;

function monsterResistanceBits(monster) {
    return (MONSTER_RESISTS[monster?.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
}

export function monsterHasAcidResistance(monster) {
    const resistanceBits = monsterResistanceBits(monster);
    if ((resistanceBits & MR_ACID) || monster?.acidResistance
        || monster?.acid_resistance) return true;

    return (monster?.minvent || monster?.inventory || []).some(object => {
        const wornMask = object?.owornmask ?? 0;
        const dragonArmor = [
            YELLOW_DRAGON_SCALE_MAIL,
            YELLOW_DRAGON_SCALES,
        ].includes(object?.otyp) && !!(wornMask & W_ARMOR);
        const smock = object?.otyp === ALCHEMY_SMOCK
            && !!(wornMask & W_ARMC);
        return dragonArmor || smock;
    });
}

export function monsterHasPoisonResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_POISON)
        || !!monster?.poisonResistance
        || !!monster?.poison_resistance;
}

export function monsterHasStoneResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_STONE)
        || !!monster?.stoneResistance
        || !!monster?.stone_resistance;
}

export function monsterResistsEffect(
    monster, attackLevel, random = rn2,
) {
    let defenseLevel = monster?.m_lev ?? 1;
    if (defenseLevel > 50) defenseLevel = 50;
    else if (defenseLevel < 1) defenseLevel = 1;
    const resistance = MONSTER_MAGIC_RESISTANCE[monster?.mnum] ?? 0;
    return random(100 + attackLevel - defenseLevel) < resistance;
}
