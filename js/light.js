// light.js — Mobile object light and the supported timed-lamp burn owner.
// C refs: timeout.c begin_burn()/burn_object()/end_burn(), light.c.

import { game } from './gstate.js';
import { BRASS_LANTERN, MAGIC_LAMP, OIL_LAMP } from './object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, scheduleObjectTimer,
    stopObjectTimer,
} from './object_timers.js';

const TIMED_LAMP_TYPES = new Set([BRASS_LANTERN, OIL_LAMP]);
const LAMP_TYPES = new Set([...TIMED_LAMP_TYPES, MAGIC_LAMP]);

function lampBreakpoint(age) {
    if (age > 150) return age - 150;
    if (age > 100) return age - 100;
    if (age > 50) return age - 50;
    if (age > 25) return age - 25;
    return age;
}

// begin_burn() stores only the fuel remaining after the next warning
// breakpoint; the timer owns the intervening turns.  Keeping both fields is
// what lets save/restore and an overdue callback reconstruct source state.
export function beginLampBurn(
    object, state = game, currentTurn = state.moves ?? 0,
) {
    if (!object || !LAMP_TYPES.has(object.otyp)) return false;
    if (object.otyp === MAGIC_LAMP) {
        object.lamplit = true;
        state.vision_full_recalc = 1;
        return true;
    }
    if ((object.age ?? 0) <= 0) return false;
    const turns = lampBreakpoint(object.age);
    object.lamplit = true;
    object.age -= turns;
    scheduleObjectTimer(
        object, OBJECT_TIMER_KIND.BURN_OBJECT, currentTurn + turns, state,
    );
    state.vision_full_recalc = 1;
    return true;
}

// The themed-room callback historically used this narrow name.  Retain the
// API while routing its source-identical lamp state through the shared owner.
export function beginOilLampBurn(
    object, state = game, currentTurn = state.moves ?? 0,
) {
    if (object?.otyp !== OIL_LAMP) return false;
    return beginLampBurn(object, state, currentTurn);
}

// apply.c:dorub() performs this type change before the released djinni can
// grant a fatal wish.  A lit magic lamp already has a light source but no
// timer; once it becomes an oil lamp, begin_burn(..., TRUE) attaches the
// ordinary fuel timer while preserving that light-source identity.
export function transformMagicLampToOilLamp(
    object, oilAge, state = game, currentTurn = state.moves ?? 0,
) {
    if (object?.otyp !== MAGIC_LAMP || !Number.isFinite(oilAge)
        || oilAge <= 0) return false;
    object.otyp = OIL_LAMP;
    object.name = 'oil lamp';
    object.plural = 'oil lamps';
    object.spe = 0;
    object.age = oilAge;
    if (object.lamplit) beginLampBurn(object, state, currentTurn);
    return true;
}

// timeout.c:end_burn(..., TRUE) reaches cleanup_burn() through stop_timer().
// The object's stored age excludes the turns owned by its active timer, so a
// manual switch-off must restore the still-unspent portion before darkening
// the source.  Natural expiry has already claimed its timer and deliberately
// uses extinguishTimedLamp() below instead.
export function endLampBurn(
    object, state = game, currentTurn = state.moves ?? 0,
) {
    if (!object || !LAMP_TYPES.has(object.otyp) || !object.lamplit)
        return false;
    if (object.otyp === MAGIC_LAMP) {
        object.lamplit = false;
        state.vision_full_recalc = 1;
        return true;
    }
    const timer = stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    if (!timer || !Number.isFinite(timer.deadline)) return false;
    object.age = (object.age ?? 0)
        + Math.max(0, timer.deadline - currentTurn);
    object.lamplit = false;
    state.vision_full_recalc = 1;
    return true;
}

function extinguishTimedLamp(object, state) {
    object.lamplit = false;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    state.vision_full_recalc = 1;
}

// C run_timers() removes the timer before burn_object() runs.  This focused
// dispatcher owns oil-lamp and brass-lantern fuel state; warning text and
// non-lamp burn types remain outside its deliberately narrow scope.
export function runClaimedObjectBurnTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    const object = claimed?.object;
    const timeout = claimed?.timer?.deadline;
    if (!object || !TIMED_LAMP_TYPES.has(object.otyp) || !object.lamplit
        || !Number.isFinite(timeout)) return null;
    if (timeout !== currentTurn) {
        const elapsed = currentTurn - timeout;
        if (elapsed >= (object.age ?? 0)) {
            object.age = 0;
            extinguishTimedLamp(object, state);
            return { object, threshold: 0, overdue: true };
        } else {
            object.age -= elapsed;
            beginLampBurn(object, state, currentTurn);
            return { object, threshold: object.age, overdue: true };
        }
    }
    const threshold = object.age ?? 0;
    if (threshold === 0) extinguishTimedLamp(object, state);
    else beginLampBurn(object, state, currentTurn);
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
