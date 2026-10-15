// Glob shrink timers.
// C refs: mkobj.c start_glob_timeout()/shrink_glob().

import { newsym, plineWithContinuation } from './display.js';
import { ICE, isok } from './const.js';
import { deallocateObject } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { game, requireLiveGame } from './gstate.js';
import { formatHeardMessage, formatSeenMessage } from './hero_speech.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { reconcileObjectDeletionBill } from './shk.js';
import {
    GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, OBJECT_NAMES,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import { absorbGlob, mergable } from './object_merge.js';
import {
    OBJECT_TIMER_KIND, objectsInTimerGraph, scheduleObjectTimer, stopObjectTimer,
} from './object_timers.js';
import { rn2 } from './rng.js';
import { cansee } from './vision.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import {
    encumbranceMessage, nearCapacity, objectWeight,
} from './weight.js';

import type { GameState } from './game_state.js';
import type { GameObject, ObjectTimer } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { DueObjectTimer } from './object_timers.js';

type RandomBelow = (limit: number) => number;
interface GlobMergeOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: RandomBelow;
}
interface GlobEventPosition extends Position { glob: GameObject }
interface ShrunkGlob extends GlobEventPosition {
    overdue: false;
    delta: 1;
    carrier: Monster | null;
    shrinkThreshold: boolean;
    gone: boolean;
    message: string | null;
}
export type GlobTimerEvent =
    | (GlobEventPosition & {
        overdue: true; delta: number; gone: boolean; message: null;
        delay?: number; finishPending?: never; followupMessage?: never;
    })
    | (GlobEventPosition & {
        overdue: false; delta: 0; gone: false; message: null;
        skippedEating: boolean; skippedIce: boolean;
        finishPending?: never; followupMessage?: never;
    })
    | (ShrunkGlob & { finishPending?: never; followupMessage?: never })
    | (ShrunkGlob & {
        finishPending: boolean;
        oldCapacity: number;
        finished?: true;
        followupMessage?: string | null;
        newCapacity?: number;
    });

function isGlobType(otyp: number): boolean {
    return otyp >= GLOB_OF_GRAY_OOZE && otyp <= GLOB_OF_BLACK_PUDDING;
}

function nearbyMergableGlob(glob: GameObject, x: number, y: number, state: GameState, random: RandomBelow): GameObject | null {
    const findAt = (nx: number, ny: number) => (state.level?.objects?.[nx]?.[ny] || [])
        .find(object => object !== glob && mergable(object, glob, state));
    const onSameSquare = findAt(x, y);
    if (onSameSquare) return onSameSquare;

    const xStep = random(2) ? -1 : 1;
    const yStep = random(2) ? -1 : 1;
    for (let nx = x - xStep; Math.abs(nx - x) < 2; nx += xStep) {
        for (let ny = y - yStep; Math.abs(ny - y) < 2; ny += yStep) {
            if (!isok(nx, ny) || (nx === x && ny === y)) continue;
            const nearby = findAt(nx, ny);
            if (nearby) return nearby;
        }
    }
    return null;
}

// C pudding_merge_message(): inventory merging remains noticeable while
// blind; visible monster/container merges can intentionally say nothing.
export async function announceGlobMerge(first: GameObject, second: GameObject, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation): Promise<void> {
    const visible = cansee(first.ox, first.oy) || cansee(second.ox, second.oy);
    const onFloor = first.where === 'floor' || second.where === 'floor';
    const inPack = first.where === 'inventory' || second.where === 'inventory';
    if ((!heroIsBlind(state) && visible) || inPack) {
        if (heroIsHallucinating(state)) {
            if (onFloor) await publish(formatSeenMessage('parts of the floor melting!', state));
            else if (inPack) await publish('Your pack reaches out and grabs something!');
        } else if (onFloor || inPack) {
            const adjacent = (first.ox !== state.u.ux || first.oy !== state.u.uy)
                && (second.ox !== state.u.ux || second.oy !== state.u.uy);
            await publish(`The ${onFloor && adjacent ? 'adjacent ' : ''}${
                makePlural(OBJECT_NAMES[first.otyp] || 'glob')} coalesce${
                inPack ? ' inside your pack' : ''}.`);
        }
    } else {
        const heard = formatHeardMessage('a faint sloshing sound.', state);
        if (heard) await publish(heard);
    }
}

