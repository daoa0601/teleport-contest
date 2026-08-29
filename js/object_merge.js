// object_merge.js — Shared ordinary stack compatibility and absorption.
// C refs: invent.c:mergable()/merged(), mkobj.c:obj_absorb().

import { game } from './gstate.js';
import {
    CORPSE, EGG, OBJECT_MERGE, OBJECT_WEIGHT, POT_OIL, TALLOW_CANDLE,
    TIN, WAX_CANDLE,
} from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer,
    stopAllObjectTimers,
} from './object_timers.js';

const COIN_CLASS = 12;
const FOOD_CLASS = 7;

function coinStackWeight(quantity) {
    return Math.max(1, Math.trunc((quantity + 50) / 100));
}

function objectName(object) {
    return object?.oextra?.oname ?? object?.oname ?? '';
}

function hasAttachment(object) {
    return !!(
        object?.attachedMid || object?.attachedMonster
        || object?.oextra?.omid || object?.oextra?.omonst
    );
}

export function mergable(otmp, obj, state = game) {
    if (!otmp || !obj || otmp === obj || otmp.otyp !== obj.otyp
        || otmp.nomerge || obj.nomerge || !OBJECT_MERGE[obj.otyp]) {
        return false;
    }
    if (obj.oclass === COIN_CLASS) return true;
    if (!!otmp.cursed !== !!obj.cursed
        || !!otmp.blessed !== !!obj.blessed) return false;

    const otmpLost = otmp.how_lost ?? 0;
    const objLost = obj.how_lost ?? 0;
    if (otmpLost === 4 || objLost === 4
        || (otmpLost !== 0 && otmpLost !== objLost)) return false;
    if (obj.globby || otmp.globby) return !!obj.globby && !!otmp.globby;

    for (const field of [
        'unpaid', 'no_charge', 'obroken', 'otrapped', 'lamplit', 'opoisoned',
    ]) {
        if (!!otmp[field] !== !!obj[field]) return false;
    }
    if ((otmp.spe ?? 0) !== (obj.spe ?? 0)) return false;
    if (obj.oclass === FOOD_CLASS
        && ((otmp.oeaten ?? 0) !== (obj.oeaten ?? 0)
            || !!otmp.orotten !== !!obj.orotten)) return false;

    const impairedSight = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0
        || !!state?.u?.hallucinating
        || (state?.u?.hallucinationTurns ?? 0) > 0;
    const cleric = state?.urole?.key === 'priest';
    if (!!otmp.dknown !== !!obj.dknown
        || ((!!otmp.bknown !== !!obj.bknown)
            && !cleric && impairedSight)
        || (otmp.oeroded ?? 0) !== (obj.oeroded ?? 0)
        || (otmp.oeroded2 ?? 0) !== (obj.oeroded2 ?? 0)
        || !!otmp.greased !== !!obj.greased
        || !!otmp.oerodeproof !== !!obj.oerodeproof
        || ((!!otmp.rknown !== !!obj.rknown) && impairedSight)) {
        return false;
    }

    if ([CORPSE, EGG, TIN].includes(obj.otyp)
        && (otmp.corpsenm ?? -1) !== (obj.corpsenm ?? -1)) return false;
    if (obj.otyp === EGG && (otmp.timed || obj.timed)) return false;
    if ((obj.otyp === TALLOW_CANDLE || obj.otyp === WAX_CANDLE)
        && Math.trunc((otmp.age ?? 0) / 25)
            !== Math.trunc((obj.age ?? 0) / 25)) return false;
    if (obj.otyp === POT_OIL && obj.lamplit) return false;
    if (hasAttachment(otmp) || hasAttachment(obj)) return false;

    const otmpName = objectName(otmp);
    const objName = objectName(obj);
    if ((otmpName && objName && otmpName !== objName)
        || (obj.otyp === CORPSE && !!otmpName !== !!objName)) return false;
    if ((otmp.oartifact ?? 0) !== (obj.oartifact ?? 0)) return false;
    if (!!otmp.known !== !!obj.known && impairedSight) return false;
    return true;
}

