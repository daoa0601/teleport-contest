// Hero weapon and quiver slot changes.
// C refs: wield.c setuwep(), setuswapwep(), setuqwep(), uwepgone().

import { W_WEAPONS } from './const.js';
import { game } from './gstate.js';

export function releaseWeaponSlots(object, state = game) {
    if (!object) return;
    const primary = state.uwep === object || state.u?.uwep === object;
    const secondary = state.uswapwep === object
        || state.u?.uswapwep === object;

    if (state.uwep === object) state.uwep = null;
    if (state.u?.uwep === object) state.u.uwep = null;
    if (state.uswapwep === object) state.uswapwep = null;
    if (state.u?.uswapwep === object) state.u.uswapwep = null;
    if (state.uquiver === object) state.uquiver = null;
    if (state.u?.uquiver === object) state.u.uquiver = null;

    if (primary) state._unweapon = true;
    if ((primary || secondary) && state.u) state.u.twoweap = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEAPONS;
}
