// object_knowledge.js — Shared object discovery order and remembered quotes.
// C refs: o_init.c observe_object(), discover_object(); shk.c record_price_quote().

import { game } from './gstate.js';
import { OBJECT_BASES, OBJECT_NAMES } from './object_data.js';

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

export const DISCOVERY_CLASS_ORDER = [
    // C options.c:def_inv_order, which o_init.c:dodiscovered() traverses.
    // Coins normally have no description and are filtered later, but retain
    // their source position so a configured/legacy record cannot reorder the
    // classes which follow it.
    12, 5, 2, 3, 7, 9, 10, 8, 4, 11, 6, 13, 14, 15, 16, 17,
];

export function objectClassForType(otyp) {
    if (!Number.isInteger(otyp) || otyp < 1) return 0;
    for (let oclass = OBJECT_BASES.length - 1; oclass >= 2; oclass--) {
        if (OBJECT_BASES[oclass] && otyp >= OBJECT_BASES[oclass]) return oclass;
    }
    return 0;
}

function rememberType(otyp) {
    if (!Number.isInteger(otyp) || otyp < 1) return;
    if (!Array.isArray(game._objectDiscoveryOrder))
        game._objectDiscoveryOrder = [];
    if (!game._objectDiscoveryOrder.includes(otyp))
        game._objectDiscoveryOrder.push(otyp);
}

export function recordObjectEncounter(otyp) {
    if (!Number.isInteger(otyp) || otyp < 1) return;
    rememberType(otyp);
    if (!(game._encounteredObjectTypes instanceof Set))
        game._encounteredObjectTypes = new Set();
    game._encounteredObjectTypes.add(otyp);
}

export function recordObjectKnowledge(otyp) {
    if (!Number.isInteger(otyp) || otyp < 1) return;
    rememberType(otyp);
    if (!(game._knownObjectTypes instanceof Set))
        game._knownObjectTypes = new Set();
    game._knownObjectTypes.add(otyp);
}

export function recordObjectCall(otyp, name) {
    if (!Number.isInteger(otyp) || otyp < 1 || !name) return;
    rememberType(otyp);
    if (!game._objectCallNames) game._objectCallNames = {};
    game._objectCallNames[otyp] = name;
}

export function recordObjectPriceQuote(otyp, price, kind = 'buy') {
    if (!Number.isInteger(otyp) || otyp < 1 || !(price >= 0)) return;
    rememberType(otyp);
    if (!game._objectPriceQuotes) game._objectPriceQuotes = {};
    const quote = game._objectPriceQuotes[otyp] || {
        buyMin: Infinity, buyMax: -Infinity,
        sellMin: Infinity, sellMax: -Infinity,
    };
    const prefix = kind === 'sell' ? 'sell' : 'buy';
    quote[`${prefix}Min`] = Math.min(quote[`${prefix}Min`], price);
    quote[`${prefix}Max`] = Math.max(quote[`${prefix}Max`], price);
    game._objectPriceQuotes[otyp] = quote;
}

function normalizedLegacyName(entry) {
    let name = String(entry?.name || '');
    name = name.replace(/^pair of /, '').replace(/^set of /, '');
    const prefixes = {
        Scrolls: 'scroll of ', Spellbooks: 'spellbook of ',
        Potions: 'potion of ', Wands: 'wand of ', Rings: 'ring of ',
    };
    const prefix = prefixes[entry?.class];
    if (prefix && name.startsWith(prefix)) name = name.slice(prefix.length);
    return name;
}

export function resolveLegacyDiscoveryType(entry) {
    const oclass = Number(Object.entries(OBJECT_CLASS_LABELS)
        .find(([, label]) => label === entry?.class)?.[0] || 0);
    if (!oclass) return -1;
    const wanted = normalizedLegacyName(entry);
    const low = OBJECT_BASES[oclass];
    const high = OBJECT_BASES[oclass + 1] || OBJECT_NAMES.length;
    for (let otyp = low; otyp < high; otyp++) {
        if (OBJECT_NAMES[otyp] === wanted) return otyp;
    }
    return -1;
}
