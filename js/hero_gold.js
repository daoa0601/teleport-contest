// The hero's carried gold is the COIN_CLASS object in inventory.
// C refs: hack.c money_cnt(), invent.c addinv()/freeinv()/splitobj().
import { formatFeltMessage } from './hero_speech.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { createObjectBase } from './object_constructor.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { splitObjectStack } from './object_stack.js';
import { unlinkObject } from './object_location.js';
import { nextIdent } from './ident.js';
import { delobj } from './object_delete.js';
import { markJustPicked } from './just_picked.js';
import { GOLD_PIECE } from './object_data.js';
const COIN_CLASS = 12;
// C sit.c:take_gold(). Contained coins are not exposed to the effect.
export async function takeHeroGold(state = game) {
    let lostMoney = false;
    for (const object of [...state.inventory]) {
        if (object.oclass !== COIN_CLASS)
            continue;
        lostMoney = true;
        await removeWornHeroItem(object, state);
        await delobj(object, state);
    }
    await plineWithContinuation(lostMoney
        ? 'You notice you have no gold!'
        : formatFeltMessage('a strange sensation.', state));
}
function quantity(object) {
    return Math.max(0, Math.trunc(object?.quan ?? object?.quantity ?? 0));
}
function coinWeight(amount) {
    return Math.max(1, Math.trunc((amount + 50) / 100));
}
function normalizeGoldObject(object, amount = quantity(object)) {
    object.otyp = GOLD_PIECE;
    object.oclass = COIN_CLASS;
    object.invlet = '$';
    object.name = 'gold piece';
    object.plural = 'gold pieces';
    object.quan = object.quantity = amount;
    object.owt = coinWeight(amount);
    return object;
}
export function heroGoldObject(state) {
    return (state?.inventory || []).find(object => object?.otyp === GOLD_PIECE || object?.oclass === COIN_CLASS) || null;
}
export function heroGoldAmount(state) {
    const object = heroGoldObject(state);
    return object ? quantity(object) : 0;
}
export function addHeroGoldObject(state, incoming) {
    if (!incoming)
        return { object: heroGoldObject(state), merged: false };
    const amount = quantity(incoming);
    if (!amount)
        return { object: heroGoldObject(state), merged: false };
    state.context.botl = true;
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
    if (!state.inventory.includes(incoming))
        state.inventory.unshift(incoming);
    return { object: markJustPicked(incoming), merged: false };
}
export function setHeroGoldAmount(state, amount) {
    amount = Math.max(0, Math.trunc(amount ?? 0));
    let object = heroGoldObject(state);
    if (amount !== heroGoldAmount(state))
        state.context.botl = true;
    if (!amount) {
        if (object) {
            state.inventory = (state.inventory || [])
                .filter(candidate => candidate !== object);
            if (state.uquiver === object)
                state.uquiver = null;
            object.ready = false;
            object.owornmask = 0;
            object.where = 'gone';
            object.quan = object.quantity = 0;
        }
        return null;
    }
    if (!object) {
        object = normalizeGoldObject({
            ...createObjectBase(GOLD_PIECE, nextIdent(), state.moves),
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
    if (!object)
        return null;
    const amount = quantity(object);
    const count = requested === null
        ? amount : Math.max(1, Math.min(Math.trunc(requested), amount));
    const detached = count < amount ? splitObjectStack(object, count, state) : object;
    if (!detached)
        throw new Error('A gold stack must yield the requested coins.');
    unlinkObject(detached, state);
    state.context.botl = true;
    if (state.uquiver === detached)
        state.uquiver = null;
    detached.ready = false;
    detached.owornmask = 0;
    return detached;
}
//# sourceMappingURL=hero_gold.js.map