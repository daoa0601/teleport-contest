// Per-species birth and death state.
// C ref: decl.h mvitals[] and mon.c mondead().

import { G_GENOD } from './const.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import type { Monster, MonsterPopulationState } from './monster_types.js';

const PM_MAIL_DAEMON = MONSTER_NAME.indexOf('mail daemon');

export function monsterDeathCount(mnum: number, state: MonsterPopulationState = game): number {
    return state.mvitals?.[mnum]?.died ?? 0;
}

export function recordMonsterDeath(
    monster: Pick<Monster, 'mnum'>, state: MonsterPopulationState = game,
): number {
    if (!Array.isArray(state.mvitals)) state.mvitals = [];
    const mnum = monster.mnum;
    const vital = state.mvitals[mnum]
        || (state.mvitals[mnum] = { mvflags: 0, born: 0, died: 0 });
    vital.died = Math.min(255, (vital.died ?? 0) + 1);
    if (mnum === PM_MAIL_DAEMON)
        vital.mvflags = (vital.mvflags ?? 0) | G_GENOD;
    return vital.died;
}

export function hasRecordedMonsterDeaths(state: MonsterPopulationState = game): boolean {
    return (state.mvitals || []).some(vital => (vital?.died ?? 0) > 0);
}
