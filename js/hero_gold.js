// The hero's carried gold is the COIN_CLASS object in inventory.
// C refs: hack.c money_cnt(), invent.c addinv()/freeinv()/splitobj().

import { nextIdent } from './ident.js';
import { markJustPicked } from './just_picked.js';
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
    return object ? quantity(object) : 0;
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
        return { object: markJustPicked(existing), merged: true };
    }
    normalizeGoldObject(incoming, amount);
    incoming.where = 'inventory';
    incoming.container = null;
    incoming.ox = incoming.oy = 0;
    incoming.owornmask = incoming.owornmask ?? 0;
    state.inventory ||= [];
    if (!state.inventory.includes(incoming)) state.inventory.unshift(incoming);
    return { object: markJustPicked(incoming), merged: false };
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
        return null;
    }
    if (!object) {
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
    }
    normalizeGoldObject(object, amount);
    return object;
}

export function detachHeroGold(state, requested = null) {
    const object = heroGoldObject(state);
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
    return detached;
}
