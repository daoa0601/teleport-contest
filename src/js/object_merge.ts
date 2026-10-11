// object_merge.js — Shared ordinary stack compatibility and absorption.
// C refs: invent.c:mergable()/merged(), mkobj.c:obj_absorb().

import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import { LOST_THROWN } from './const.js';
import { game, requireLiveGame } from './gstate.js';
import {
    CORPSE, EGG, OBJECT_MERGE, POT_OIL, TALLOW_CANDLE,
    TIN, WAX_CANDLE,
} from './object_data.js';
import { deallocateObject, deleteObject, stopObjectTimers } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { billForObject, settleGlobAbsorptionBilling, visitBilledShopkeepers } from './shk.js';
import { announceGlobMerge, startGlobTimeout } from './glob.js';
import { plineWithContinuation } from './display.js';
import { endObjectBurn, objectShedsLight } from './light.js';
import { assertCreatedObject } from './object_release.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { objectWeight } from './weight.js';
import { mergeHeroWeaponSlots } from './weapon_slots.js';
import {
    OBJECT_TIMER_KIND, stopObjectTimer,
} from './object_timers.js';

const COIN_CLASS = 12;
const FOOD_CLASS = 7;


function objectName(object: GameObject | null | undefined): string {
    return object?.oextra?.oname ?? object?.oname ?? '';
}

function hasAttachment(object: GameObject): boolean {
    return !!(
        object?.oextra?.omid || object?.oextra?.omonst
    );
}

// C same_price(): each search follows next_shkp(TRUE), with its riling
// side effects, and prefers the first keeper for the second object.
function billedStackOwner(
    object: GameObject, state: GameState,
): ReturnType<typeof billForObject> {
    for (const keeper of visitBilledShopkeepers(state)) {
        const billed = billForObject(object, state, keeper);
        if (billed) return billed;
    }
    return null;
}

function sameBillPrice(first: GameObject, second: GameObject, state: GameState): boolean {
    const firstBill = billedStackOwner(first, state);
    const secondBill = (firstBill
        && billForObject(second, state, firstBill.resident))
        || billedStackOwner(second, state);
    return !!firstBill && !!secondBill
        && firstBill.resident === secondBill.resident
        && firstBill.entry.price === secondBill.entry.price;
}

export function mergable(
    otmp: GameObject | null | undefined, obj: GameObject | null | undefined,
    state: GameState = game,
): boolean {
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
    ] as const) {
        if (!!otmp[field] !== !!obj[field]) return false;
    }
    if ((otmp.spe ?? 0) !== (obj.spe ?? 0)) return false;
    if (obj.oclass === FOOD_CLASS
        && ((otmp.oeaten ?? 0) !== (obj.oeaten ?? 0)
            || !!otmp.orotten !== !!obj.orotten)) return false;

    const impairedSight = heroIsBlind(state) || heroIsHallucinating(state);
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
    // C: don't merge surcharged/differently priced unpaid stacks.
    if (obj.unpaid && !sameBillPrice(obj, otmp, state)) return false;
    if (hasAttachment(otmp) || hasAttachment(obj)) return false;

    const otmpName = objectName(otmp);
    const objName = objectName(obj);
    if ((otmpName && objName && otmpName !== objName)
        || (obj.otyp === CORPSE && !!otmpName !== !!objName)) return false;
    if ((otmp.oartifact ?? 0) !== (obj.oartifact ?? 0)) return false;
    if (!!otmp.known !== !!obj.known && impairedSight) return false;
    return true;
}

function combineGlobMatter(
    survivor: GameObject, incoming: GameObject, state: GameState,
): void {
    const firstWeight = survivor.oeaten || survivor.owt;
    const secondWeight = incoming.oeaten || incoming.owt;
    const totalWeight = firstWeight + secondWeight;
    const moves = state.moves;

    if (!!survivor.bknown !== !!incoming.bknown)
        survivor.bknown = incoming.bknown = false;
    if (!!survivor.rknown !== !!incoming.rknown)
        survivor.rknown = incoming.rknown = false;
    if (!!survivor.greased !== !!incoming.greased)
        survivor.greased = incoming.greased = false;
    if (survivor.orotten || incoming.orotten)
        survivor.orotten = incoming.orotten = true;

    const relativeAge = Math.trunc(
        ((moves - survivor.age) * firstWeight
            + (moves - incoming.age) * secondWeight) / totalWeight,
    );
    survivor.age = moves - relativeAge;
    survivor.owt += secondWeight;
    if (survivor.oeaten || incoming.oeaten)
        survivor.oeaten = totalWeight;
    survivor.quan = survivor.quantity = 1;

    const first = stopObjectTimer(survivor, OBJECT_TIMER_KIND.SHRINK_GLOB);
    const second = stopObjectTimer(incoming, OBJECT_TIMER_KIND.SHRINK_GLOB);
    const firstDelay = first ? first.deadline - moves : 0;
    const secondDelay = second ? second.deadline - moves : 0;
    const delay = Math.trunc(((firstDelay || 25) + (secondDelay || 25) + 1) / 2);
    startGlobTimeout(survivor, state, moves, delay);
}

