// Decide how much of a floor or container stack the hero can lift.
// C refs: pickup.c carry_count() and lift_object().
import { clearMessageWindow, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroGoldAmount } from './hero_gold.js';
import { inventoryItemDescription } from './invent.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { BAG_OF_HOLDING, BOULDER, GOLD_PIECE, LOADSTONE, SCR_SCARE_MONSTER, } from './object_data.js';
import { mergable } from './object_merge.js';
import { objectQuantity } from './object_stack.js';
import { definiteName, objectCombatName, wishedObjectPresentation, observeObjectForNaming, } from './objnam.js';
import { heroIsPolymorphed } from './polyself.js';
import { promptYesNoQuit } from './query.js';
import { calcCapacity, invWeight, MOD_ENCUMBER, nearCapacity, objectWeight, pickupLoadPrefix, weightCapacity, } from './weight.js';
const COIN_CLASS = 12;
const INVENTORY_SLOT_COUNT = 52;
const M2_ROCKTHROW = 0x08000000;
function withQuantity(object, count) {
    return { ...object, quan: count, quantity: count };
}
function coinWeight(count) {
    return Math.trunc((Math.max(0, count) + 50) / 100);
}
function isCoin(object) {
    return object.otyp === GOLD_PIECE || object.oclass === COIN_CLASS;
}
// C carry_count() adds the stack's weight() (at least one unit for coins),
// then subtracts only the GOLD_WT() change from merging with carried gold.
function topLevelWeight(object, count, state) {
    const weight = objectWeight(withQuantity(object, count));
    if (!isCoin(object))
        return weight;
    const purse = heroGoldAmount(state);
    return weight - (coinWeight(purse) + coinWeight(count) - coinWeight(purse + count));
}
function containerWeightAfterRemoval(container, object, count) {
    const total = objectQuantity(object);
    const contents = (container.contents || []).flatMap(candidate => {
        if (candidate !== object)
            return [candidate];
        return count < total ? [withQuantity(object, total - count)] : [];
    });
    return objectWeight({ ...container, contents });
}
function weightAddedByLift(object, count, container, state) {
    const added = topLevelWeight(object, count, state);
    if (!container || !(state.inventory || []).includes(container))
        return added;
    const removed = container.otyp === BAG_OF_HOLDING
        ? objectWeight(container)
            - containerWeightAfterRemoval(container, object, count)
        : objectWeight(withQuantity(object, count));
    return added - removed;
}
function maximumLiftedCount(object, requested, container, state) {
    const current = invWeight(state) - 2 * weightCapacity(state);
    const fits = (count) => current
        + weightAddedByLift(object, count, container, state) < 0;
    if (fits(requested))
        return requested;
    const carriedContainer = !!container && (state.inventory || []).includes(container);
    if (isCoin(object) && !carriedContainer) {
        // C GOLD_CAPACITY() over the capacity left after carried gold.
        const purse = heroGoldAmount(state);
        const room = current - coinWeight(purse);
        return Math.max(0, Math.min(requested, room * -100 - (purse + 50) - 1));
    }
    let low = 0;
    let high = requested;
    while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(middle))
            low = middle;
        else
            high = middle - 1;
    }
    return low;
}
function itemDescription(object, count = objectQuantity(object)) {
    if (isCoin(object))
        return count === 1 ? 'a gold piece' : `${count} gold pieces`;
    const view = withQuantity(object, count);
    if (!view.name) {
        const presentation = wishedObjectPresentation(object);
        view.name = presentation.name;
        view.plural = presentation.plural;
        view.class = presentation.class;
    }
    return inventoryItemDescription(view);
}
function locationPhrase(container, state, short = false) {
    if (!container)
        return short ? 'here' : 'lying here';
    return `in ${definiteName(objectCombatName(container, { state, includeCorpseSpecies: false }), state)}`;
}
function presentTense(object) {
    return objectQuantity(object) === 1 ? 'is' : 'are';
}
async function reportPartialLift(object, count, container, telekinesis, state) {
    observeObjectForNaming(object, { state });
    const verb = container ? 'carry' : telekinesis ? 'acquire' : 'lift';
    await plineWithContinuation(`You can only ${verb} ${count === 1 ? 'one' : 'some'} of the ${itemDescription(object)} ${locationPhrase(container, state)}.`);
}
async function reportUnliftable(object, container, state, telekinesis) {
    const verb = container ? 'carry' : telekinesis ? 'acquire' : 'lift';
    observeObjectForNaming(object, { state });
    const description = itemDescription(object);
    const where = locationPhrase(container, state, !container);
    if ((state.inventory || []).length || heroGoldAmount(state)) {
        await plineWithContinuation(`There ${presentTense(object)} ${description} ${where}, but you cannot ${verb} any more.`);
        return;
    }
    const subject = objectQuantity(object) === 1 ? 'it ' : 'even one ';
    await plineWithContinuation(`There ${presentTense(object)} ${description} ${where}, but ${subject}is too heavy for you to ${verb}.`);
}
function inventoryObjectCount(state) {
    return (state.inventory || []).filter(object => object.otyp !== GOLD_PIECE && object.oclass !== COIN_CLASS).length;
}
function canMergeWithInventory(object, count, state) {
    const candidate = {
        ...withQuantity(object, count),
        how_lost: 0,
        no_charge: false,
    };
    return (state.inventory || []).some(carried => mergable(carried, candidate, state));
}
function heroThrowsRocks(state) {
    return heroIsPolymorphed(state)
        && state.u.umonnum !== undefined
        && !!((MONSTER_FLAGS2[state.u.umonnum] ?? 0) & M2_ROCKTHROW);
}
export function pickupBurden(state) {
    const setting = state.flags?.pickup_burden;
    if (typeof setting === 'number' && Number.isInteger(setting))
        return setting;
    const first = String(setting || 'stressed').toLowerCase().charAt(0);
    return new Map([['u', 0], ['b', 1], ['s', 2], ['n', 3],
        ['o', 4], ['t', 4], ['l', 5]]).get(first) ?? MOD_ENCUMBER;
}
function goldFollows(object, container, state) {
    const list = container
        ? container.contents || []
        : state.level?.objects?.[object.ox]?.[object.oy] || [];
    const index = list.indexOf(object);
    return index >= 0 && list.slice(index + 1).some(candidate => candidate.otyp === GOLD_PIECE || candidate.oclass === COIN_CLASS);
}
function resetRejectedScareScroll(object, container) {
    if (!container && object.otyp === SCR_SCARE_MONSTER)
        object.spe = 0;
}
export async function carryableObjectCount({ object, container = null, count = objectQuantity(object), telekinesis = false, state = game, }) {
    const total = objectQuantity(object);
    const requested = Math.max(0, Math.min(Math.trunc(count || total), total));
    const lifted = maximumLiftedCount(object, requested, container, state);
    if (lifted < requested && lifted > 0)
        await reportPartialLift(object, lifted, container, telekinesis, state);
    if (lifted < 1)
        await reportUnliftable(object, container, state, telekinesis);
    return lifted;
}
export async function liftObject({ object, container = null, count = objectQuantity(object), telekinesis = false, state = game, }) {
    const total = objectQuantity(object);
    count = Math.max(0, Math.min(Math.trunc(count || total), total));
    if (object.otyp === BOULDER && state.level?.flags?.sokoban_rules) {
        await plineWithContinuation(`You cannot get your hand around this ${objectCombatName(object, { state, includeCorpseSpecies: false })}.`);
        return { decision: 'stop', count: 0 };
    }
    const ignoresWeight = object.otyp === LOADSTONE
        || (object.otyp === BOULDER && heroThrowsRocks(state));
    if (ignoresWeight) {
        const sameType = (state.inventory || []).some(carried => carried.otyp === object.otyp);
        if (inventoryObjectCount(state) < INVENTORY_SLOT_COUNT
            || !sameType || canMergeWithInventory(object, total, state)) {
            return { decision: 'lift', count };
        }
        const noun = objectCombatName(object, { state, includeCorpseSpecies: false });
        await plineWithContinuation(`You are carrying too much stuff to pick up ${total === 1 ? 'another' : 'more'} ${noun}.`);
        return { decision: 'stop', count: 0 };
    }
    const liftedCount = await carryableObjectCount({
        object, container, count, telekinesis, state,
    });
    if (liftedCount < 1) {
        resetRejectedScareScroll(object, container);
        return { decision: 'stop', count: 0 };
    }
    if (object.otyp !== GOLD_PIECE && object.oclass !== COIN_CLASS
        && inventoryObjectCount(state) >= INVENTORY_SLOT_COUNT
        && !canMergeWithInventory(object, liftedCount, state)) {
        await plineWithContinuation(`Your knapsack cannot accommodate any more items${goldFollows(object, container, state) ? ' (except gold)' : ''}.`);
        resetRejectedScareScroll(object, container);
        return { decision: 'stop', count: 0 };
    }
    const extraWeight = weightAddedByLift(object, liftedCount, container, state);
    const previousBurden = Math.max(nearCapacity(state), pickupBurden(state));
    const nextBurden = calcCapacity(state, extraWeight);
    if (nextBurden > previousBurden) {
        if (telekinesis) {
            resetRejectedScareScroll(object, container);
            return { decision: 'skip', count: 0 };
        }
        const action = container ? 'removing' : 'lifting';
        observeObjectForNaming(object, { state });
        const answer = await promptYesNoQuit(`${pickupLoadPrefix(nextBurden)} ${action} ${itemDescription(object, liftedCount)}.  Continue?`);
        // pickup.c lift_object() clears WIN_MESSAGE after every answer, so
        // the question is gone before any later floor-pile window.
        clearMessageWindow();
        if (answer !== 'y') {
            resetRejectedScareScroll(object, container);
            return {
                decision: answer === 'q' ? 'stop' : 'skip',
                count: 0,
            };
        }
    }
    return { decision: 'lift', count: liftedCount };
}
//# sourceMappingURL=lift_object.js.map