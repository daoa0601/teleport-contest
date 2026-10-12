// C nhlua.c:nhl_gamestate() and free_tutorial().
import { I_SPECIAL, W_AMUL, W_ARM, W_ARMOR, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_BALL, W_CHAIN, W_QUIVER, W_RINGL, W_RINGR, W_SWAPWEP, W_TOOL, W_WEP, } from './const.js';
import { plineWithContinuation } from './display.js';
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { game } from './gstate.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { finishInventoryAddition, finishInventoryRemoval } from './hero_inventory.js';
import { deleteObject } from './object_delete.js';
import { syncBlindness } from './senses.js';
import { assignInventoryLetter } from './u_init.js';
import { findArmorClass } from './armor.js';
import { restoreHeroNutrition } from './hunger.js';
const WORN_SLOTS = [
    ['uarm', W_ARM], ['uarmc', W_ARMC], ['uarmh', W_ARMH],
    ['uarms', W_ARMS], ['uarmg', W_ARMG], ['uarmf', W_ARMF], ['uarmu', W_ARMU],
    ['uleft', W_RINGL], ['uright', W_RINGR], ['uwep', W_WEP],
    ['uswapwep', W_SWAPWEP], ['uquiver', W_QUIVER], ['uamul', W_AMUL],
    ['ublindf', W_TOOL], ['uball', W_BALL], ['uchain', W_CHAIN],
];
export async function changeTutorialState(state = game, restoring = false) {
    if (restoring) {
        if (!state._tutorialState) {
            console.error('Cannot restore tutorial state: no state was stored');
            return;
        }
        return restoreTutorialState(state);
    }
    if (state._tutorialState) {
        console.error('Cannot store tutorial state twice');
        return;
    }
    return storeTutorialState(state);
}
async function storeTutorialState(state) {
    const inventory = [...(state.inventory || [])];
    for (const object of inventory) {
        const mask = object.owornmask || 0;
        await removeHeroEquipment(object, state);
        for (const [slot] of WORN_SLOTS) {
            if (state[slot] === object)
                state[slot] = null;
            if (state.u[slot] === object)
                state.u[slot] = null;
        }
        if (state.u.uskin === object)
            state.u.uskin = null;
        object.owornmask = 0;
        object.worn = false;
        object.where = 'free';
        state.inventory = state.inventory.filter(candidate => candidate !== object);
        await finishInventoryRemoval(object, state);
        object.owornmask = mask;
    }
    state._lastInvNr = 51;
    // The C struct copies its embedded attributes and skills but retains
    // monster pointers. Equipment aliases have been cleared above.
    const { ustuck, usteed, ...hero } = state.u;
    state._tutorialState = {
        moves: state.moves,
        hero: {
            ...structuredClone(hero),
            ...(ustuck === undefined ? {} : { ustuck }),
            ...(usteed === undefined ? {} : { usteed }),
        },
        inventory: inventory.reverse(),
        spells: structuredClone(state.spells || []),
        mvitals: structuredClone(state.mvitals || []),
        discoveryOrder: structuredClone(state._objectDiscoveryOrder),
        encountered: structuredClone(state._encounteredObjectTypes),
    };
    state.spells = [];
}
async function restoreTutorialState(state) {
    const saved = state._tutorialState;
    if (!saved)
        throw new Error('Restoring the tutorial requires stored state.');
    const { uz, uz0 } = state.u;
    state.moves = saved.moves;
    await plineWithContinuation(`Resetting time to move #${state.moves}.`);
    state._lastInvNr = 51;
    for (const object of [...state.inventory])
        await deleteObject(object, state);
    for (const object of saved.inventory) {
        if (object.where === 'gone')
            continue;
        assignInventoryLetter(object);
        object.where = 'inventory';
        // addinv_nomerge() must keep each original identity and stack.
        state.inventory.push(object);
        await finishInventoryAddition(object, state);
        restoreWornItem(object, state);
        attachCursedFigurineTimer(object, state);
    }
    if (state.flags.fixinv !== false) {
        // C inv_rank() orders lowercase inventory letters before uppercase.
        state.inventory.sort((a, b) => {
            if (!a.invlet || !b.invlet)
                throw new Error('Restored inventory objects require assigned letters.');
            return (a.invlet.charCodeAt(0) ^ 32) - (b.invlet.charCodeAt(0) ^ 32);
        });
    }
    state.u = { ...saved.hero };
    if (uz === undefined)
        delete state.u.uz;
    else
        state.u.uz = uz;
    if (uz0 === undefined)
        delete state.u.uz0;
    else
        state.u.uz0 = uz0;
    for (const [slot] of WORN_SLOTS)
        state.u[slot] = state[slot] || null;
    state.mvitals = saved.mvitals;
    if (saved.discoveryOrder === undefined)
        delete state._objectDiscoveryOrder;
    else
        state._objectDiscoveryOrder = saved.discoveryOrder;
    if (saved.encountered === undefined)
        delete state._encounteredObjectTypes;
    else
        state._encounteredObjectTypes = saved.encountered;
    // C restores disco[], not objects[].oc_name_known. Object type names
    // learned during the tutorial remain known, but user-given names clear.
    state._objectCallNames = {};
    state.spells = saved.spells;
    await plineWithContinuation(restoreHeroNutrition(state));
    state._unweapon = !state.uwep;
    state._capacityDirty = true;
    syncBlindness(state);
    findArmorClass(state);
    delete state._tutorialState;
}
function restoreWornItem(object, state) {
    const mask = object.owornmask || 0;
    if ((mask & (W_ARM | I_SPECIAL)) === (W_ARM | I_SPECIAL)) {
        state.uskin = object;
        return;
    }
    for (const [slot, bit] of WORN_SLOTS) {
        if (!(mask & bit))
            continue;
        state[slot] = object;
        if (slot === 'uleft')
            object.wornSlot = 'left-ring';
        else if (slot === 'uright')
            object.wornSlot = 'right-ring';
        else if (slot === 'uarm' || slot === 'uarmc' || slot === 'uarmh'
            || slot === 'uarms' || slot === 'uarmg' || slot === 'uarmf'
            || slot === 'uarmu' || slot === 'uamul' || slot === 'ublindf') {
            object.wornSlot = slot;
        }
    }
    object.wielded = !!(mask & W_WEP);
    object.alternate = !!(mask & W_SWAPWEP);
    object.ready = !!(mask & W_QUIVER);
    object.worn = !!(mask & (W_ARMOR | W_RINGL | W_RINGR | W_AMUL | W_TOOL));
}
export async function discardTutorialState(state = game) {
    const saved = state._tutorialState;
    if (!saved)
        return;
    delete state._tutorialState;
    for (const object of saved.inventory) {
        object.owornmask = 0;
        await deleteObject(object, state);
    }
}
//# sourceMappingURL=tutorial_state.js.map