// C obj_absorb(), distinct from merged(): billing precedes all changes,
// then raw deallocation skips ordinary name, knowledge and bill folding.
export async function absorbGlob(
    survivor: GameObject, incoming: GameObject, state: GameState = game,
    { publish = plineWithContinuation }: { publish?: MessagePublisher } = {},
): Promise<GameObject> {
    await settleGlobAbsorptionBilling(survivor, incoming, state, { publish });
    combineGlobMatter(survivor, incoming, state);
    unlinkObject(incoming, state);
    deallocateObject(incoming, state);
    return survivor;
}

function comparisonDiscovers(
    survivor: GameObject, incoming: GameObject, state: GameState,
): boolean {
    return !!survivor.known !== !!incoming.known
        || (!!survivor.rknown !== !!incoming.rknown && !!survivor.oerodeproof)
        || ((survivor.oclass === COIN_CLASS ? false : !!survivor.bknown)
            !== !!incoming.bknown && state.urole?.key !== 'priest');
}

function comparisonNeedsMessage(
    survivor: GameObject, incoming: GameObject, state: GameState,
): boolean {
    return survivor.where === 'inventory'
        && incoming.how_lost !== LOST_THROWN && survivor.how_lost !== LOST_THROWN
        && comparisonDiscovers(survivor, incoming, state);
}

// C merged() prelude, completed before either kind of display can yield.
function prepareStackMerge(
    survivor: GameObject, incoming: GameObject, state: GameState,
): boolean {
    const discovered = comparisonDiscovers(survivor, incoming, state);
    if (!survivor.globby) {
        const firstQuantity = survivor.quan ?? survivor.quantity ?? 1;
        const secondQuantity = incoming.quan ?? incoming.quantity ?? 1;
        const quantity = firstQuantity + secondQuantity;
        if (!incoming.lamplit) {
            survivor.age = Math.trunc(
                (survivor.age * firstQuantity + incoming.age * secondQuantity)
                    / quantity,
            );
        }
        survivor.quan = survivor.quantity = quantity;
        survivor.owt = objectWeight(survivor);
        if (survivor.oclass === COIN_CLASS) survivor.bknown = false;
    }
    const incomingName = objectName(incoming);
    if (!objectName(survivor) && incomingName) {
        if (incoming.oextra?.oname) {
            survivor.oextra = { ...(survivor.oextra || {}), oname: incoming.oextra.oname };
        } else survivor.oname = incomingName;
    }
    unlinkObject(incoming, state);
    if (incoming.pickup_prev && survivor.where === 'inventory')
        survivor.pickup_prev = true;
    if (incoming.lamplit) {
        endObjectBurn(incoming, state, state.moves);
        if (objectShedsLight(survivor)) state.vision_full_recalc = 1;
    }
    if (incoming.timed) stopObjectTimers(incoming, state);
    if (!!survivor.known !== !!incoming.known) survivor.known = true;
    if (!!survivor.rknown !== !!incoming.rknown) survivor.rknown = true;
    if (!!survivor.bknown !== !!incoming.bknown) survivor.bknown = true;
    mergeHeroWeaponSlots(survivor, incoming, state);
    if (incoming.bypass) survivor.bypass = true;
    return discovered;
}

// A creation merge has no display continuation. Reject such work before
// changing ages, quantities, timers or ownership; live callers must await it.
export async function mergeCreatedObjectStacks(
    survivor: GameObject, incoming: GameObject, state: GameState = game,
): Promise<GameObject | null> {
    assertCreatedObject(incoming, state);
    if (survivor.unpaid || billForObject(survivor, state) || incoming.owornmask)
        throw new Error('creation merge requires unbilled objects and an unworn incoming object');
    if (!mergable(survivor, incoming, state)) return null;
    if (incoming.globby || comparisonNeedsMessage(survivor, incoming, state))
        throw new Error('stack merge with display effects must be awaited');
    prepareStackMerge(survivor, incoming, state);
    await deleteObject(incoming, state, { mergeInto: survivor });
    return survivor;
}

export async function mergeObjectStacks(
    survivor: GameObject | null | undefined, incoming: GameObject | null | undefined,
    state: GameState = game,
): Promise<GameObject | null> {
    requireLiveGame(state);
    if (!survivor || !incoming || !mergable(survivor, incoming, state)) return null;
    const discovered = prepareStackMerge(survivor, incoming, state);
    if (incoming.globby) {
        await announceGlobMerge(survivor, incoming, state);
        return await absorbGlob(survivor, incoming, state);
    }
    if (discovered && survivor.where === 'inventory'
        && incoming.how_lost !== LOST_THROWN && survivor.how_lost !== LOST_THROWN) {
        await plineWithContinuation('You learn more about your items by comparing them.');
    }
    await deleteObject(incoming, state, { mergeInto: survivor });
    return survivor;
}
