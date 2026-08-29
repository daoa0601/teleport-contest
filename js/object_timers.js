// object_timers.js — Saveable object-attached timer ordering.
// C ref: timeout.c start_timer()/insert_timer()/run_timers().

import { game } from './gstate.js';

export const OBJECT_TIMER_KIND = Object.freeze({
    ROT_ORGANIC: 'rot-organic',
    ROT_CORPSE: 'rot-corpse',
    ZOMBIFY_MON: 'zombify-mon',
    BURN_OBJECT: 'burn-object',
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
    const prior = Math.max(
        state._nextObjectTimerId ?? 0,
        state._nextObjectTimerOrder ?? 0,
    );
    const timer = { kind, deadline, id: prior + 1 };
    state._nextObjectTimerId = timer.id;
    // Compatibility with the first focused zombify slice and old snapshots.
    state._nextObjectTimerOrder = timer.id;
    timersFor(object).push(timer);
    object.timed = object.objectTimers.length;
    syncLegacyTimer(object, timer);
    return timer;
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
            if (!next || timer.deadline < next.timer.deadline
                || (timer.deadline === next.timer.deadline
                    && timer.id > next.timer.id)) {
                next = { object, timer };
            }
        }
    }
    return next;
}

export function claimNextDueObjectTimer(
    state = game, currentTurn = state.moves ?? 0, allowedKinds = null,
) {
    const next = peekNextDueObjectTimer(state, currentTurn, allowedKinds);
    if (!next) return null;
    const timers = timersFor(next.object);
    const index = timers.indexOf(next.timer);
    if (index >= 0) timers.splice(index, 1);
    clearLegacyTimer(next.object, next.timer.kind);
    next.object.timed = timers.length;
    return next;
}

export function objectTimers(object) {
    return timersFor(object).map(timer => ({ ...timer }));
}
