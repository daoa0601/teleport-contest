// Sources which make monsters fight under the hero's influence.
// C ref: youprop.h Conflict and artifact.c arti_invoke().
import { game } from './gstate.js';
import { RIN_CONFLICT } from './object_data.js';
import { propertyHasOtherSources, propertyIsActive, } from './properties.js';
// Part of C worn.c:setworn(): the worn-ring source of the youprop.h:Conflict
// extrinsic (C ORs the ring's W_ mask into uprops[CONFLICT].extrinsic).
function wearsConflictRing(state) {
    const right = state.uright ?? state.u?.uright;
    const left = state.uleft ?? state.u?.uleft;
    return right?.otyp === RIN_CONFLICT || left?.otyp === RIN_CONFLICT;
}
// Part of C eat.c:gethungry(): the HConflict || (EConflict & ~W_ARTI) test.
export function hasNonArtifactConflict(state = game) {
    return wearsConflictRing(state)
        || propertyHasOtherSources('conflict', state);
}
// C youprop.h:Conflict(): the combined intrinsic/extrinsic property,
// as C's macro evaluates it at each call site.
export function heroHasConflict(state = game) {
    return wearsConflictRing(state)
        || propertyIsActive('conflict', state);
}
// Port only: cache the Conflict value on the hero (C re-evaluates the macro).
export function syncHeroConflict(state = game) {
    const conflict = heroHasConflict(state);
    if (state.u)
        state.u.conflict = conflict;
    return conflict;
}
//# sourceMappingURL=hero_conflict.js.map