// Sources which make monsters fight under the hero's influence.
// C ref: youprop.h Conflict and artifact.c arti_invoke().
import { game } from './gstate.js';
import { RIN_CONFLICT } from './object_data.js';
import { propertyHasOtherSources, propertyIsActive, } from './properties.js';
function wearsConflictRing(state) {
    const right = state.uright ?? state.u?.uright;
    const left = state.uleft ?? state.u?.uleft;
    return right?.otyp === RIN_CONFLICT || left?.otyp === RIN_CONFLICT;
}
export function hasNonArtifactConflict(state = game) {
    return wearsConflictRing(state)
        || propertyHasOtherSources('conflict', state);
}
export function heroHasConflict(state = game) {
    return wearsConflictRing(state)
        || propertyIsActive('conflict', state);
}
export function syncHeroConflict(state = game) {
    const conflict = heroHasConflict(state);
    if (state.u)
        state.u.conflict = conflict;
    return conflict;
}
//# sourceMappingURL=hero_conflict.js.map