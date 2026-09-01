// Species and shapechanger rules shared by corpse revival and statues.
// C refs: read.c cant_revive() and zap.c restore_cham().

import { MM_FEMALE, MM_MALE } from './const.js';
import { game } from './gstate.js';
import { shapechangeMonster } from './mklev.js';
import { MONSTER_FLAGS2, MONSTER_GENO } from './monster_data.js';

const G_UNIQ = 0x1000;
const M2_SHAPESHIFTER = 0x00004000;

export const PM_HUMAN_ZOMBIE = 244;
export const PM_DOPPELGANGER = 270;

const PM_ANGEL = 123;
const PM_GUARD = 272;
const PM_ALIGNED_CLERIC = 275;
const PM_HIGH_CLERIC = 276;
const PM_LONG_WORM = 114;
const PM_LONG_WORM_TAIL = 330;

export function revivalReplacement(mnum, body) {
    if ([PM_GUARD, PM_HIGH_CLERIC, PM_ALIGNED_CLERIC, PM_ANGEL]
        .includes(mnum)) return PM_HUMAN_ZOMBIE;
    if (mnum === PM_LONG_WORM_TAIL) return PM_LONG_WORM;
    if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ
        && !body.oextra?.omonst) return PM_DOPPELGANGER;
    return null;
}

export function bodyGenderFlags(body) {
    const gender = (body.spe ?? 0) & 0x03;
    if (gender === 1) return MM_FEMALE;
    if (gender === 2) return MM_MALE;
    return 0;
}

export function restoreRevivedShapechanger(monster, state = game) {
    const naturalForm = Number.isInteger(monster.cham)
        && monster.cham >= 0 ? monster.cham : null;
    const protectedFromShapechangers = !!(
        state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers
    );
    if (protectedFromShapechangers || monster.mcan) {
        if (naturalForm != null) {
            const cancelled = monster.mcan;
            shapechangeMonster(monster, naturalForm);
            monster.cham = -1;
            if (cancelled) monster.mcan = 1;
        }
        return;
    }
    if (naturalForm == null
        && ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_SHAPESHIFTER)) {
        monster.cham = monster.mnum;
    }
}
