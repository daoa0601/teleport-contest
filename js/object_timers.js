// object_timers.js — Saveable object and level-position timer ordering.
// C ref: timeout.c start_timer()/insert_timer()/run_timers().
import { game } from './gstate.js';
export const OBJECT_TIMER_KIND = Object.freeze({
    ROT_ORGANIC: 'rot-organic',
    ROT_CORPSE: 'rot-corpse',
    REVIVE_MON: 'revive-mon',
    ZOMBIFY_MON: 'zombify-mon',
    BURN_OBJECT: 'burn-object',
    HATCH_EGG: 'hatch-egg',
    SHRINK_GLOB: 'shrink-glob',
    FIG_TRANSFORM: 'fig-transform',
});
export const LEVEL_TIMER_KIND = Object.freeze({
    MELT_ICE_AWAY: 'melt-ice-away',
});
const OBJECT_TIMER_KINDS = new Set(Object.values(OBJECT_TIMER_KIND));
function timersFor(object) {
    if (!object)
        return [];
    if (!Array.isArray(object.objectTimers))
        object.objectTimers = [];
    object.timed = object.objectTimers.length;
    return object.objectTimers;
}
function levelTimersFor(state = game) {
    if (!state.level)
        return [];
    if (!Array.isArray(state.level.levelTimers))
        state.level.levelTimers = [];
    return state.level.levelTimers;
}
function allocateTimerId(state = game) {
    const prior = state._nextObjectTimerId ?? 0;
    const id = prior + 1;
    state._nextObjectTimerId = id;
    return id;
}
function nextTimerOrder(state) {
    state._timerSerial = (state._timerSerial ?? 0) + 1;
    return state._timerSerial;
}
export function scheduleObjectTimer(object, kind, deadline, state = game) {
    if (!object || !OBJECT_TIMER_KINDS.has(kind) || !Number.isFinite(deadline))
        return null;
    const timers = timersFor(object);
    if (timers.some(timer => timer.kind === kind))
        return null;
    const timer = { kind, deadline, id: allocateTimerId(state), order: nextTimerOrder(state) };
    timers.push(timer);
    object.timed = timers.length;
    return timer;
}
export function scheduleLevelTimer(x, y, kind, deadline, state = game) {
    if (!state.level || kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || !Number.isInteger(x) || !Number.isInteger(y)
        || !Number.isFinite(deadline))
        return null;
    const timers = levelTimersFor(state);
    if (timers.some(timer => timer.x === x && timer.y === y && timer.kind === kind))
        return null;
    const timer = {
        kind, deadline, id: allocateTimerId(state), order: nextTimerOrder(state), x, y,
    };
    timers.push(timer);
    return timer;
}
export function stopLevelTimer(x, y, kind, state = game) {
    const timers = levelTimersFor(state);
    const removed = [];
    for (let index = timers.length - 1; index >= 0; index--) {
        const timer = timers[index];
        if (!timer)
            throw new Error(`Missing level timer at index ${index}`);
        if (timer.x !== x || timer.y !== y || timer.kind !== kind)
            continue;
        removed.unshift(...timers.splice(index, 1));
    }
    return removed;
}
export function stopObjectTimer(object, kind) {
    if (!object)
        return null;
    const timers = timersFor(object);
    const index = timers.findIndex(timer => timer.kind === kind);
    if (index < 0)
        return null;
    const [timer] = timers.splice(index, 1);
    if (!timer)
        throw new Error(`Missing object timer at index ${index}`);
    object.timed = timers.length;
    return timer;
}
export function stopAllObjectTimers(object) {
    if (!object)
        return [];
    const timers = timersFor(object).splice(0);
    object.timed = 0;
    return timers;
}
export function objectsInTimerGraph(state = game) {
    const objects = [];
    const seen = new Set();
    const visit = (object) => {
        if (!object || seen.has(object))
            return;
        seen.add(object);
        objects.push(object);
        for (const content of object.contents || [])
            visit(content);
    };
    for (const column of state.level?.objects || [])
        for (const pile of column || [])
            for (const object of pile || [])
                visit(object);
    for (const object of state.level?.buriedObjects || [])
        visit(object);
    for (const object of state.inventory || [])
        visit(object);
    for (const object of state._tutorialState?.inventory || [])
        visit(object);
    for (const reference of state._luaObjectRefs || [])
        visit(reference.deref());
    for (const object of state.migratingObjects || [])
        visit(object);
    const monsters = (state.level?.monsters ?? []).concat(state._migratingMonsters ?? []);
    for (const monster of monsters) {
        for (const object of monster.minvent || [])
            visit(object);
        for (const object of monster.inventory || [])
            visit(object);
    }
    return objects;
}
function allowedKind(kind, allowedKinds) {
    return !allowedKinds || allowedKinds.has(kind);
}
function precedes(left, right) {
    return !right || left.timer.deadline < right.timer.deadline
        || (left.timer.deadline === right.timer.deadline
            && left.timer.order > right.timer.order);
}
export function peekNextDueObjectTimer(state = game, currentTurn = state.moves ?? 0, allowedKinds = null) {
    let next = null;
    for (const object of objectsInTimerGraph(state)) {
        for (const timer of timersFor(object)) {
            if (timer.deadline > currentTurn
                || !allowedKind(timer.kind, allowedKinds))
                continue;
            // timeout.c:insert_timer() inserts a new timer before the first
            // existing timer with an equal deadline.  Equal-time callbacks
            // therefore execute in descending insertion order. Restoring
            // reinserts timers without changing their diagnostic IDs.
            const candidate = { object, timer };
            if (precedes(candidate, next))
                next = candidate;
        }
    }
    for (const timer of levelTimersFor(state)) {
        if (timer.deadline > currentTurn
            || !allowedKind(timer.kind, allowedKinds))
            continue;
        const candidate = {
            object: null,
            position: { x: timer.x, y: timer.y },
            timer,
        };
        if (precedes(candidate, next))
            next = candidate;
    }
    return next;
}
export function claimNextDueObjectTimer(state = game, currentTurn = state.moves ?? 0, allowedKinds = null) {
    const next = peekNextDueObjectTimer(state, currentTurn, allowedKinds);
    if (!next)
        return null;
    if (next.object) {
        const timers = timersFor(next.object);
        const index = timers.indexOf(next.timer);
        if (index >= 0)
            timers.splice(index, 1);
        next.object.timed = timers.length;
    }
    else {
        const timers = levelTimersFor(state);
        const index = timers.indexOf(next.timer);
        if (index >= 0)
            timers.splice(index, 1);
    }
    return next;
}
export function objectTimers(object) {
    return timersFor(object).map(timer => ({ ...timer }));
}
export function copyObjectTimers(source, destination, state = game) {
    // C obj_split_timers() walks the queue in expiry order, including its
    // newest-first order for ties, before assigning the copied timer IDs.
    const timers = objectTimers(source).sort((left, right) => left.deadline - right.deadline || right.order - left.order);
    for (const timer of timers) {
        scheduleObjectTimer(destination, timer.kind, timer.deadline, state);
    }
    return objectTimers(destination);
}
export function levelTimers(state = game) {
    return levelTimersFor(state).map(timer => ({ ...timer }));
}
// C timeout.c: the timer queue holds object and level timers in one
// deadline-ordered list; insert_timer() places a new entry before existing
// equal-deadline entries, so ties run most recently inserted first.
export function queuedTimers(state = game) {
    const queued = [];
    for (const object of objectsInTimerGraph(state))
        for (const timer of timersFor(object))
            queued.push({ object, timer: { ...timer } });
    for (const timer of levelTimersFor(state))
        queued.push({ position: { x: timer.x, y: timer.y }, timer: { ...timer } });
    return queued.sort((left, right) => left.timer.deadline - right.timer.deadline || right.timer.order - left.timer.order);
}
// C timeout.c:obj_is_local(). Contents follow their outermost owner;
// objects carried by migrating monsters belong to the global batch.
function objectTimerIsGlobal(object, state) {
    let outer = object;
    while (outer.where === 'contained' && outer.container)
        outer = outer.container;
    if (outer.where === 'inventory' || outer.where === 'migrating')
        return true;
    return outer.where === 'minvent' && !!outer.ocarry
        && !!state._migratingMonsters?.includes(outer.ocarry);
}
// save_timers() writes queue order; restore_timers() calls insert_timer()
// for each saved entry. Equal-time entries reverse within each batch.
function restoreTimerBatch(timers, state) {
    const savedOrder = [...timers].sort((left, right) => left.deadline - right.deadline || right.order - left.order);
    for (const timer of savedOrder)
        timer.order = nextTimerOrder(state);
}
export function restoreLevelTimers(state = game) {
    const local = objectsInTimerGraph(state).filter(object => !objectTimerIsGlobal(object, state));
    restoreTimerBatch([
        ...local.flatMap(object => timersFor(object)), ...levelTimersFor(state),
    ], state);
}
export function restoreSavedTimers(state = game) {
    const global = objectsInTimerGraph(state).filter(object => objectTimerIsGlobal(object, state));
    restoreTimerBatch(global.flatMap(object => timersFor(object)), state);
    // dorecover() reloads the current level after the global state, placing
    // its timers ahead of equal-time global timers.
    restoreLevelTimers(state);
}
//# sourceMappingURL=object_timers.js.map