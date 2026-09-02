// Shared ownership for a leash attached to a monster.
// C refs: apply.c:m_unleash(), get_mleash(), and unleash_all().

import { game } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import { LEASH } from './object_data.js';

const M1_NOLIMBS = 0x00006000;
const M1_NOHEAD = 0x00008000;
const M1_UNSOLID = 0x00100000;
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

// C apply.c:leashable().  A head is enough to leash a limbless monster.
export function monsterCanBeLeashed(monster) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const hasNoLimbs = (flags & M1_NOLIMBS) === M1_NOLIMBS;
    return monster?.mnum !== PM_LONG_WORM
        && !(flags & M1_UNSOLID)
        && (!hasNoLimbs || !(flags & M1_NOHEAD));
}

export function leashAttachedToMonster(monster, state = game) {
    return (state.inventory || []).find(object =>
        object.otyp === LEASH && object.leashmon === monster?.m_id) || null;
}

export function releaseMonsterLeash(monster, state = game) {
    if (!monster?.mleashed) return null;
    const leash = leashAttachedToMonster(monster, state);
    monster.mleashed = 0;
    if (leash) leash.leashmon = 0;
    return leash;
}

export function releaseAllMonsterLeashes(state = game) {
    const attachedLeashes = (state.inventory || []).filter(object =>
        object.otyp === LEASH && object.leashmon);
    for (const monster of state.level?.monsters || [])
        monster.mleashed = 0;
    for (const leash of attachedLeashes) leash.leashmon = 0;
    return attachedLeashes.length;
}
