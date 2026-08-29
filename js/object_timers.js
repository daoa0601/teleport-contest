// object_timers.js — Saveable object and level-position timer ordering.
// C ref: timeout.c start_timer()/insert_timer()/run_timers().

import { game } from './gstate.js';

export const OBJECT_TIMER_KIND = Object.freeze({
    ROT_ORGANIC: 'rot-organic',
    ROT_CORPSE: 'rot-corpse',
    ZOMBIFY_MON: 'zombify-mon',
    BURN_OBJECT: 'burn-object',
});

export const LEVEL_TIMER_KIND = Object.freeze({
    MELT_ICE_AWAY: 'melt-ice-away',
});

const TIMER_FIELDS = new Map([
    [OBJECT_TIMER_KIND.ROT_ORGANIC,
        { deadline: 'rotOrganicAt', order: 'rotOrganicOrder' }],
    [OBJECT_TIMER_KIND.ROT_CORPSE,
        { deadline: 'rotAt', order: 'rotOrder' }],
    [OBJECT_TIMER_KIND.ZOMBIFY_MON,
        { deadline: 'zombifyAt', order: 'zombifyOrder' }],
    [OBJECT_TIMER_KIND.BURN_OBJECT,
        { deadline: 'burnAt', order: 'burnOrder' }],
]);

function legacyTimerEntries(object) {
    const entries = [];
    for (const [kind, fields] of TIMER_FIELDS) {
        const deadline = object?.[fields.deadline];
        if (!Number.isFinite(deadline)) continue;
        entries.push({
            kind,
            deadline,
            // Old saves did not retain timer ids.  Object identity is the
            // only stable reconstruction; new schedules always own real ids.
            id: object[fields.order] ?? object.o_id ?? 0,
        });
    }
    return entries;
}

function timersFor(object) {
    if (!object) return [];
    if (!Array.isArray(object.objectTimers))
        object.objectTimers = legacyTimerEntries(object);
    object.timed = object.objectTimers.length;
    return object.objectTimers;
}

function levelTimersFor(state = game) {
    if (!state.level) return [];
    if (!Array.isArray(state.level.levelTimers))
        state.level.levelTimers = [];
    return state.level.levelTimers;
}

function allocateTimerId(state = game) {
    const prior = Math.max(
        state._nextObjectTimerId ?? 0,
        state._nextObjectTimerOrder ?? 0,
    );
    const id = prior + 1;
    state._nextObjectTimerId = id;
    // Compatibility with the first focused zombify slice and old snapshots.
    state._nextObjectTimerOrder = id;
    return id;
}

function syncLegacyTimer(object, timer) {
    const fields = TIMER_FIELDS.get(timer.kind);
    if (!fields) return;
    object[fields.deadline] = timer.deadline;
    object[fields.order] = timer.id;
}

function clearLegacyTimer(object, kind) {
    const fields = TIMER_FIELDS.get(kind);
    if (!fields) return;
    delete object[fields.deadline];
    delete object[fields.order];
}

export function scheduleObjectTimer(
    object, kind, deadline, state = game,
) {
    if (!object || !TIMER_FIELDS.has(kind) || !Number.isFinite(deadline))
        return null;
    stopObjectTimer(object, kind);
    const timer = { kind, deadline, id: allocateTimerId(state) };
    timersFor(object).push(timer);
    object.timed = object.objectTimers.length;
    syncLegacyTimer(object, timer);
    return timer;
}

export function scheduleLevelTimer(
    x, y, kind, deadline, state = game,
) {
    if (!state.level || kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || !Number.isInteger(x) || !Number.isInteger(y)
        || !Number.isFinite(deadline)) return null;
    stopLevelTimer(x, y, kind, state);
    const timer = {
        kind, deadline, id: allocateTimerId(state), x, y,
    };
    levelTimersFor(state).push(timer);
    return timer;
}

export function stopLevelTimer(x, y, kind, state = game) {
    const timers = levelTimersFor(state);
    const removed = [];
    for (let index = timers.length - 1; index >= 0; index--) {
        const timer = timers[index];
        if (timer.x !== x || timer.y !== y || timer.kind !== kind) continue;
        removed.unshift(...timers.splice(index, 1));
    }
    return removed;
}

export function stopObjectTimer(object, kind) {
    if (!object) return null;
    const timers = timersFor(object);
    const index = timers.findIndex(timer => timer.kind === kind);
    if (index < 0) {
        clearLegacyTimer(object, kind);
        return null;
    }
    const [timer] = timers.splice(index, 1);
    clearLegacyTimer(object, kind);
    object.timed = timers.length;
    return timer;
}

export function stopAllObjectTimers(object) {
    if (!object) return [];
    const timers = timersFor(object).splice(0);
    for (const kind of TIMER_FIELDS.keys()) clearLegacyTimer(object, kind);
    object.timed = 0;
    return timers;
}

export function objectsInTimerGraph(state = game) {
    const objects = [];
    const seen = new Set();
    const visit = object => {
        if (!object || seen.has(object)) return;
        seen.add(object);
        objects.push(object);
        for (const content of object.contents || []) visit(content);
    };
    for (const column of state.level?.objects || [])
        for (const pile of column || [])
            for (const object of pile || []) visit(object);
    for (const object of state.level?.buriedObjects || []) visit(object);
    for (const object of state.inventory || []) visit(object);
    for (const monster of state.level?.monsters || []) {
        for (const object of monster.minvent || []) visit(object);
        for (const object of monster.inventory || []) visit(object);
    }
    return objects;
}

function allowedKind(kind, allowedKinds) {
    return !allowedKinds || allowedKinds.has(kind);
}

function precedes(left, right) {
    return !right || left.timer.deadline < right.timer.deadline
        || (left.timer.deadline === right.timer.deadline
            && left.timer.id > right.timer.id);
}

export function peekNextDueObjectTimer(
    state = game, currentTurn = state.moves ?? 0, allowedKinds = null,
) {
    let next = null;
    for (const object of objectsInTimerGraph(state)) {
        for (const timer of timersFor(object)) {
            if (timer.deadline > currentTurn
                || !allowedKind(timer.kind, allowedKinds)) continue;
            // timeout.c:insert_timer() inserts a new timer before the first
            // existing timer with an equal deadline.  Equal-time callbacks
            // therefore execute in descending timer-id/insertion order.
            const candidate = { object, timer };
            if (precedes(candidate, next)) next = candidate;
        }
    }
    for (const timer of levelTimersFor(state)) {
        if (timer.deadline > currentTurn
            || !allowedKind(timer.kind, allowedKinds)) continue;
        const candidate = {
            object: null,
            position: { x: timer.x, y: timer.y },
            timer,
        };
        if (precedes(candidate, next)) next = candidate;
    }
    return next;
}

export function claimNextDueObjectTimer(
    state = game, currentTurn = state.moves ?? 0, allowedKinds = null,
) {
    const next = peekNextDueObjectTimer(state, currentTurn, allowedKinds);
    if (!next) return null;
    if (next.object) {
        const timers = timersFor(next.object);
        const index = timers.indexOf(next.timer);
        if (index >= 0) timers.splice(index, 1);
        clearLegacyTimer(next.object, next.timer.kind);
        next.object.timed = timers.length;
    } else {
        const timers = levelTimersFor(state);
        const index = timers.indexOf(next.timer);
        if (index >= 0) timers.splice(index, 1);
    }
    return next;
}

export function objectTimers(object) {
    return timersFor(object).map(timer => ({ ...timer }));
}

export function levelTimers(state = game) {
    return levelTimersFor(state).map(timer => ({ ...timer }));
}