// C flooreffects()/obj_meld(): a free glob is always absorbed by a floor
// glob, even when the landing glob is heavier. Otherwise it remains free.
export async function meldLandingGlob(glob: GameObject, x: number, y: number, {
    state = game,
    publish = plineWithContinuation,
    random = rn2,
}: GlobMergeOptions = {}): Promise<GameObject | null> {
    requireLiveGame(state);
    const nearby = nearbyMergableGlob(glob, x, y, state, random);
    if (!nearby) return null;
    await announceGlobMerge(glob, nearby, state, publish);
    return await absorbGlob(nearby, glob, state, { publish });
}

export async function meldNearbyFloorGlobs(glob: GameObject, {
    state = game,
    publish = plineWithContinuation,
    random = rn2,
}: GlobMergeOptions = {}): Promise<GameObject> {
    let combined = glob;
    for (;;) {
        const nearby = nearbyMergableGlob(
            combined, combined.ox, combined.oy, state, random,
        );
        if (!nearby) return combined;
        await announceGlobMerge(combined, nearby, state, publish);

        const equalWeight = combined.owt === nearby.owt;
        const combinedSurvives = combined.owt > nearby.owt
            || (equalWeight && random(2) !== 0);
        const survivor = combinedSurvives ? combined : nearby;
        const absorbed = combinedSurvives ? nearby : combined;
        const oldX = absorbed.ox;
        const oldY = absorbed.oy;
        combined = await absorbGlob(survivor, absorbed, state, { publish });
        if (state === game && cansee(oldX, oldY)) newsym(oldX, oldY);
        maybeUnhideAt(oldX, oldY, state);
    }
}

function scheduleNextGlobAttempt(glob: GameObject, state: GameState, currentTurn: number, delay = 0): ObjectTimer | null {
    stopObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB);
    const turns = delay > 0 ? delay : 23 + rn2(5);
    return scheduleObjectTimer(
        glob, OBJECT_TIMER_KIND.SHRINK_GLOB,
        currentTurn + turns, state,
    );
}

export function startGlobTimeout(
    glob: GameObject, state: GameState = game, currentTurn = state.moves ?? 0, delay = 0,
) {
    return scheduleNextGlobAttempt(glob, state, currentTurn, delay);
}

function floorGlobName(glob: GameObject): string {
    const partlyEaten = (glob.oeaten ?? 0) > 0 ? 'partly eaten ' : '';
    const type = OBJECT_NAMES[glob.otyp] || 'glob';
    const given = glob.oextra?.oname || glob.oname;
    return `${partlyEaten}${type}${given ? ` named ${given}` : ''}`;
}

function parentContainer(object: GameObject, state: GameState): GameObject | null {
    if (object.container) return object.container;
    return objectsInTimerGraph(state).find(candidate =>
        candidate !== object && candidate.contents?.includes(object)) ?? null;
}

function carryingMonster(object: GameObject, state: GameState): Monster | null {
    if (object.ocarry) return object.ocarry;
    return (state.level?.monsters || []).find(monster =>
        monster.m_id === object.carrierMid
        || (monster.minvent || monster.inventory || []).includes(object)) ?? null;
}

function outermostContainer(object: GameObject, state: GameState): GameObject {
    let outer = object;
    const seen = new Set<GameObject>();
    while (outer?.where === 'contained' && !seen.has(outer)) {
        seen.add(outer);
        const parent = parentContainer(outer, state);
        if (!parent) break;
        outer = parent;
    }
    return outer;
}

