// C refs: mkobj.c splitobj() and invent.c obj_extract_self().

import { remove_object } from './mklev.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';

export function detachFloorObjectUnit(object, state) {
    const quantity = objectQuantity(object);
    if (quantity <= 1) {
        remove_object(object);
        return object;
    }

    const detached = splitObjectStack(object, 1, state);
    detached.where = 'free';
    return detached;
}
