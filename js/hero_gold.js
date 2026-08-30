// hero_gold.js — Canonical top-level hero COIN_CLASS identity.
// C refs: invent.c addinv()/freeinv()/splitobj(), mkobj.c weight().
// `_goldCount` is retained only as a synchronized compatibility cache while
// older regression harnesses transition to inspecting the live `$` object.

import { nextIdent } from './ident.js';
import { GOLD_PIECE } from './object_data.js';

const COIN_CLASS = 12;

function quantity(object) {
    return Math.max(0, Math.trunc(
        object?.quan ?? object?.quantity ?? 0,
    ));
}

function coinWeight(amount) {
    return Math.max(1, Math.trunc((amount + 50) / 100));
}

function normalizeGoldObject(object, amount = quantity(object)) {
    Object.assign(object, {
        otyp: GOLD_PIECE,
        oclass: COIN_CLASS,
        invlet: '$',
        name: 'gold piece',
        plural: 'gold pieces',
        quan: amount,
        quantity: amount,
        owt: coinWeight(amount),
    });
    return object;
}

export function heroGoldObject(state) {
    return (state?.inventory || []).find(object =>
        object?.otyp === GOLD_PIECE || object?.oclass === COIN_CLASS) || null;
}

export function heroGoldAmount(state) {
    const object = heroGoldObject(state);
    return object ? quantity(object)
        : Math.max(0, Math.trunc(state?._goldCount ?? 0));
}

export function syncHeroGoldCache(state) {
    const object = heroGoldObject(state);
    state._goldCount = object ? quantity(object) : 0;
    return state._goldCount;
}

export function ensureHeroGoldObject(state) {
    let object = heroGoldObject(state);
    if (object) return object;
    const amount = Math.max(0, Math.trunc(state?._goldCount ?? 0));
    if (!amount) return null;
    object = normalizeGoldObject({
        o_id: nextIdent(),
        where: 'inventory',
        worn: false,
        wielded: false,
        alternate: false,
        ready: false,
        owornmask: 0,
        contents: [],
        objectTimers: [],
        timed: 0,
    }, amount);
    state.inventory ||= [];
    state.inventory.unshift(object);
    syncHeroGoldCache(state);
    return object;
}

export function addHeroGoldObject(state, incoming) {
    if (!incoming) return { object: heroGoldObject(state), merged: false };
    const amount = quantity(incoming);
    if (!amount) return { object: heroGoldObject(state), merged: false };
    const existing = heroGoldObject(state);
    if (existing && existing !== incoming) {
        const total = quantity(existing) + amount;
        normalizeGoldObject(existing, total);
        incoming.where = 'gone';
        incoming.ox = incoming.oy = 0;
        incoming.quan = incoming.quantity = 0;
        syncHeroGoldCache(state);
        return { object: existing, merged: true };
    }
    normalizeGoldObject(incoming, amount);
    incoming.where = 'inventory';
    incoming.container = null;
    incoming.ox = incoming.oy = 0;
    incoming.owornmask = incoming.owornmask ?? 0;
    state.inventory ||= [];
    if (!state.inventory.includes(incoming)) state.inventory.unshift(incoming);
    syncHeroGoldCache(state);
    return { object: incoming, merged: false };
}

export function setHeroGoldAmount(state, amount) {
    amount = Math.max(0, Math.trunc(amount ?? 0));
    let object = heroGoldObject(state);
    if (!amount) {
        if (object) {
            state.inventory = (state.inventory || [])
                .filter(candidate => candidate !== object);
            if (state.uquiver === object) state.uquiver = null;
            object.ready = false;
            object.owornmask = 0;
            object.where = 'gone';
            object.quan = object.quantity = 0;
        }
        state._goldCount = 0;
        return null;
    }
    object ||= ensureHeroGoldObject(state);
    if (!object) {
        state._goldCount = amount;
        object = ensureHeroGoldObject(state);
    }
    normalizeGoldObject(object, amount);
    syncHeroGoldCache(state);
    return object;
}

export function detachHeroGold(state, requested = null) {
    const object = ensureHeroGoldObject(state);
    if (!object) return null;
    const amount = quantity(object);
    const count = requested === null
        ? amount : Math.max(1, Math.min(Math.trunc(requested), amount));
    if (count >= amount) {
        state.inventory = (state.inventory || [])
            .filter(candidate => candidate !== object);
        if (state.uquiver === object) state.uquiver = null;
        object.ready = false;
        object.owornmask = 0;
        object.where = 'free';
        state._goldCount = 0;
        return object;
    }
    normalizeGoldObject(object, amount - count);
    const detached = normalizeGoldObject({
        ...object,
        o_id: nextIdent(),
        quan: count,
        quantity: count,
        ready: false,
        owornmask: 0,
        where: 'free',
        container: null,
    }, count);
    syncHeroGoldCache(state);
    return detached;
}
