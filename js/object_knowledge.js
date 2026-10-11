// object_knowledge.js — Shared object discovery order and remembered quotes.
// C refs: o_init.c observe_object(), discover_object(); shk.c record_price_quote().
import { game } from './gstate.js';
import { heroIsHallucinating } from './senses.js';
import { exerciseWisdom } from './attrib.js';
import { ARROW as FIRST_OBJECT, OBJECT_BASES, OBJECT_INITIAL_KNOWN, } from './object_data.js';
// C drawing.c:def_oc_syms, indexed by the object class from objclass.h.
export const OBJECT_CLASS_SYMBOLS = [
    '',
    ']',
    ')',
    '[',
    '=',
    '"',
    '(',
    '%',
    '!',
    '?',
    '+',
    '/',
    '$',
    '*',
    '`',
    '0',
    '_',
    '.',
];
export const OBJECT_CLASS_LABELS = {
    2: 'Weapons',
    3: 'Armor',
    4: 'Rings',
    5: 'Amulets',
    6: 'Tools',
    7: 'Comestibles',
    8: 'Potions',
    9: 'Scrolls',
    10: 'Spellbooks',
    11: 'Wands',
    12: 'Coins',
    13: 'Gems/Stones',
    14: 'Large rocks',
    15: 'Iron balls',
    16: 'Chains',
    17: 'Venoms',
};
export function objectClassForType(otyp) {
    if (typeof otyp !== 'number' || !Number.isInteger(otyp) || otyp < 1)
        return 0;
    for (let oclass = OBJECT_BASES.length - 1; oclass >= 2; oclass--) {
        const first = OBJECT_BASES[oclass];
        if (first && otyp >= first)
            return oclass;
    }
    return 0;
}
function rememberType(otyp, state = game) {
    if (!Number.isInteger(otyp) || otyp < 1)
        return;
    if (!Array.isArray(state._objectDiscoveryOrder))
        state._objectDiscoveryOrder = [];
    if (!state._objectDiscoveryOrder.includes(otyp))
        state._objectDiscoveryOrder.push(otyp);
}
// C xname_flags(): Clerics recognize beatitude whenever an object is named.
export function observeBucForNaming(object, state = game) {
    if (state.urole?.key !== 'priest')
        return;
    object.bknown = true;
    object.buc = object.blessed ? 'blessed' : object.cursed ? 'cursed' : undefined;
}
export function observeObject(object, state = game) {
    if (object.otyp >= FIRST_OBJECT && !heroIsHallucinating(state)) {
        object.dknown = true;
        recordObjectEncounter(object.otyp, state);
    }
}
export function recordObjectEncounter(otyp, state = game) {
    if (!Number.isInteger(otyp) || otyp < 1)
        return;
    rememberType(otyp, state);
    if (!(state._encounteredObjectTypes instanceof Set))
        state._encounteredObjectTypes = new Set();
    state._encounteredObjectTypes.add(otyp);
}
export function recordObjectKnowledge(otyp, state = game) {
    if (!Number.isInteger(otyp) || otyp < 1)
        return;
    rememberType(otyp, state);
    if (!(state._knownObjectTypes instanceof Set))
        state._knownObjectTypes = new Set();
    state._knownObjectTypes.add(otyp);
}
// C makeknown(): learning a type also records the encounter and credits
// Wisdom once. Restoring saved knowledge does not grant that credit.
export function learnObjectType(otyp, state = game) {
    if (otyp < 1)
        return;
    const known = OBJECT_INITIAL_KNOWN[otyp] || state._knownObjectTypes?.has(otyp);
    recordObjectEncounter(otyp, state);
    recordObjectKnowledge(otyp, state);
    if (!known)
        exerciseWisdom(true, state);
}
export function recordObjectCall(otyp, name, state = game) {
    if (!Number.isInteger(otyp) || otyp < 1 || !name)
        return;
    rememberType(otyp, state);
    if (!state._objectCallNames)
        state._objectCallNames = {};
    state._objectCallNames[otyp] = name;
}
export function recordObjectPriceQuote(otyp, price, kind = 'buy', state = game) {
    if (!Number.isInteger(otyp) || otyp < 1 || !Number.isInteger(price) || price < 0)
        return;
    rememberType(otyp, state);
    if (!state._objectPriceQuotes)
        state._objectPriceQuotes = {};
    const quote = state._objectPriceQuotes[otyp] || {};
    const observed = quote[kind];
    quote[kind] = observed
        ? { min: Math.min(observed.min, price), max: Math.max(observed.max, price) }
        : { min: price, max: price };
    state._objectPriceQuotes[otyp] = quote;
}
// C shk.c:append_price_quote(). Discovery lists always include the quote;
// ordinary object descriptions decide whether the option and knowledge allow it.
export function priceQuoteSuffix(otyp, state = game) {
    const quote = state._objectPriceQuotes?.[otyp];
    if (!quote)
        return '';
    const parts = [];
    for (const kind of ['buy', 'sell']) {
        const range = quote[kind];
        if (!range)
            continue;
        const { min, max } = range;
        parts.push(min === max ? `${kind} ${min}` : `${kind} ${min}-${max}`);
    }
    return parts.length ? ` {${parts.join(' ')}}` : '';
}
//# sourceMappingURL=object_knowledge.js.map