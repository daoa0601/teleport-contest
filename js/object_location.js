// Unlink an object without destroying it or its contents.
// C mkobj.c:obj_extract_self(). Equipment effects belong to the caller.
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import { objectsInTimerGraph } from './object_timers.js';
import { objectWeight } from './weight.js';
// C zap.c:get_obj_location(). Free and migrating objects have no current
// location even when their coordinate fields still contain an old square.
export function getObjectLocation(object, state = game, { contained = false, buried = false } = {}) {
    switch (object.where) {
        case 'free':
        case 'gone':
        case 'migrating':
        case 'onbill':
            return null;
        case 'inventory':
            return { x: state.u.ux, y: state.u.uy };
        case 'floor':
            return { x: object.ox, y: object.oy };
        case 'minvent': {
            const carrier = object.ocarry;
            if (!carrier)
                throw new Error(`Monster-carried object ${object.o_id} has no owner`);
            if (carrier.mx)
                return { x: carrier.mx, y: carrier.my };
            break;
        }
        case 'buried':
            if (buried)
                return { x: object.ox, y: object.oy };
            break;
        case 'contained':
            if (contained) {
                const container = object.container ||
                    objectsInTimerGraph(state).find((candidate) => candidate.contents?.includes(object));
                if (container)
                    return getObjectLocation(container, state, { contained, buried });
            }
            break;
    }
    return null;
}
export function unlinkObject(object, state = game) {
    if (object.where === 'floor') {
        remove_object(object, state);
    }
    else if (object.where === 'contained') {
        let parent = object.container?.contents?.includes(object)
            ? object.container
            : objectsInTimerGraph(state).find((candidate) => candidate !== object && candidate.contents?.includes(object));
        if (parent?.contents)
            parent.contents = parent.contents.filter((item) => item !== object);
        const updated = new Set();
        while (parent && !updated.has(parent)) {
            updated.add(parent);
            parent.owt = objectWeight(parent);
            parent = parent.container ?? undefined;
        }
    }
    else if (object.where === 'inventory') {
        state.inventory = state.inventory.filter((item) => item !== object);
    }
    else if (object.where === 'buried') {
        if (!state.level?.buriedObjects)
            throw new Error(`Buried object ${object.o_id} has no burial list`);
        state.level.buriedObjects = state.level.buriedObjects.filter((item) => item !== object);
    }
    else if (object.where === 'onbill') {
        if (!state.billObjects)
            throw new Error(`Billed object ${object.o_id} has no bill list`);
        state.billObjects = state.billObjects.filter((item) => item !== object);
    }
    else if (object.where === 'migrating') {
        if (!state.migratingObjects)
            throw new Error(`Migrating object ${object.o_id} has no migration list`);
        state.migratingObjects = state.migratingObjects.filter((item) => item !== object);
    }
    else if (object.where === 'minvent') {
        const carrier = object.ocarry;
        if (!carrier)
            throw new Error(`Monster-carried object ${object.o_id} has no owner`);
        unlinkMonsterObject(carrier, object);
    }
    object.where = 'free';
    object.buried = false;
    object.container = null;
    object.ocarry = null;
    delete object.carrierMid;
    return object;
}
// The chain that holds an object, for linking a neighbor beside it. Free
// objects have none.
function ownerChain(object, state) {
    switch (object.where) {
        case 'free':
            return null;
        case 'inventory':
            return state.inventory;
        case 'floor':
            return state.level?.objects[object.ox]?.[object.oy];
        case 'contained':
            return (object.container ?? objectsInTimerGraph(state).find((candidate) => candidate.contents?.includes(object)))?.contents;
        case 'minvent': {
            const owner = object.ocarry;
            if (!owner)
                throw new Error(`Monster-carried object ${object.o_id} has no owner`);
            return owner.minvent || owner.inventory;
        }
        case 'buried':
            return state.level?.buriedObjects;
        case 'migrating':
            return state.migratingObjects;
        case 'onbill':
            return state.billObjects;
        case 'gone':
            throw new Error(`Object ${object.o_id} is gone`);
    }
}
// C mkobj.c:splitobj() links the new piece right after the original in
// whatever chain owns it (nobj, and nexthere on the floor), so the piece
// stays where the original is until a caller extracts it.
export function linkObjectAfter(object, next, state = game) {
    if (object.where === 'free')
        return;
    const chain = ownerChain(object, state);
    const index = chain?.indexOf(object) ?? -1;
    if (!chain || index < 0)
        throw new Error(`Object ${object.o_id} is missing from its ${object.where} chain`);
    chain.splice(index + 1, 0, next);
}
// C mkobj.c:unsplitobj() only searches carried, monster-carried, and
// contained chains; both halves must share one.
export function sharesUnsplitChain(parent, child, state = game) {
    if (child.where !== 'inventory' && child.where !== 'minvent' && child.where !== 'contained')
        return false;
    return !!ownerChain(child, state)?.includes(parent);
}
// C mkobj.c:replace_object(). Keep the owner's order without pickup,
// dropping, merging, or transferring the old object's timers.
export function replaceObject(object, replacement, state = game) {
    if (replacement.where !== 'free')
        throw new Error('object replacement requires a free new object');
    const where = object.where;
    let chain;
    switch (where) {
        case 'free':
            break;
        case 'inventory':
            chain = state.inventory;
            break;
        case 'floor':
            if (!state.level)
                throw new Error('Floor object replacement requires a level');
            chain = state.level.objects[object.ox]?.[object.oy] ?? undefined;
            replacement.ox = object.ox;
            replacement.oy = object.oy;
            if (object._fobjOrder !== undefined)
                replacement._fobjOrder = object._fobjOrder;
            else
                delete replacement._fobjOrder;
            break;
        case 'contained': {
            const owner = object.container ||
                objectsInTimerGraph(state).find((candidate) => candidate.contents?.includes(object));
            chain = owner?.contents;
            replacement.container = owner ?? null;
            break;
        }
        case 'minvent': {
            const owner = object.ocarry;
            if (!owner)
                throw new Error(`Monster-carried object ${object.o_id} has no owner`);
            chain = owner.minvent || owner.inventory;
            replacement.ocarry = owner;
            replacement.carrierMid = owner.m_id;
            break;
        }
        case 'buried':
        case 'gone':
        case 'migrating':
        case 'onbill':
        default:
            throw new Error(`replace_object: unsupported object position ${where}`);
    }
    if (where !== 'free') {
        const index = chain?.indexOf(object) ?? -1;
        if (!chain || index < 0)
            throw new Error(`replace_object: object missing from ${where}`);
        chain[index] = replacement;
    }
    replacement.where = where;
    object.where = 'free';
    object.container = null;
    object.ocarry = null;
    delete object.carrierMid;
}
//# sourceMappingURL=object_location.js.map