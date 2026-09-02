// thrown_object.js — Shared splitobj()/freeinv() ownership for one throw.
// C refs: dothrow.c throw_obj(), invent.c freeinv(), mkobj.c splitobj().

import { LOST_THROWN } from './const.js';
import { splitObjectStack } from './object_stack.js';

const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];

// The caller must establish eligibility before crossing this boundary.  A
// stack allocates the source child identity before mutating the parent; a
// singleton detaches the exact carried identity.  Both leave throwit() with a
// free object whose loss provenance is LOST_THROWN.
export function detachThrownUnit(
    state, item, selectedQuantity, splitObjectId = null,
) {
    let thrown = item;
    if (selectedQuantity > 1) {
        thrown = splitObjectStack(
            item, 1, state, splitObjectId,
        );
        thrown.invlet = null;
        thrown.where = 'free';
    } else {
        const index = state.inventory.indexOf(item);
        if (index >= 0) state.inventory.splice(index, 1);
        for (const slot of EQUIPMENT_SLOTS) {
            if (state[slot] === item) state[slot] = null;
            if (state.u?.[slot] === item) state.u[slot] = null;
        }
        thrown.owornmask = 0;
        thrown.worn = false;
        thrown.wornSlot = null;
        thrown.ready = false;
        thrown.where = 'free';
    }
    thrown.how_lost = LOST_THROWN;
    return thrown;
}
