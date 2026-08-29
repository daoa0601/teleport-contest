// light.js — Mobile object light and the supported oil-lamp burn timer.
// C refs: timeout.c begin_burn()/burn_object()/end_burn(), light.c.

import { game } from './gstate.js';
import { OIL_LAMP } from './object_data.js';

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
    object.burnAt = currentTurn + turns;
    object.timed = 1;
    state.vision_full_recalc = 1;
    return true;
}

function extinguishOilLamp(object, state) {
    object.lamplit = false;
    object.timed = 0;
    delete object.burnAt;
    state.vision_full_recalc = 1;
}

function topLevelObjects(state) {
    const objects = [];
    const seen = new Set();
    const add = object => {
        if (!object || seen.has(object)) return;
        seen.add(object);
        objects.push(object);
    };
    for (const column of state.level?.objects || [])
        for (const pile of column || [])
            for (const object of pile || []) add(object);
    for (const object of state.inventory || []) add(object);
    for (const monster of state.level?.monsters || []) {
        for (const object of monster.minvent || []) add(object);
        for (const object of monster.inventory || [])
            add(object);
    }
    return objects;
}

// C run_timers() removes the timer before burn_object() runs.  This focused
// dispatcher owns oil-lamp fuel state; warning text and other timer function
// types remain outside its deliberately narrow scope.
export function runObjectBurnTimers(state = game, currentTurn = state.moves ?? 0) {
    const events = [];
    for (const object of topLevelObjects(state)) {
        if (object.otyp !== OIL_LAMP || !object.lamplit
            || object.burnAt == null || object.burnAt > currentTurn) continue;
        const timeout = object.burnAt;
        object.timed = 0;
        if (timeout !== currentTurn) {
            const elapsed = currentTurn - timeout;
            if (elapsed >= (object.age ?? 0)) {
                object.age = 0;
                extinguishOilLamp(object, state);
                events.push({ object, threshold: 0, overdue: true });
            } else {
                object.age -= elapsed;
                beginOilLampBurn(object, state, currentTurn);
                events.push({
                    object, threshold: object.age, overdue: true,
                });
            }
            continue;
        }
        const threshold = object.age ?? 0;
        if (threshold === 0) extinguishOilLamp(object, state);
        else beginOilLampBurn(object, state, currentTurn);
        events.push({ object, threshold, overdue: false });
    }
    return events;
}
