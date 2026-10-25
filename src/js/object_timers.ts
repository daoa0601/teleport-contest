// object_timers.js — Saveable object and level-position timer ordering.
// C ref: timeout.c start_timer()/insert_timer()/run_timers().

import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject, ObjectTimer, ObjectTimerKind, LevelTimer } from './object_types.js';

type TimerKind = ObjectTimerKind | LevelTimer['kind'];

export type DueObjectTimer = {
    object: GameObject;
    timer: ObjectTimer;
} | {
    object: null;
    position: { x: number; y: number };
    timer: LevelTimer;
};

export const OBJECT_TIMER_KIND = Object.freeze({
    ROT_ORGANIC: 'rot-organic',
    ROT_CORPSE: 'rot-corpse',
    REVIVE_MON: 'revive-mon',
    ZOMBIFY_MON: 'zombify-mon',
    BURN_OBJECT: 'burn-object',
    HATCH_EGG: 'hatch-egg',
    SHRINK_GLOB: 'shrink-glob',
    FIG_TRANSFORM: 'fig-transform',
} as const);

export const LEVEL_TIMER_KIND = Object.freeze({
    MELT_ICE_AWAY: 'melt-ice-away',
} as const);

const OBJECT_TIMER_KINDS = new Set(Object.values(OBJECT_TIMER_KIND));

function timersFor(object: GameObject | null | undefined): ObjectTimer[] {
    if (!object) return [];
    if (!Array.isArray(object.objectTimers))
        object.objectTimers = [];
    object.timed = object.objectTimers.length;
    return object.objectTimers;
}

function levelTimersFor(state: GameState = game): LevelTimer[] {
    if (!state.level) return [];
    if (!Array.isArray(state.level.levelTimers))
        state.level.levelTimers = [];
    return state.level.levelTimers;
}

function allocateTimerId(state: GameState = game): number {
    const prior = state._nextObjectTimerId ?? 0;
    const id = prior + 1;
    state._nextObjectTimerId = id;
    return id;
}

export function scheduleObjectTimer(
    object: GameObject | null | undefined, kind: ObjectTimerKind,
    deadline: number, state: GameState = game,
): ObjectTimer | null {
    if (!object || !OBJECT_TIMER_KINDS.has(kind) || !Number.isFinite(deadline))
        return null;
    const timers = timersFor(object);
    if (timers.some(timer => timer.kind === kind)) return null;
    const timer = { kind, deadline, id: allocateTimerId(state) };
    timers.push(timer);
    object.timed = timers.length;
    return timer;
}

export function scheduleLevelTimer(
    x: number, y: number, kind: LevelTimer['kind'],
    deadline: number, state: GameState = game,
): LevelTimer | null {
    if (!state.level || kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || !Number.isInteger(x) || !Number.isInteger(y)
        || !Number.isFinite(deadline)) return null;
    const timers = levelTimersFor(state);
    if (timers.some(timer => timer.x === x && timer.y === y && timer.kind === kind)) return null;
    const timer = {
        kind, deadline, id: allocateTimerId(state), x, y,
    };
    timers.push(timer);
    return timer;
}

export function stopLevelTimer(
    x: number, y: number, kind: LevelTimer['kind'], state: GameState = game,
): LevelTimer[] {
    const timers = levelTimersFor(state);
    const removed: LevelTimer[] = [];
    for (let index = timers.length - 1; index >= 0; index--) {
        const timer = timers[index];
        if (!timer) throw new Error(`Missing level timer at index ${index}`);
        if (timer.x !== x || timer.y !== y || timer.kind !== kind) continue;
        removed.unshift(...timers.splice(index, 1));
    }
    return removed;
}

export function stopObjectTimer(
    object: GameObject | null | undefined, kind: ObjectTimerKind | null,
): ObjectTimer | null {
    if (!object) return null;
    const timers = timersFor(object);
    const index = timers.findIndex(timer => timer.kind === kind);
    if (index < 0) return null;
    const [timer] = timers.splice(index, 1);
    if (!timer) throw new Error(`Missing object timer at index ${index}`);
    object.timed = timers.length;
    return timer;
}

