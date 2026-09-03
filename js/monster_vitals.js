// Per-species birth and death state.
// C ref: decl.h mvitals[] and mon.c mondead().

import { game } from './gstate.js';

export function monsterDeathCount(mnum, state = game) {
    return state.mvitals?.[mnum]?.died ?? 0;
}

export function recordMonsterDeath(monster, state = game) {
    if (!Array.isArray(state.mvitals)) state.mvitals = [];
    const mnum = monster.mnum;
    const vital = state.mvitals[mnum]
        || (state.mvitals[mnum] = { mvflags: 0, born: 0, died: 0 });
    vital.died = Math.min(255, (vital.died ?? 0) + 1);
    return vital.died;
}

export function hasRecordedMonsterDeaths(state = game) {
    return (state.mvitals || []).some(vital => (vital?.died ?? 0) > 0);
}
