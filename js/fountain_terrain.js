// Fountain terrain changes shared by heroes and monsters.
// C ref: fountain.c dryup().

import { COULD_SEE, FOUNTAIN, F_WARNED, ROOM } from './const.js';
import { newsym } from './display.js';
import { game } from './gstate.js';
import { inTown } from './room.js';
import { rn2 } from './rng.js';

const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;

function heroCouldSee(state, x, y) {
    return !!(state.viz_array?.[y]?.[x] & COULD_SEE);
}

function visiblePeacefulWatchman(state) {
    return (state.level?.monsters || []).find(monster =>
        (monster?.mhp ?? 1) > 0
        && (monster.mnum === PM_WATCHMAN
            || monster.mnum === PM_WATCH_CAPTAIN)
        && !!monster.mpeaceful
        && heroCouldSee(state, monster.mx, monster.my));
}

export function dryFountainAt(
    x,
    y,
    {
        causedByHero = true,
        random = rn2,
        state = game,
    } = {},
) {
    const location = state.level?.at?.(x, y);
    if (location?.typ !== FOUNTAIN)
        return { dried: false, warning: null };
    const alreadyWarned = !!((location.looted ?? 0) & F_WARNED);
    if (random(3) !== 0 && !alreadyWarned)
        return { dried: false, warning: null };

    if (causedByHero && inTown(state.level, x, y) && !alreadyWarned) {
        location.looted = (location.looted ?? 0) | F_WARNED;
        return {
            dried: false,
            warning: visiblePeacefulWatchman(state) || 'trickle',
        };
    }

    location.typ = ROOM;
    location.flags = 0;
    location.looted = 0;
    location.blessedftn = 0;
    const levelFlags = state.level.flags || (state.level.flags = {});
    levelFlags.nfountains = Math.max(
        0, (levelFlags.nfountains ?? 1) - 1,
    );
    if (state === game) newsym(x, y);
    return { dried: true, warning: null };
}