function objectLocation(object: GameObject, state: GameState): Position | null {
    const outer = outermostContainer(object, state);
    if (!outer) return null;
    if (outer.where === 'floor' || outer.where === 'buried')
        return { x: outer.ox, y: outer.oy };
    if (outer.where === 'inventory')
        return { x: state.u?.ux, y: state.u?.uy };
    if (outer.where === 'minvent') {
        const monster = carryingMonster(outer, state);
        if (monster) return { x: monster.mx, y: monster.my };
    }
    return null;
}

function globIceState(glob: GameObject, state: GameState): 'none' | 'buried' | 'on-ice' {
    const outer = outermostContainer(glob, state);
    if (!outer || !['floor', 'buried'].includes(outer.where)) return 'none';
    if (state.level?.at?.(outer.ox, outer.oy)?.typ !== ICE) return 'none';
    return outer.where === 'buried' ? 'buried' : 'on-ice';
}

function updateContainerWeights(container: GameObject, state: GameState): void {
    let current: GameObject | null = container;
    const seen = new Set<GameObject>();
    while (current && !seen.has(current)) {
        seen.add(current);
        current.owt = objectWeight(current);
        current = current.where === 'contained'
            ? parentContainer(current, state) : null;
    }
}

function objectName(object: GameObject): string {
    const type = OBJECT_NAMES[object.otyp] || 'object';
    const given = object.oextra?.oname || object.oname;
    return `${type}${given ? ` named ${given}` : ''}`;
}

function clearHeroEquipment(object: GameObject, state: GameState): void {
    const slots = [
        'uwep', 'uswapwep', 'uquiver',
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ] as const;
    let removed = !!(object.owornmask || object.worn || object.wielded
        || object.alternate || object.ready);
    for (const slot of slots) {
        if (state[slot] === object) {
            state[slot] = null;
            removed = true;
        }
        if (state.u?.[slot] === object) {
            state.u[slot] = null;
            removed = true;
        }
    }
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    if (removed) state._occupation = null;
}

function deleteGlob(glob: GameObject, state: GameState): void {
    const where = glob.where;
    const x = glob.ox, y = glob.oy;
    if (where === 'inventory') {
        clearHeroEquipment(glob, state);
    } else if (where === 'migrating') {
        glob.owornmask = 0;
    } else if (where === 'minvent' && glob.ocarry?.mw === glob) {
        glob.ocarry.mw = null;
        glob.owornmask = 0;
    }
    unlinkObject(glob, state);
    if (where === 'floor') maybeUnhideAt(x, y, state);
    if (state.context.victual?.piece === glob) state.context.victual = null;
    // obfree() retains a consumed shop object for itemized billing.
    if (reconcileObjectDeletionBill(glob, null, state) === 'retained') return;
    deallocateObject(glob, state);
}

function activelyEatingGlob(glob: GameObject, state: GameState): boolean {
    return state._occupation?.key === 'eat-food'
        && state.context.victual?.piece === glob;
}

