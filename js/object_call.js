// object_call.js — Shared docall()/trycall() type-naming ownership.
// C refs: do.c trycall(); do_name.c docall(), docall_xname().
import { withIndefiniteArticle } from './object_grammar.js';
import { game } from './gstate.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, FIGURINE, HEAVY_IRON_BALL, OBJECT_DESCRIPTIONS, OBJECT_WEIGHT, STATUE, TIN, TOWEL, } from './object_data.js';
import { recordObjectCall, recordObjectEncounter } from './object_knowledge.js';
import { playerName } from './player_name.js';
import { flush_screen } from './display.js';
import { objectTypeKnown, repriceDiscoveredGems } from './shk.js';
import { impossible } from './diagnostics.js';
import { objectName, observeObjectForNaming } from './objnam.js';
export function objectTypeIsCallable(object, state = game) {
    if (state._objectCallNames?.[object.otyp])
        return true;
    if (object.otyp === AMULET_OF_YENDOR || object.otyp === FAKE_AMULET_OF_YENDOR)
        return false;
    return [3, 4, 5, 6, 8, 9, 10, 11, 13, 17].includes(object.oclass)
        && !!OBJECT_DESCRIPTIONS[object.otyp];
}
export async function tryCallObjectType(object, state = game) {
    if (!object ||
        object.dknown === false ||
        objectTypeKnown(object, state) ||
        state._objectCallNames?.[object.otyp]) {
        return { prompted: false, named: false, callName: null };
    }
    return callObjectType(object, state);
}
export async function callObjectType(object, state = game) {
    if (!object.dknown)
        return { prompted: false, named: false, callName: null };
    // C docall() publishes buffered status before getlin() disables bot().
    await flush_screen(1);
    const sample = { ...object, quan: 1, quantity: 1, blessed: false, cursed: false };
    delete sample.oextra;
    delete sample.oname;
    delete sample.buc;
    if (sample.oclass === 2)
        sample.opoisoned = 0;
    else if (sample.oclass === 8)
        sample.odiluted = false;
    else if (sample.otyp === TOWEL || sample.otyp === STATUE)
        sample.spe = 0;
    else if (sample.otyp === TIN)
        sample.known = false;
    else if (sample.otyp === FIGURINE)
        sample.corpsenm = -1;
    else if (sample.otyp === HEAVY_IRON_BALL)
        sample.owt = OBJECT_WEIGHT[HEAVY_IRON_BALL] ?? sample.owt;
    else if (sample.oclass === 7 && sample.globby)
        sample.owt = 120;
    let prompt;
    if (object.oclass === 8 && object.fromsink) {
        const appearance = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
        prompt = `Call a stream of ${appearance} fluid:`;
    }
    else {
        // C docall_xname() observes the prompt's sample before player input.
        observeObjectForNaming(sample, { state });
        prompt = `Call ${withIndefiniteArticle(objectName(sample, state))}:`;
    }
    const callName = await playerName(prompt);
    if (callName === null)
        return { prompted: true, named: false, callName: null };
    if (!callName) {
        if (state._objectCallNames?.[object.otyp]) {
            delete state._objectCallNames[object.otyp];
            if (!objectTypeKnown(object, state) && !state._encounteredObjectTypes?.has(object.otyp)) {
                if (state._objectDiscoveryOrder?.includes(object.otyp))
                    state._objectDiscoveryOrder = state._objectDiscoveryOrder.filter(type => type !== object.otyp);
                else
                    await impossible('named object not in disco', { state });
                if (object.oclass === 13)
                    repriceDiscoveredGems(object.otyp, state);
            }
        }
        return { prompted: true, named: false, callName: null };
    }
    recordObjectCall(object.otyp, callName, state);
    recordObjectEncounter(object.otyp, state);
    return { prompted: true, named: true, callName };
}
//# sourceMappingURL=object_call.js.map