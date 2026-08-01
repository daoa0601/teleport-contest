// ident.js — Shared object and monster identity allocation.
// C ref: mkobj.c next_ident().

import { game } from './gstate.js';
import { rnd } from './rng.js';

// Object and monster identities share one counter.  Every source call must
// pass through this boundary even when its caller only needs the RNG-visible
// side effect and does not retain the returned id yet.
export function nextIdent() {
    const ident = Number.isInteger(game._nextIdent) ? game._nextIdent : 2;
    game._nextIdent = ident + rnd(2);
    return ident;
}
