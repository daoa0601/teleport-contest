// A boulder filling a pit or hole.
// C ref: do.c flooreffects() boulder branch.

import { buryFloorObjectsAt } from './buried_object.js';
import { is_hole, is_pit } from './const.js';
import { game } from './gstate.js';
import { BOULDER } from './object_data.js';
import { stopAllObjectTimers } from './object_timers.js';

export function fillPitWithBoulderAt(x, y, state = game) {
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y
        && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)));
    const boulder = state.level?.objects?.[x]?.[y]?.find(object =>
        object.otyp === BOULDER);
    if (!trap || !boulder) {
        return {
            filled: false,
            trap: trap || null,
            boulder: boulder || null,
            buriedFloorObjects: [],
        };
    }

    const pile = state.level.objects[x][y];
    const boulderIndex = pile.indexOf(boulder);
    if (boulderIndex >= 0) pile.splice(boulderIndex, 1);
    stopAllObjectTimers(boulder);
    boulder.where = 'gone';
    boulder.buried = false;
    boulder.ox = boulder.oy = 0;

    const trapIndex = state.level.traps.indexOf(trap);
    if (trapIndex >= 0) state.level.traps.splice(trapIndex, 1);
    const buriedFloorObjects = buryFloorObjectsAt(x, y, state);
    return {
        filled: true, trap, boulder, buriedFloorObjects,
    };
}
