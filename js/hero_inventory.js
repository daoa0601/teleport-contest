// C invent.c:freeinv_core()/addinv_core1() and attrib.c:set_moreluck().

import { artifactById, artifactByName } from './artifacts.js';
import { deactivateArtifactProperty } from './artifact_invoke.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    FIGURINE, LOADSTONE, LUCKSTONE, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import { curseObjectState } from './object_state.js';
import { OBJECT_TIMER_KIND, stopObjectTimer } from './object_timers.js';

const CARRIED_FLAGS = new Map([
    [AMULET_OF_YENDOR, 'amulet'], [BELL_OF_OPENING, 'bell'],
    [CANDELABRUM_OF_INVOCATION, 'menorah'], [SPE_BOOK_OF_THE_DEAD, 'book'],
]);

export function finishInventoryAddition(object, state = game) {
    updateCarriedFlags(object, true, state);
}

export async function finishInventoryRemoval(object, state = game) {
    object.pickup_prev = 0;
    updateCarriedFlags(object, false, state);
    const artifact = artifactById(object.oartifact, state);
    if (artifact) await deactivateArtifactProperty(object, artifact, {
        state, publish: plineWithContinuation,
    });
    if (object.otyp === LOADSTONE) curseObjectState(object);
    if (object.otyp === FIGURINE)
        stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
}

function updateCarriedFlags(object, carried, state) {
    let flag = CARRIED_FLAGS.get(object.otyp);
    if (object.oartifact
        && object.oartifact === artifactByName(state.urole?.artifactName, state)?.id)
        flag = 'questart';
    if (flag) state.u.uhave[flag] = carried;
    if (confersLuck(object, state)) {
        const lucky = state.inventory.filter(item => confersLuck(item, state));
        const luck = lucky.reduce((sum, item) =>
            sum + (item.cursed ? -1 : 1) * item.quan, 0);
        state.u.moreluck = !luck && !lucky.some(item => item.otyp === LUCKSTONE)
            ? 0 : luck < 0 ? -3 : 3;
    }
    state._capacityDirty = true;
}

function confersLuck(object, state) {
    return object.otyp === LUCKSTONE
        || artifactById(object.oartifact, state)?.flags.includes('SPFX_LUCK');
}
