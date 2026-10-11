// Species and gender rules shared by corpse revival and statues.
// C refs: read.c cant_revive() and obj.h corpse/statue gender flags.

import { MM_FEMALE, MM_MALE } from './const.js';
import type { GameObject } from './object_types.js';
import { MONSTER_GENO } from './monster_data.js';

const G_UNIQ = 0x1000;

export const PM_HUMAN_ZOMBIE = 244;
export const PM_DOPPELGANGER = 270;

const PM_ANGEL = 123;
const PM_GUARD = 272;
const PM_ALIGNED_CLERIC = 275;
const PM_HIGH_CLERIC = 276;
const PM_LONG_WORM = 114;
const PM_LONG_WORM_TAIL = 330;

export function revivalReplacement(mnum: number, body: GameObject): number | null {
    if ([PM_GUARD, PM_HIGH_CLERIC, PM_ALIGNED_CLERIC, PM_ANGEL]
        .includes(mnum)) return PM_HUMAN_ZOMBIE;
    if (mnum === PM_LONG_WORM_TAIL) return PM_LONG_WORM;
    if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ
        && !body.oextra?.omonst) return PM_DOPPELGANGER;
    return null;
}

export function bodyGenderFlags(body: GameObject): number {
    const gender = (body.spe ?? 0) & 0x03;
    if (gender === 1) return MM_FEMALE;
    if (gender === 2) return MM_MALE;
    return 0;
}

