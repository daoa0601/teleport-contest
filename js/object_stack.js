// Splitting one quantity from an ordinary object stack.
// C refs: mkobj.c splitobj()/unsplitobj().
import { game } from './gstate.js';
import { nextObjectId } from './ident.js';
import { mergeObjectStacks } from './object_merge.js';
import { copyObjectTimers } from './object_timers.js';
import { objectShedsLight } from './light.js';
import { TALLOW_CANDLE, WAX_CANDLE } from './object_data.js';
import { objectWeight } from './weight.js';
import { splitObjectBill } from './shk.js';
import { linkObjectAfter, sharesUnsplitChain } from './object_location.js';
export function objectQuantity(object) {
    if (!object)
        return 0;
    return Math.max(0, Math.trunc(object.quan ?? object.quantity ?? 1));
}
function setQuantity(object, count) {
    object.quan = object.quantity = count;
    object.owt = objectWeight(object);
}
export function splitObjectStack(object, count, state = game, objectId = null) {
    const total = objectQuantity(object);
    count = Math.trunc(count);
    if (!object || object.contents?.length || count <= 0 || count >= total)
        return null;
    const split = {
        ...object,
        contents: [],
        objectTimers: [],
        timed: 0,
        lamplit: false,
        owornmask: 0,
        worn: false,
        wornSlot: null,
        wielded: false,
        alternate: false,
        ready: false,
        pickup_prev: false,
        lua_ref_cnt: 0,
    };
    if (object.oextra) {
        split.oextra = structuredClone(object.oextra);
        delete split.oextra.omid;
    }
    split.o_id = objectId ?? nextObjectId(object, split, state);
    setQuantity(object, total - count);
    setQuantity(split, count);
    state.context.objsplit = { parent_oid: object.o_id, child_oid: split.o_id };
    linkObjectAfter(object, split, state);
    // C mkobj.c:494 splitobj(): an unpaid stack's bill follows the split.
    if (object.unpaid)
        splitObjectBill(object, split, state);
    copyObjectTimers(object, split, state);
    // splitobj() copies an active light source after copying its timers.
    // Each resulting candle stack has its own quantity-dependent radius.
    if (objectShedsLight(object)) {
        split.lamplit = true;
        if (object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE)
            state.vision_full_recalc = 1;
    }
    return split;
}
// C mkobj.c:unsplitobj(): floor, free, and other chains never rejoin.
export async function rejoinObjectStack(parent, split, state = game) {
    const latest = state.context.objsplit;
    if (latest?.parent_oid !== parent.o_id || latest.child_oid !== split.o_id)
        return null;
    if (!sharesUnsplitChain(parent, split, state))
        return null;
    return await mergeObjectStacks(parent, split, state);
}
export function clearSplitObjects(state = game) {
    state.context.objsplit = { parent_oid: 0, child_oid: 0 };
}
//# sourceMappingURL=object_stack.js.map