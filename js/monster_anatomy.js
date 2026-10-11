// C mondata.c:can_blow(). Hero strangulation is an actor-specific check.
import { MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SOUND, MONSTER_SYMBOL, requireMonsterData } from './monster_data.js';
const M1_BREATHLESS = 0x400, M1_NOHEAD = 0x8000;
const MS_SILENT = 0, MS_BUZZ = 10, MZ_SMALL = 1, S_EEL = 57;
export function speciesCanBlow(mnum) {
    const sound = requireMonsterData(MONSTER_SOUND, mnum);
    if (sound !== MS_SILENT && sound !== MS_BUZZ)
        return true;
    return !(requireMonsterData(MONSTER_FLAGS1, mnum) & (M1_BREATHLESS | M1_NOHEAD))
        && requireMonsterData(MONSTER_SIZE, mnum) >= MZ_SMALL
        && requireMonsterData(MONSTER_SYMBOL, mnum) !== S_EEL;
}
//# sourceMappingURL=monster_anatomy.js.map