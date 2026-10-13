// Monster sleep resistance and timed sleep state.
// C refs: mondata.h resists_sleep(), mon.c sleep_monst().
import { MONSTER_FLAGS1 } from './monster_data.js';
import { finishMonsterEating } from './monster_eating.js';
import { monsterResistanceBits } from './monster_resistance.js';
const M1_BREATHLESS = 0x00000400;
const MR_SLEEP = 0x04;
export function monsterResistsSleep(monster) {
    return !!(monsterResistanceBits(monster) & MR_SLEEP)
        || !!monster?.defendedSleep;
}
export function monsterIsBreathless(monster) {
    return !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_BREATHLESS);
}
export function monsterIsHelpless(monster) {
    return !!(monster.msleeping
        || !monster.mcanmove || (monster.mfrozen ?? 0) > 0);
}
export function putMonsterToSleep(monster, turns) {
    if (!monster.mcanmove)
        return false;
    finishMonsterEating(monster);
    const duration = turns + (monster.mfrozen ?? 0);
    if (duration > 0) {
        monster.mcanmove = 0;
        monster.mfrozen = Math.min(duration, 127);
    }
    else {
        monster.msleeping = 1;
    }
    return true;
}
//# sourceMappingURL=monster_sleep.js.map