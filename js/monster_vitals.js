// Per-species birth and death state.
// C ref: decl.h mvitals[] and mon.c mondead().
import { G_GENOD } from './const.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
const PM_MAIL_DAEMON = MONSTER_NAME.indexOf('mail daemon');
export function monsterDeathCount(mnum, state = game) {
    return state.mvitals?.[mnum]?.died ?? 0;
}
export function recordMonsterDeath(monster, state = game) {
    if (!Array.isArray(state.mvitals))
        state.mvitals = [];
    const mnum = monster.mnum;
    const vital = state.mvitals[mnum]
        || (state.mvitals[mnum] = { mvflags: 0, born: 0, died: 0 });
    vital.died = Math.min(255, (vital.died ?? 0) + 1);
    if (mnum === PM_MAIL_DAEMON)
        vital.mvflags = (vital.mvflags ?? 0) | G_GENOD;
    return vital.died;
}
export function hasRecordedMonsterDeaths(state = game) {
    return (state.mvitals || []).some(vital => (vital?.died ?? 0) > 0);
}
//# sourceMappingURL=monster_vitals.js.map