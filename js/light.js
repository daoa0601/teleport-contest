// light.js — Mobile object light and the supported oil-lamp burn timer.
// C refs: timeout.c begin_burn()/burn_object()/end_burn(), light.c.

import { game } from './gstate.js';
import { OIL_LAMP } from './object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, scheduleObjectTimer,
    stopObjectTimer,
} from './object_timers.js';

function oilLampBreakpoint(age) {
    if (age > 150) return age - 150;
    if (age > 100) return age - 100;
    if (age > 50) return age - 50;
    if (age > 25) return age - 25;
    return age;
}

// begin_burn() stores only the fuel remaining after the next warning
// breakpoint; the timer owns the intervening turns.  Keeping both fields is
// what lets save/restore and an overdue callback reconstruct source state.
export function beginOilLampBurn(
    object, state = game, currentTurn = state.moves ?? 0,
) {
    if (!object || object.otyp !== OIL_LAMP || (object.age ?? 0) <= 0)
        return false;
    const turns = oilLampBreakpoint(object.age);
    object.lamplit = true;
    object.age -= turns;
    scheduleObjectTimer(
        object, OBJECT_TIMER_KIND.BURN_OBJECT, currentTurn + turns, state,
    );
    state.vision_full_recalc = 1;
    return true;
}

function extinguishOilLamp(object, state) {
    object.lamplit = false;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    state.vision_full_recalc = 1;
}

// C run_timers() removes the timer before burn_object() runs.  This focused
// dispatcher owns oil-lamp fuel state; warning text and other timer function
// types remain outside its deliberately narrow scope.
export function runClaimedObjectBurnTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    const object = claimed?.object;
    const timeout = claimed?.timer?.deadline;
    if (!object || object.otyp !== OIL_LAMP || !object.lamplit
        || !Number.isFinite(timeout)) return null;
    if (timeout !== currentTurn) {
        const elapsed = currentTurn - timeout;
        if (elapsed >= (object.age ?? 0)) {
            object.age = 0;
            extinguishOilLamp(object, state);
            return { object, threshold: 0, overdue: true };
        } else {
            object.age -= elapsed;
            beginOilLampBurn(object, state, currentTurn);
            return { object, threshold: object.age, overdue: true };
        }
    }
    const threshold = object.age ?? 0;
    if (threshold === 0) extinguishOilLamp(object, state);
    else beginOilLampBurn(object, state, currentTurn);
    return { object, threshold, overdue: false };
}

export function runObjectBurnTimers(state = game, currentTurn = state.moves ?? 0) {
    const events = [];
    const kinds = new Set([OBJECT_TIMER_KIND.BURN_OBJECT]);
    let claimed;
    while ((claimed = claimNextDueObjectTimer(state, currentTurn, kinds))) {
        const event = runClaimedObjectBurnTimer(
            claimed, state, currentTurn,
        );
        if (event) events.push(event);
    }
    return events;
}
