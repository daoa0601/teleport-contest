// Object ownership inside containers.
// C ref: mkobj.c:add_to_container().

import { game, requireLiveGame } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import { mergable, mergeCreatedObjectStacks, mergeObjectStacks } from './object_merge.js';
import {
    assertCreatedObject, createdObjectNoLongerHeld,
    objectNoLongerHeld,
} from './object_release.js';

function assertFreeObject(object: GameObject): void {
    if (object.where !== 'free')
        throw new Error(
            `add_to_container requires a free object, got ${object.where}`);
}

function containerStack(
    container: GameObject, object: GameObject, state: GameState,
): GameObject | undefined {
    container.contents ||= [];
    return container.contents.find(candidate => mergable(candidate, object, state));
}

function linkContainerObject(container: GameObject, object: GameObject): GameObject {
    object.where = 'contained';
    object.container = container;
    // C add_to_container() leaves ox/oy untouched, so an object taken from
    // the floor keeps its last square while inside the container.
    (container.contents ||= []).unshift(object);
    return object;
}

// C add_to_container(): the IMMEDIATE container's state decides the
// release - an inventory- or monster-held container keeps the addition
// held; any other container first releases the object. The release is
// async because it can charge a free incoming unpaid crysknife before
// the link.
export async function addObjectToContainer(
    container: GameObject | null, object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    requireLiveGame(state);
    if (!container || !object) return object;
    assertFreeObject(object);
    if (container.where !== 'inventory' && container.where !== 'minvent') {
        await objectNoLongerHeld(object, state);
    }
    const existing = containerStack(container, object, state);
    return existing ? await mergeObjectStacks(existing, object, state)
        : linkContainerObject(container, object);
}

// Constructor graphs cannot own a display continuation. The merge boundary
// also verifies that no billed or worn object reaches this synchronous path.
export async function addCreatedObjectToContainer(
    container: GameObject | null, object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    if (!container || !object) return object;
    assertFreeObject(object);
    if (container.where !== 'inventory' && container.where !== 'minvent') {
        createdObjectNoLongerHeld(object, state);
    } else {
        assertCreatedObject(object, state);
    }
    const existing = containerStack(container, object, state);
    return existing ? await mergeCreatedObjectStacks(existing, object, state)
        : linkContainerObject(container, object);
}
