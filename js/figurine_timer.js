// figurine_timer.js — C carry_obj_effects()/attach_fig_transform_timeout().

import { G_GENOD } from './const.js';
import { game } from './gstate.js';
import { monsterYoungerForm } from './monster_data.js';
import { FIGURINE } from './object_data.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer, stopObjectTimer,
} from './object_timers.js';
import { rnd } from './rng.js';

function figurineSpeciesGenocided(figurine, state) {
    const mnum = figurine?.corpsenm;
    if (!Number.isInteger(mnum) || mnum < 0) return true;
    const younger = monsterYoungerForm(mnum);
    return !!((state.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD)
        || !!((state.mvitals?.[younger]?.mvflags ?? 0) & G_GENOD);
}

export function attachCursedFigurineTimer(figurine, state = game) {
    if (!figurine || figurine.otyp !== FIGURINE || !figurine.cursed
        || figurineSpeciesGenocided(figurine, state)) return null;
    // Native attachment removes an earlier deadline before choosing the new
    // one.  scheduleObjectTimer() also defends against duplicates, but this
    // preserves the source mutation boundary around the RNG draw.
    stopObjectTimer(figurine, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    return scheduleObjectTimer(
        figurine, OBJECT_TIMER_KIND.FIG_TRANSFORM,
        (state.moves ?? 0) + rnd(9000) + 200, state,
    );
}
