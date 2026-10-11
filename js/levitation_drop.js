// C do.c:drop() finesse for dropping an invoked levitation artifact while
// unable to reach the floor: finesse_ahriman() (artifact.c) decides whether
// freeinv() would end levitation, pins a carried W_ART source so the hero
// stays aloft through freeinv()/hitfloor(), and the caller lands the hero
// afterwards with the explicit float-down below.
import { I_SPECIAL, TIMEOUT, W_ART, W_ARTI } from './const.js';
import { artifactById } from './artifacts.js';
import { game, requireLiveGame } from './gstate.js';
import { clearLevitationMasks, hasInvokedProperty, propertyIsActive, restoreLevitationSources, setCarriedProperty, setInvokedProperty, stashLevitationSources, } from './properties.js';
import { floatHeroDown } from './terrain_movement.js';
// C finesse_ahriman(): true when dropping `object` would toggle levitation
// off inside freeinv().  On true, the invoked source is replaced by an
// explicit carried source (C `ELevitation = W_ART`), so set_artifact_
// intrinsic()'s `(ELevitation & W_ARTI)` test fails, arti_invoke() never
// runs, no invoke downtime is rolled, and levitation survives until
// finishLevitatingArtifactDrop().  Timeouts and intrinsics are retained.
export function beginLevitatingArtifactDrop(object, state = game) {
    requireLiveGame(state);
    if (!object)
        return false;
    // if we aren't levitating or this isn't an artifact which confers
    // levitation via #invoke then freeinv() won't toggle levitation
    if (!propertyIsActive('levitation', state))
        return false;
    const artifact = object?.oartifact != null
        ? artifactById(object.oartifact, state) : null;
    if (artifact?.invokePower !== 'levitation'
        || !hasInvokedProperty('levitation', state))
        return false;
    // Probe ahead, exactly as C does: save the whole property, clear
    // I_SPECIAL|TIMEOUT and W_ARTI, and see whether levitation would end.
    // Any other source - worn, innate, carried - keeps the hero aloft, so
    // the drop needs no finesse; the potion timeout does not count because
    // the probe clears it with the masks the finish call will apply.
    const stash = stashLevitationSources(state);
    clearLevitationMasks(I_SPECIAL | TIMEOUT, W_ARTI, state);
    const wouldEnd = !propertyIsActive('levitation', state);
    restoreLevitationSources(stash, state);
    if (!wouldEnd)
        return false;
    // C `ELevitation = W_ART`: the invoked source is replaced by the
    // carried one, so the artifact's deactivation no longer sees it.
    setInvokedProperty('levitation', null, false, state);
    setCarriedProperty('levitation', object, true, state);
    return true;
}
// C do.c:771 `float_down(I_SPECIAL | TIMEOUT, W_ARTI | W_ART)` after
// hitfloor(): the pinned carried source and the retained timed bits end
// here, and the shared landing owner reports the touchdown.
export async function finishLevitatingArtifactDrop(state = game) {
    requireLiveGame(state);
    return floatHeroDown(I_SPECIAL | TIMEOUT, W_ARTI | W_ART, state);
}
//# sourceMappingURL=levitation_drop.js.map