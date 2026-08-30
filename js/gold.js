// gold.js — Carried purse and recursively contained-gold accounting.
// C refs: vault.c:hidden_gold(), shk.c:contained_gold().

import { GOLD_PIECE } from './object_data.js';
import { heroGoldAmount } from './hero_gold.js';

function quantity(object) {
    return object?.quan ?? object?.quantity ?? 0;
}

// `container` is the already-admitted enclosing object. Immediate coin
// stacks are countable; deeper containers require their own cknown bit when
// the caller does not have the source's preternatural even_if_unknown view.
export function containedGold(container, evenIfUnknown = true) {
    let total = 0;
    for (const object of container?.contents || []) {
        if (object.otyp === GOLD_PIECE || object.oclass === 12) {
            total += quantity(object);
        } else if (Array.isArray(object.contents)
            && (evenIfUnknown || object.cknown)) {
            total += containedGold(object, evenIfUnknown);
        }
    }
    return total;
}

export function hiddenGold(state, evenIfUnknown = true) {
    let total = 0;
    for (const object of state?.inventory || []) {
        if (!Array.isArray(object.contents)
            || (!evenIfUnknown && !object.cknown)) continue;
        total += containedGold(object, evenIfUnknown);
    }
    return total;
}

export function carriedGold(state, evenIfUnknown = true) {
    return heroGoldAmount(state) + hiddenGold(state, evenIfUnknown);
}
