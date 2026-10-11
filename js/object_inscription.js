// Text shared by read.c and end-of-game xname_flags() disclosure.
import { wipeoutText } from './engrave.js';
import { game } from './gstate.js';
import { ALCHEMY_SMOCK, CANDY_BAR, HAWAIIAN_SHIRT, OBJECT_NAMES } from './object_data.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { APRON_MESSAGES, CANDY_WRAPPERS, HAWAIIAN_BACKGROUNDS, HAWAIIAN_MOTIFS, SHIRT_MESSAGES, } from './readable_object_text.js';
const T_SHIRT = OBJECT_NAMES.indexOf('T-shirt');
// Native xname_flags appends this after pluralizing the base noun and before
// the individual name. Dummy naming views omit the object's identity.
export function objectDisclosureText(object, state = game) {
    if (!state.program_state.gameover || !object.o_id)
        return '';
    switch (object.otyp) {
        case T_SHIRT:
        case ALCHEMY_SMOCK:
            return ` with text "${garmentInscription(object, state)}"`;
        case CANDY_BAR: {
            const wrapper = candyWrapperText(object);
            return wrapper ? ` labeled "${wrapper}"` : '';
        }
        case HAWAIIAN_SHIRT:
            return ` with ${withIndefiniteArticle(hawaiianMotif(object, state))} motif`;
        default:
            return '';
    }
}
export function garmentInscription(object, state = game) {
    if (object.otyp !== T_SHIRT && object.otyp !== ALCHEMY_SMOCK)
        throw new Error('Only T-shirts and alchemy smocks have garment inscriptions.');
    const messages = object.otyp === T_SHIRT ? SHIRT_MESSAGES : APRON_MESSAGES;
    const id = object.o_id ?? 0;
    const text = inscriptionAt(messages, id % messages.length);
    const erosion = Math.max(object.oeroded || 0, object.oeroded2 || 0);
    if (!erosion)
        return text;
    return wipeoutText(text, Math.trunc(text.length * erosion / 6), (id ^ heroBirthday(state)) >>> 0);
}
export function candyWrapperText(object) {
    return CANDY_WRAPPERS[(object.spe ?? 0) % CANDY_WRAPPERS.length] ?? '';
}
export function hawaiianMotif(object, state = game) {
    const motif = ((object.o_id ?? 0) ^ heroBirthday(state)) >>> 0;
    return inscriptionAt(HAWAIIAN_MOTIFS, motif % HAWAIIAN_MOTIFS.length);
}
export function hawaiianDesign(object, state = game) {
    const background = ((object.o_id ?? 0) ^ ~heroBirthday(state)) >>> 0;
    const backgroundText = inscriptionAt(HAWAIIAN_BACKGROUNDS, background % HAWAIIAN_BACKGROUNDS.length);
    return `${makePlural(hawaiianMotif(object, state))} on ${withIndefiniteArticle(backgroundText)} background`;
}
function heroBirthday(state) {
    if (state.ubirthday === undefined)
        throw new Error('Object text requires the initialized hero birth time.');
    return state.ubirthday;
}
function inscriptionAt(messages, index) {
    const message = messages[index];
    if (message === undefined)
        throw new RangeError(`No readable inscription at index ${index}.`);
    return message;
}
//# sourceMappingURL=object_inscription.js.map