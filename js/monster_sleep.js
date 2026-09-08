// Monster sleep resistance and timed sleep state.
// C refs: mondata.h resists_sleep(), mon.c sleep_monst().

import { MONSTER_FLAGS1 } from './monster_data.js';
import { monsterResistanceBits } from './monster_resistance.js';

const M1_BREATHLESS = 0x00000400;
const MR_SLEEP = 0x04;

export function monsterResistsSleep(monster) {
    return !!(monsterResistanceBits(monster) & MR_SLEEP)
        || !!monster?.sleepResistance
        || !!monster?.sleep_resistance
        || !!monster?.defendedSleep;
}

export function monsterIsBreathless(monster) {
    return !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_BREATHLESS)
        || !!monster?.breathless;
}

export function monsterIsHelpless(monster) {
    return !!(monster?.helpless || monster?.msleeping
        || monster?.mcanmove === 0 || (monster?.mfrozen ?? 0) > 0);
}

export function putMonsterToSleep(monster, turns) {
    if (!monster || monster.mcanmove === 0) return false;
    monster.mcanmove = 0;
    monster.mfrozen = Math.min(turns + (monster.mfrozen ?? 0), 127);
    monster.meating = 0;
    return true;
}
