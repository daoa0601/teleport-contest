// Splitting one quantity from an ordinary object stack.
// C refs: mkobj.c splitobj()/unsplitobj().

import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { mergeObjectStacks } from './object_merge.js';
import { copyObjectTimers } from './object_timers.js';
import { objectWeight } from './weight.js';

export function objectQuantity(object) {
    if (!object) return 0;
    return Math.max(0, Math.trunc(
        object.quan ?? object.quantity ?? 1,
    ));
}

function setQuantity(object, count) {
    object.quan = object.quantity = count;
    object.owt = objectWeight(object);
}

function copyExtraData(object) {
    return object?.oextra ? { ...object.oextra } : object?.oextra;
}

export function splitObjectStack(
    object, count, state = game, objectId = null,
) {
    const total = objectQuantity(object);
    count = Math.trunc(count);
    if (!object || object.contents?.length || count <= 0 || count >= total)
        return null;

    const split = {
        ...object,
        o_id: objectId ?? nextIdent(state),
        oextra: copyExtraData(object),
        contents: [],
        objectTimers: [],
        timed: 0,
        owornmask: 0,
        worn: false,
        wornSlot: null,
        wielded: false,
        alternate: false,
        ready: false,
        pickup_prev: false,
        lua_ref_cnt: 0,
    };
    if (split.oextra) delete split.oextra.omid;

    setQuantity(object, total - count);
    setQuantity(split, count);
    copyObjectTimers(object, split, state);
    return split;
}

export function rejoinObjectStack(parent, split, state = game) {
    return mergeObjectStacks(parent, split, state);
}
