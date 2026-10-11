// C refs: hack.c impact_disturbs_zombies() and disturb_buried_zombies().
// A heavy enough impact near a buried zombie corpse hurries its revival:
// the zombify timer is cut to two thirds of its remaining time.  A due or
// overdue timer still gets stopped and restarted at one turn, because the
// C guard tests the absolute peek_timer() deadline, not the remaining time.

import { CORPSE } from './object_data.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { isFlimsyObject } from './object_properties.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopObjectTimer,
} from './object_timers.js';

// C hack.c:1785-1794.  `violent` marks a kick or throw; a plain drop needs
// ten times the weight to be noticeable.  The coordinates are the impact
// object's post-placement position.
export function impactDisturbsZombies(
    object: GameObject | null | undefined, violent: boolean, state: GameState = game,
) {
    // if object won't make a noticeable impact, let buried zombies rest
    if (!object || object.owt < (violent ? 10 : 100) || isFlimsyObject(object, game))
        return;

    disturbBuriedZombies(object.ox, object.oy, state);
}

// C hack.c:1796-1813.  Pure timer arithmetic: no RNG, messages, or display,
// so this stays state-aware rather than live-game locked.
export function disturbBuriedZombies(x: number, y: number, state: GameState = game) {
    const moves = state.moves ?? 0;

    for (const corpse of state.level?.buriedObjects || []) {
        if (corpse.otyp !== CORPSE)
            continue;
        if (Math.abs(corpse.ox - x) > 1 || Math.abs(corpse.oy - y) > 1)
            continue;
        const timer = objectTimers(corpse).find(candidate =>
            candidate.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
        // C peek_timer() returns the absolute deadline; only a deadline of
        // zero (no timer) leaves the corpse alone.  Due and overdue timers
        // still qualify and land on the one-turn floor below.
        if (!timer || timer.deadline <= 0)
            continue;

        // C stop_timer() returns the remaining time, possibly negative.
        const remaining = timer.deadline - moves;
        stopObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON);
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON,
            moves + Math.max(1, Math.floor((remaining * 2) / 3)), state);
    }
}
