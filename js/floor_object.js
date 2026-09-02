// Floor-object ownership and pile order.
// C refs: mkobj.c place_object(), remove_object(), splitobj(),
// obj_timer_checks(), and invent.c stackobj(), obj_extract_self().

import { ICE } from './const.js';
import { game } from './gstate.js';
import { CORPSE } from './object_data.js';
import { mergable, mergeObjectStacks } from './object_merge.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopObjectTimer,
} from './object_timers.js';

// Corpse rot and revival take twice as long while the body is on ice.
export function updateCorpseIceTimer(
    body, x, y, isOnIce, state = game,
) {
    if (!body || body.otyp !== CORPSE) return false;
    const timer = objectTimers(body).find(candidate =>
        candidate.kind === OBJECT_TIMER_KIND.ROT_CORPSE)
        || objectTimers(body).find(candidate =>
            candidate.kind === OBJECT_TIMER_KIND.REVIVE_MON);
    if (!timer) return false;
    const currentMove = state.moves ?? 0;
    if (isOnIce && !body.on_ice) {
        const remaining = Math.max(0, timer.deadline - currentMove);
        stopObjectTimer(body, timer.kind);
        body.on_ice = true;
        const age = currentMove - (body.age ?? currentMove);
        body.age = currentMove - age * 2;
        scheduleObjectTimer(
            body, timer.kind, currentMove + remaining * 2, state,
        );
        return true;
    }
    if (!isOnIce && body.on_ice) {
        const remaining = Math.max(0, timer.deadline - currentMove);
        stopObjectTimer(body, timer.kind);
        body.on_ice = false;
        const age = currentMove - (body.age ?? currentMove);
        body.age += Math.trunc(age / 2);
        scheduleObjectTimer(
            body, timer.kind, currentMove + Math.trunc(remaining / 2), state,
        );
        return true;
    }
    return false;
}

export function place_object(object, x, y, state = game) {
    if (!object || !state.level) return object;
    object.ox = x;
    object.oy = y;
    object.where = 'floor';
    state._fobjSerial = (state._fobjSerial || 0) + 1;
    object._fobjOrder = state._fobjSerial;
    if (!state.level.objects[x]) state.level.objects[x] = [];
    if (!state.level.objects[x][y]) state.level.objects[x][y] = [];
    state.level.objects[x][y].unshift(object);
    updateCorpseIceTimer(
        object, x, y, state.level.at(x, y)?.typ === ICE, state,
    );
    return object;
}

export function stack_object(object, state = game) {
    const pile = state.level?.objects?.[object?.ox]?.[object?.oy];
    if (!object || !pile) return object;
    const existing = pile.find(candidate =>
        candidate !== object && mergable(object, candidate, state));
    if (!existing) return object;

    const index = pile.indexOf(existing);
    if (index >= 0) pile.splice(index, 1);
    return mergeObjectStacks(object, existing, state) || object;
}

export function remove_object(object, state = game) {
    if (!object || !state.level) return object;
    const pile = state.level.objects?.[object.ox]?.[object.oy];
    const index = pile?.indexOf(object) ?? -1;
    if (index >= 0) pile.splice(index, 1);
    object.where = 'free';
    updateCorpseIceTimer(object, object.ox, object.oy, false, state);
    return object;
}

export function detachFloorObjectUnit(object, state) {
    const quantity = objectQuantity(object);
    if (quantity <= 1) {
        remove_object(object, state);
        return object;
    }

    const detached = splitObjectStack(object, 1, state);
    detached.where = 'free';
    return detached;
}
