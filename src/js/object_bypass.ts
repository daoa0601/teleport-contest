// C worn.c:bypass_obj(), bypass_objlist(), nxt_unbypassed_obj/loot(),
// clear_bypasses(). Marks are shared by inventory traversal and magic.
import { NON_PM } from './const.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

export function bypassObject(object: GameObject, state: GameState = game): void {
    object.bypass = true;
    state.context.bypasses = true;
}

export function bypassObjectList(
    objects: readonly GameObject[], on: boolean, state: GameState = game,
): void {
    if (on && objects.length) state.context.bypasses = true;
    for (const object of objects) object.bypass = on;
}

// Pass the current chain each time: an action may remove or add objects.
// A sorted traversal also supplies its original order; stale entries are skipped.
export function nextUnbypassedObject(
    objects: readonly GameObject[], state: GameState = game,
    order: readonly GameObject[] = objects,
): GameObject | null {
    for (const object of order) {
        if (object.bypass || !objects.includes(object)) continue;
        bypassObject(object, state);
        return object;
    }
    return null;
}

export function clearBypasses(state: GameState = game): void {
    for (const column of state.level?.objects ?? [])
        for (const pile of column ?? []) clearChain(pile);
    clearChain(state.inventory);
    clearChain(state.migratingObjects);
    clearChain(state.level?.buriedObjects);
    clearChain(state.billObjects);
    for (const monster of state.level?.monsters ?? []) {
        if (monster.dead || monster.mhp <= 0) continue;
        clearChain(monster.minvent ?? monster.inventory);
        if (monster.mnum !== PM_LONG_WORM) continue;
        if (monster.mcorpsenm !== undefined) monster.mcorpsenm = NON_PM;
        if (monster.mextra?.mcorpsenm !== undefined) monster.mextra.mcorpsenm = NON_PM;
    }
    for (const monster of state._migratingMonsters ?? [])
        clearChain(monster.minvent ?? monster.inventory);
    // A swallowed hero's ball and chain can be outside every object chain.
    if (state.uball) state.uball.bypass = false;
    if (state.uchain) state.uchain.bypass = false;
    state.context.bypasses = false;
}

function clearChain(objects: readonly GameObject[] | null | undefined): void {
    for (const object of objects ?? []) {
        object.bypass = false;
        clearChain(object.contents);
    }
}
