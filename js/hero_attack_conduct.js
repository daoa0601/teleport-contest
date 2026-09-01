// C ref: uhitm.c check_caitiff().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS2 } from './monster_data.js';

const M2_UNDEAD = 0x00000002;

export async function applyCaitiffPenalty(monster, state = game) {
    const helpless = !!(monster.msleeping || monster.mcanmove === 0
        || monster.mcanmove === false
        || (monster.mfrozen ?? 0) > 0);
    const fleeingFromBehind = !!(monster.mflee && !monster.mavenge);
    const lawfulKnight = state.urole?.key === 'knight'
        && (state.u?.ualign?.type ?? 0) > 0;
    const honorable = (state.u?.ualign?.record ?? 0) > -10;
    const undead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_UNDEAD);
    if (!lawfulKnight || !honorable || undead
        || (!helpless && !fleeingFromBehind)) return false;

    await plineWithContinuation('You caitiff!');
    state.u.ualign.record = Math.max(
        -127, (state.u.ualign.record ?? 0) - 1,
    );
    state.u.ualign.abuse = (state.u.ualign.abuse ?? 0) + 1;
    return true;
}
