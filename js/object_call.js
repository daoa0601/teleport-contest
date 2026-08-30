// object_call.js — Shared docall()/trycall() type-naming ownership.
// C refs: do.c trycall(); do_name.c docall(), docall_xname().

import { game } from './gstate.js';
import {
    OBJECT_DESCRIPTIONS, OBJECT_NAMES,
} from './object_data.js';
import {
    recordObjectCall, recordObjectEncounter,
} from './object_knowledge.js';
import { getLine } from './query.js';
import { objectTypeKnown } from './shk.js';

const MAX_PLAYER_NAME_LENGTH = 62; // PL_PSIZ - 1

function indefiniteArticle(noun) {
    return /^[aeiou]/iu.test(noun) ? 'an' : 'a';
}

export function objectTypeCallNoun(object, state = game) {
    const appearance = state.objectDescriptions?.[object?.otyp]
        ?? OBJECT_DESCRIPTIONS[object?.otyp];
    switch (object?.oclass) {
    case 4: return `${appearance || 'unknown'} ring`;
    case 5: return `${appearance || 'unknown'} amulet`;
    case 8: return `${appearance || 'unknown'} potion`;
    case 9:
        return appearance === 'unlabeled'
            ? 'unlabeled scroll'
            : `scroll labeled ${appearance || 'unknown'}`;
    case 10: return `${appearance || 'unknown'} spellbook`;
    case 11: return `${appearance || 'unknown'} wand`;
    default:
        return appearance || object?.name
            || OBJECT_NAMES[object?.otyp] || 'thing';
    }
}

// trycall() is intentionally narrower than the explicit #call command: it
// prompts only for a seen type which is neither formally known nor already
// called.  The consumed object can already be free; the call name belongs to
// its global type and remains after that identity is destroyed.
export async function tryCallObjectType(object, state = game) {
    if (!object || object.dknown === false
        || objectTypeKnown(object, state)
        || state._objectCallNames?.[object.otyp]) {
        return { prompted: false, named: false, callName: null };
    }

    const noun = objectTypeCallNoun(object, state);
    const input = await getLine(
        `Call ${indefiniteArticle(noun)} ${noun}:`,
        (_ch, key) => key >= 32 && key < 127,
    );
    const callName = input?.trim().replace(/\s+/g, ' ')
        .slice(0, MAX_PLAYER_NAME_LENGTH) || '';
    if (!callName) {
        return { prompted: true, named: false, callName: null };
    }

    recordObjectCall(object.otyp, callName, state);
    recordObjectEncounter(object.otyp, state);
    return { prompted: true, named: true, callName };
}
