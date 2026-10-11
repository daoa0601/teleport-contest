// Object ownership inside containers.
// C ref: mkobj.c:add_to_container().
import { game, requireLiveGame } from './gstate.js';
import { mergable, mergeCreatedObjectStacks, mergeObjectStacks } from './object_merge.js';
import { assertCreatedObject, createdObjectNoLongerHeld, objectNoLongerHeld, } from './object_release.js';
function assertFreeObject(object) {
    if (object.where !== 'free')
        throw new Error(`add_to_container requires a free object, got ${object.where}`);
}
function containerStack(container, object, state) {
    container.contents ||= [];
    return container.contents.find(candidate => mergable(candidate, object, state));
}
function linkContainerObject(container, object) {
    object.where = 'contained';
    object.container = container;
    object.ox = 0;
    object.oy = 0;
    (container.contents ||= []).unshift(object);
    return object;
}
// C add_to_container(): the IMMEDIATE container's state decides the
// release - an inventory- or monster-held container keeps the addition
// held; any other container first releases the object. The release is
// async because it can charge a free incoming unpaid crysknife before
// the link.
export async function addObjectToContainer(container, object, state = game) {
    requireLiveGame(state);
    if (!container || !object)
        return object;
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
export async function addCreatedObjectToContainer(container, object, state = game) {
    if (!container || !object)
        return object;
    assertFreeObject(object);
    if (container.where !== 'inventory' && container.where !== 'minvent') {
        createdObjectNoLongerHeld(object, state);
    }
    else {
        assertCreatedObject(object, state);
    }
    const existing = containerStack(container, object, state);
    return existing ? await mergeCreatedObjectStacks(existing, object, state)
        : linkContainerObject(container, object);
}
//# sourceMappingURL=object_container.js.map