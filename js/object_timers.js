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
export function scheduleObjectTimer(object, kind, deadline, state = game) {
    if (!object || !OBJECT_TIMER_KINDS.has(kind) || !Number.isFinite(deadline))
        return null;
    const timers = timersFor(object);
    if (timers.some(timer => timer.kind === kind))
        return null;
    const timer = { kind, deadline, id: allocateTimerId(state) };
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
        kind, deadline, id: allocateTimerId(state), x, y,
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
    for (const monster of [...state.level?.monsters || [], ...state._migratingMonsters || []]) {
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
            && left.timer.id > right.timer.id);
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
            // therefore execute in descending timer-id/insertion order.
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
    for (const timer of objectTimers(source)) {
        scheduleObjectTimer(destination, timer.kind, timer.deadline, state);
    }
    return objectTimers(destination);
}
export function levelTimers(state = game) {
    return levelTimersFor(state).map(timer => ({ ...timer }));
}
//# sourceMappingURL=object_timers.js.map