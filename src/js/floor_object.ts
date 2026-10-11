// Floor-object ownership and pile order.
// C refs: mkobj.c place_object(), remove_object(), splitobj(),
// obj_timer_checks(), and invent.c stackobj(), obj_extract_self().

import { isIceAt } from './terrain_properties.js';
import { newsym } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import { BOULDER, CORPSE } from './object_data.js';
import { costlyAdjacent, costlySpot } from './shk.js';
import {
    createdObjectNoLongerHeld, objectNoLongerHeld, objectNoLongerHeldSynchronously,
} from './object_release.js';
import { findObjectOwner } from './shop_loss.js';
import { vision_note_blocker_change } from './vision.js';
import { mergable, mergeObjectStacks } from './object_merge.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopObjectTimer,
} from './object_timers.js';
import { maybeUnhideAt } from './monster_hiding.js';

// Corpse rot and revival take twice as long while the body is on ice.
export function updateCorpseIceTimer(
    body: GameObject | null | undefined, x: number, y: number,
    isOnIce: boolean, state: GameState = game,
): boolean {
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

// C mkobj.c:obj_ice_effects(). Freezing also reaches corpses already buried.
export function updateIceObjectTimersAt(
    x: number, y: number, state: GameState = game, { includeBuried = false } = {},
): void {
    const level = requireGameLevel(state);
    const onIce = isIceAt(x, y, state);
    for (const object of level.objects[x]?.[y] || [])
        updateCorpseIceTimer(object, x, y, onIce, state);
    if (includeBuried) {
        for (const object of level.buriedObjects || []) {
            if (object.ox === x && object.oy === y)
                updateCorpseIceTimer(object, x, y, onIce, state);
        }
    }
}

function assertFreeObject(object: GameObject): void {
    if (object.where !== 'free')
        throw new Error(`floor placement requires a free object, got ${object.where}`);
}

export function placeCreatedObject(
    object: GameObject, x: number, y: number, state: GameState = game,
): GameObject {
    createdObjectNoLongerHeld(object, state);
    return linkFloorObject(object, x, y, state);
}

export function placeObjectSynchronously(
    object: GameObject, x: number, y: number, state: GameState = game,
): GameObject {
    assertFreeObject(object);
    objectNoLongerHeldSynchronously(object, state);
    return linkFloorObject(object, x, y, state);
}

export async function placeObject(
    object: GameObject, x: number, y: number, state: GameState = game,
): Promise<GameObject> {
    requireLiveGame(state);
    assertFreeObject(object);
    await objectNoLongerHeld(object, state);
    return linkFloorObject(object, x, y, state);
}

function linkFloorObject(object: GameObject, x: number, y: number, state: GameState): GameObject {
    const level = requireGameLevel(state);
    object.ox = x;
    object.oy = y;
    object.where = 'floor';
    state._fobjSerial = (state._fobjSerial || 0) + 1;
    object._fobjOrder = state._fobjSerial;
    const column = level.objects[x] ||= [];
    const pile = column[y] ||= [];
    let index = 0;
    if (object.otyp !== BOULDER)
        while (pile[index]?.otyp === BOULDER) index++;
    pile.splice(index, 0, object);
    if (object.otyp === BOULDER && state === game)
        vision_note_blocker_change(x, y);
    if (object.no_charge && !costlySpot(x, y, state)
        && !costlyAdjacent(findObjectOwner(object, x, y, state), x, y, state))
        object.no_charge = false;
    updateCorpseIceTimer(
        object, x, y, isIceAt(x, y, state), state,
    );
    return object;
}

export function stack_object(object: GameObject, state?: GameState): Promise<GameObject>;
export function stack_object(
    object: GameObject | null | undefined, state?: GameState,
): Promise<GameObject | null | undefined>;
export async function stack_object(
    object: GameObject | null | undefined, state: GameState = game,
): Promise<GameObject | null | undefined> {
    if (!object) return object;
    const pile = state.level?.objects?.[object.ox]?.[object.oy];
    if (!pile) return object;
    const existing = pile.find(candidate =>
        candidate !== object && mergable(object, candidate, state));
    if (!existing) return object;

    return await mergeObjectStacks(object, existing, state) || object;
}

export function remove_object<T extends GameObject | null | undefined>(
    object: T, state: GameState = game,
): T {
    if (!object || !state.level) return object;
    const pile = state.level.objects?.[object.ox]?.[object.oy];
    const index = pile?.indexOf(object) ?? -1;
    if (pile && index >= 0) pile.splice(index, 1);
    if (object.otyp === BOULDER && state === game)
        vision_note_blocker_change(object.ox, object.oy);
    object.where = 'free';
    updateCorpseIceTimer(object, object.ox, object.oy, false, state);
    return object;
}

// C hack.c:825-833 movobj().  Unlink the object from its floor pile,
// re-evaluate hiding at the vacated square, and relink at the destination.
// remove_object() leaves ox/oy intact, exactly like C, so the old square is
// still readable after the unlink.
export async function moveObject<T extends GameObject | null | undefined>(
    object: T, x: number, y: number, state: GameState = game,
): Promise<T> {
    requireLiveGame(state);
    if (!object || !state.level) return object;
    const oldX = object.ox;
    const oldY = object.oy;
    remove_object(object, state);
    maybeUnhideAt(oldX, oldY, state);
    newsym(oldX, oldY);
    await placeObject(object, x, y, state);
    newsym(x, y);
    return object;
}

export function detachFloorObjectUnit(object: GameObject, state: GameState): GameObject {
    const quantity = objectQuantity(object);
    if (quantity <= 1) {
        remove_object(object, state);
        return object;
    }

    const detached = splitObjectStack(object, 1, state);
    if (!detached) throw new Error(`Object ${object.o_id} cannot split into floor units`);
    return remove_object(detached, state);
}
