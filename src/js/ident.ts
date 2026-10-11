// ident.js — Shared object and monster identity allocation.
// C ref: mkobj.c next_ident().

import { game } from './gstate.js';
import type { GameObject } from './object_types.js';
import { rnd } from './rng.js';
import { objectPriceAdjustment } from './shk.js';

// Object and monster identities share one counter.  Every source call must
// pass through this boundary even when its caller only needs the RNG-visible
// side effect and does not retain the returned id yet.
export function nextIdent(state = game) {
    const ident = (typeof state._nextIdent === 'number' && Number.isInteger(state._nextIdent) ? state._nextIdent : 2) >>> 0;
    state._nextIdent = (ident + rnd(2)) >>> 0;
    if (!state._nextIdent) state._nextIdent = rnd(2) + 1;
    return ident;
}

// C mkobj.c nextoid(): a split or bill copy keeps the old price adjustment.
export function nextObjectId(oldObject: GameObject, newObject: GameObject, state = game) {
    const oldAdjustment = objectPriceAdjustment(oldObject, oldObject.o_id, state);
    let ident = (((state._nextIdent ?? 2) >>> 0) - 1) >>> 0;
    let tries = 256;
    do {
        ident = (ident + 1) >>> 0;
        if (!ident) ident = 1;
    } while (objectPriceAdjustment(newObject, ident, state) !== oldAdjustment
        && --tries >= 0);
    state._nextIdent = ident;
    nextIdent(state);
    return ident;
}