function remainingGlobDelay(object, state) {
    const timer = objectTimers(object).find(candidate =>
        candidate.kind === OBJECT_TIMER_KIND.SHRINK_GLOB);
    const remaining = timer
        ? timer.deadline - (state?.moves ?? 0) : 0;
    return remaining > 0 ? remaining : 25;
}

function mergeGlob(survivor, incoming, state) {
    const firstWeight = survivor.oeaten || survivor.owt || 1;
    const secondWeight = incoming.oeaten || incoming.owt || 1;
    const totalWeight = firstWeight + secondWeight;
    const firstDelay = remainingGlobDelay(survivor, state);
    const secondDelay = remainingGlobDelay(incoming, state);

    if (!!survivor.bknown !== !!incoming.bknown)
        survivor.bknown = incoming.bknown = false;
    if (!!survivor.rknown !== !!incoming.rknown)
        survivor.rknown = incoming.rknown = false;
    if (!!survivor.greased !== !!incoming.greased)
        survivor.greased = incoming.greased = false;
    if (survivor.orotten || incoming.orotten)
        survivor.orotten = incoming.orotten = true;

    survivor.age = Math.trunc(
        (((survivor.age ?? 0) * firstWeight)
            + ((incoming.age ?? 0) * secondWeight)) / totalWeight,
    );
    survivor.owt = totalWeight;
    if (survivor.oeaten || incoming.oeaten)
        survivor.oeaten = totalWeight;
    survivor.quan = survivor.quantity = 1;

    stopAllObjectTimers(survivor);
    stopAllObjectTimers(incoming);
    const delay = Math.trunc((firstDelay + secondDelay + 1) / 2);
    scheduleObjectTimer(
        survivor, OBJECT_TIMER_KIND.SHRINK_GLOB,
        (state?.moves ?? 0) + delay, state,
    );
}

function mergeOrdinary(survivor, incoming) {
    const firstQuantity = survivor.quan ?? survivor.quantity ?? 1;
    const secondQuantity = incoming.quan ?? incoming.quantity ?? 1;
    const quantity = firstQuantity + secondQuantity;
    if (!incoming.lamplit) {
        survivor.age = Math.trunc(
            (((survivor.age ?? 0) * firstQuantity)
                + ((incoming.age ?? 0) * secondQuantity)) / quantity,
        );
    }
    survivor.quan = survivor.quantity = quantity;
    if (survivor.oclass === COIN_CLASS) {
        survivor.owt = coinStackWeight(quantity);
        survivor.bknown = false;
    } else if ((survivor.oeaten ?? 0) > 0
        || !Number.isFinite(OBJECT_WEIGHT[survivor.otyp])) {
        survivor.owt = (survivor.owt ?? 0) + (incoming.owt ?? 0);
    } else {
        survivor.owt = OBJECT_WEIGHT[survivor.otyp] * quantity;
    }
    stopAllObjectTimers(incoming);
}

// The first argument is the identity that survives.  The caller owns removal
// of `incoming` from its former chain before invoking this boundary.
export function mergeObjectStacks(survivor, incoming, state = game) {
    if (!mergable(survivor, incoming, state)) return null;

    if (survivor.globby) mergeGlob(survivor, incoming, state);
    else mergeOrdinary(survivor, incoming);

    if (!objectName(survivor) && objectName(incoming)) {
        if (incoming.oextra?.oname) {
            survivor.oextra = {
                ...(survivor.oextra || {}), oname: incoming.oextra.oname,
            };
        } else survivor.oname = incoming.oname;
    }
    if (!!survivor.known !== !!incoming.known) survivor.known = true;
    if (!!survivor.rknown !== !!incoming.rknown) survivor.rknown = true;
    if (!!survivor.bknown !== !!incoming.bknown) survivor.bknown = true;
    if (incoming.pickup_prev && survivor.where === 'invent')
        survivor.pickup_prev = true;
    if (incoming.bypass) survivor.bypass = true;

    stopAllObjectTimers(incoming);
    incoming.where = 'gone';
    incoming.ox = incoming.oy = 0;
    delete incoming.carrierMid;
    return survivor;
}
