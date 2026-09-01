// C refs: mkobj.c splitobj() and invent.c obj_extract_self().

import { nextIdent } from './ident.js';
import { remove_object } from './mklev.js';
import { OBJECT_WEIGHT } from './object_data.js';

export function detachFloorObjectUnit(object, state) {
    const quantity = object?.quan ?? object?.quantity ?? 1;
    if (quantity <= 1) {
        remove_object(object);
        return object;
    }

    const unitWeight = Number.isFinite(OBJECT_WEIGHT[object.otyp])
        ? OBJECT_WEIGHT[object.otyp]
        : Math.max(1, Math.trunc((object.owt ?? quantity) / quantity));
    object.quan = object.quantity = quantity - 1;
    object.owt = Math.max(unitWeight, (object.owt ?? unitWeight) - unitWeight);
    return {
        ...object,
        o_id: nextIdent(state),
        quan: 1,
        quantity: 1,
        owt: unitWeight,
        where: 'free',
        objectTimers: [],
        timed: 0,
    };
}
