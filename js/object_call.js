// object_call.js — Shared docall()/trycall() type-naming ownership.
// C refs: do.c trycall(); do_name.c docall(), docall_xname().
import { withIndefiniteArticle } from './object_grammar.js';
import { game } from './gstate.js';
import { OBJECT_DESCRIPTIONS, OBJECT_NAMES } from './object_data.js';
import { recordObjectCall, recordObjectEncounter } from './object_knowledge.js';
import { getLine } from './query.js';
import { flush_screen } from './display.js';
import { objectTypeKnown } from './shk.js';
const MAX_PLAYER_NAME_LENGTH = 62; // PL_PSIZ - 1
export function objectTypeCallNoun(object, state = game) {
    const type = object?.otyp;
    const appearance = type === undefined ? null : (state.objectDescriptions?.[type] ?? OBJECT_DESCRIPTIONS[type]);
    switch (object?.oclass) {
        case 4:
            return `${appearance || 'unknown'} ring`;
        case 5:
            return `${appearance || 'unknown'} amulet`;
        case 8:
            return `${appearance || 'unknown'} potion`;
        case 9:
            return appearance === 'unlabeled'
                ? 'unlabeled scroll'
                : `scroll labeled ${appearance || 'unknown'}`;
        case 10:
            return `${appearance || 'unknown'} spellbook`;
        case 11:
            return `${appearance || 'unknown'} wand`;
        case undefined:
        default:
            return (appearance ||
                object?.name ||
                (type === undefined ? null : OBJECT_NAMES[type]) ||
                'thing');
    }
}
export async function tryCallObjectType(object, state = game) {
    if (!object ||
        object.dknown === false ||
        objectTypeKnown(object, state) ||
        state._objectCallNames?.[object.otyp]) {
        return { prompted: false, named: false, callName: null };
    }
    // C docall() publishes buffered status before getlin() disables bot().
    await flush_screen(1);
    const noun = objectTypeCallNoun(object, state);
    const appearance = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
    const prompt = object.oclass === 8 && object.fromsink
        ? `Call a stream of ${appearance} fluid:`
        : `Call ${withIndefiniteArticle(noun)}:`;
    const input = await getLine(prompt, (_ch, key) => key >= 32 && key < 127);
    const callName = input?.trim().replace(/\s+/g, ' ').slice(0, MAX_PLAYER_NAME_LENGTH) || '';
    if (!callName) {
        return { prompted: true, named: false, callName: null };
    }
    recordObjectCall(object.otyp, callName, state);
    recordObjectEncounter(object.otyp, state);
    return { prompted: true, named: true, callName };
}
//# sourceMappingURL=object_call.js.map