export function runClaimedGlobTimer(
    claimed: DueObjectTimer | null, state: GameState = game, currentTurn = state.moves ?? 0,
): GlobTimerEvent | null {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.SHRINK_GLOB)
        return null;
    const glob = claimed.object;
    if (!glob?.globby || !isGlobType(glob.otyp)) {
        throw new Error('SHRINK_GLOB requires a live glob');
    }
    if (!Number.isInteger(glob.owt) || glob.owt < 0)
        throw new Error('SHRINK_GLOB requires a nonnegative weight');

    const where = glob.where;
    const inInventory = where === 'inventory';
    const container = where === 'contained'
        ? parentContainer(glob, state) : null;
    const outer = container ? outermostContainer(glob, state) : glob;
    const containerInInventory = !!container && outer?.where === 'inventory';
    const updatesHeroInventory = inInventory || containerInInventory;
    const carrier = where === 'minvent'
        ? carryingMonster(glob, state) : null;
    const location = objectLocation(glob, state);
    const x = location?.x ?? 0;
    const y = location?.y ?? 0;
    const ice = globIceState(glob, state);
    const oldCapacity = updatesHeroInventory ? nearCapacity(state) : null;

    const deadline = claimed.timer.deadline;
    if (deadline < currentTurn && ice !== 'buried') {
        const missedShrinks = Math.trunc(
            (currentTurn - deadline + 24) / 25,
        );
        const delay = 25 - (missedShrinks % 25);
        const delta = ice === 'on-ice'
            ? Math.trunc((missedShrinks + 2) / 3)
            : missedShrinks;
        if (delta >= glob.owt) {
            glob.owt = 0;
            deleteGlob(glob, state);
            return {
                glob, x, y, overdue: true, delta,
                gone: true, message: null,
            };
        }
        glob.owt -= delta;
        if (container) updateContainerWeights(container, state);
        scheduleNextGlobAttempt(glob, state, currentTurn, delay);
        return {
            glob, x, y, overdue: true, delta, delay,
            gone: false, message: null,
        };
    }

    const beingEaten = activelyEatingGlob(glob, state);
    const waitsOnIce = ice === 'buried'
        || (ice === 'on-ice' && currentTurn % 3 === 1);
    if (beingEaten || waitsOnIce) {
        scheduleNextGlobAttempt(glob, state, currentTurn);
        return {
            glob, x, y, overdue: false,
            skippedEating: beingEaten,
            skippedIce: waitsOnIce,
            delta: 0, gone: false, message: null,
        };
    }

    const name = floorGlobName(glob);
    const oldTopWeight = containerInInventory ? objectWeight(outer) : null;
    const shrinkThreshold = glob.owt > 0 && glob.owt % 10 === 0;
    if (glob.owt > 0) {
        glob.owt--;
        if ((glob.oeaten ?? 0) > 1) glob.oeaten = (glob.oeaten ?? 0) - 1;
    }
    const gone = glob.owt === 0;
    if (container) updateContainerWeights(container, state);

    let message: string | null = null;
    if (inInventory && (shrinkThreshold || gone)) {
        message = `Your ${name} ${
            gone ? 'dissolves completely' : 'shrinks'
        }.`;
    } else if (containerInInventory) {
        const newTopWeight = outer.owt;
        const newCapacity = nearCapacity(state);
        if (gone
            || (shrinkThreshold && newTopWeight !== oldTopWeight)
            || newCapacity !== oldCapacity) {
            const change = newTopWeight !== oldTopWeight
                ? 'becomes' : 'seems';
            message = `Your ${objectName(outer)} ${change}${
                gone ? '' : ' slightly'
            } lighter.`;
        }
    }

    if (updatesHeroInventory) {
        if (oldCapacity === null) throw new Error('A carried glob requires its previous encumbrance');
        return {
            glob, x, y, carrier, overdue: false, delta: 1,
            shrinkThreshold, gone, message, oldCapacity,
            finishPending: true,
        };
    }

    if (gone) {
        const visible = where === 'floor' && cansee(x, y);
        deleteGlob(glob, state);
        if (visible) {
            newsym(x, y);
            const article = x === state.u?.ux && y === state.u?.uy
                ? 'The' : 'A';
            message = `${article} ${name} fades away.`;
        }
    } else {
        scheduleNextGlobAttempt(glob, state, currentTurn);
    }
    return {
        glob, x, y, carrier, overdue: false, delta: 1,
        shrinkThreshold, gone, message,
    };
}

export function finishGlobTimer(
    event: GlobTimerEvent | null, state: GameState = game, currentTurn = state.moves ?? 0,
): GlobTimerEvent | null {
    if (!event?.finishPending || !event.glob) return event;
    if (event.gone) deleteGlob(event.glob, state);
    else scheduleNextGlobAttempt(event.glob, state, currentTurn);
    const newCapacity = nearCapacity(state);
    event.followupMessage = encumbranceMessage(
        event.oldCapacity, newCapacity,
    ) || null;
    event.newCapacity = newCapacity;
    event.finishPending = false;
    event.finished = true;
    return event;
}