export function stopAllObjectTimers(
    object: GameObject | null | undefined,
): ObjectTimer[] {
    if (!object) return [];
    const timers = timersFor(object).splice(0);
    object.timed = 0;
    return timers;
}

export function objectsInTimerGraph(state: GameState = game): GameObject[] {
    const objects: GameObject[] = [];
    const seen = new Set<GameObject>();
    const visit = (object: GameObject | null | undefined): void => {
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
    for (const object of state._tutorialState?.inventory || []) visit(object);
    for (const reference of state._luaObjectRefs || []) visit(reference.deref());
    for (const object of state.migratingObjects || []) visit(object);
    const monsters = (state.level?.monsters ?? []).concat(state._migratingMonsters ?? []);
    for (const monster of monsters) {
        for (const object of monster.minvent || []) visit(object);
        for (const object of monster.inventory || []) visit(object);
    }
    return objects;
}

function allowedKind(
    kind: TimerKind, allowedKinds: ReadonlySet<TimerKind> | null,
): boolean {
    return !allowedKinds || allowedKinds.has(kind);
}

function precedes(left: DueObjectTimer, right: DueObjectTimer | null): boolean {
    return !right || left.timer.deadline < right.timer.deadline
        || (left.timer.deadline === right.timer.deadline
            && left.timer.id > right.timer.id);
}

export function peekNextDueObjectTimer(
    state: GameState = game, currentTurn: number = state.moves ?? 0,
    allowedKinds: ReadonlySet<TimerKind> | null = null,
): DueObjectTimer | null {
    let next: DueObjectTimer | null = null;
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
    state: GameState = game, currentTurn: number = state.moves ?? 0,
    allowedKinds: ReadonlySet<TimerKind> | null = null,
): DueObjectTimer | null {
    const next = peekNextDueObjectTimer(state, currentTurn, allowedKinds);
    if (!next) return null;
    if (next.object) {
        const timers = timersFor(next.object);
        const index = timers.indexOf(next.timer);
        if (index >= 0) timers.splice(index, 1);
        next.object.timed = timers.length;
    } else {
        const timers = levelTimersFor(state);
        const index = timers.indexOf(next.timer);
        if (index >= 0) timers.splice(index, 1);
    }
    return next;
}

export function objectTimers(object: GameObject | null | undefined): ObjectTimer[] {
    return timersFor(object).map(timer => ({ ...timer }));
}

export function copyObjectTimers(
    source: GameObject | null | undefined, destination: GameObject,
    state: GameState = game,
): ObjectTimer[] {
    // C obj_split_timers() walks the queue in expiry order, including its
    // newest-first order for ties, before assigning the copied timer IDs.
    const timers = objectTimers(source).sort((left, right) =>
        left.deadline - right.deadline || right.id - left.id);
    for (const timer of timers) {
        scheduleObjectTimer(
            destination, timer.kind, timer.deadline, state,
        );
    }
    return objectTimers(destination);
}

export function levelTimers(state: GameState = game): LevelTimer[] {
    return levelTimersFor(state).map(timer => ({ ...timer }));
}

export interface QueuedObjectTimer {
    object: GameObject;
    timer: ObjectTimer;
}

export interface QueuedLevelTimer {
    position: { x: number; y: number };
    timer: LevelTimer;
}

export type QueuedTimer = QueuedObjectTimer | QueuedLevelTimer;

// C timeout.c: the timer queue holds object and level timers in one
// deadline-ordered list; insert_timer() places a new entry before existing
// equal-deadline entries, so ties run newest (highest id) first.
export function queuedTimers(state: GameState = game): QueuedTimer[] {
    const queued: QueuedTimer[] = [];
    for (const object of objectsInTimerGraph(state))
        for (const timer of timersFor(object))
            queued.push({ object, timer: { ...timer } });
    for (const timer of levelTimersFor(state))
        queued.push({ position: { x: timer.x, y: timer.y }, timer: { ...timer } });
    return queued.sort((left, right) =>
        left.timer.deadline - right.timer.deadline || right.timer.id - left.timer.id);
}
