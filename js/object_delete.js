// Remove an object identity from the live game.
// C refs: mkobj.c obj_extract_self(), shk.c obfree(), and delete_contents().

import { game } from './gstate.js';
import { removeHeroEquipment } from './hero_equipment.js';
import {
    objectsInTimerGraph, stopAllObjectTimers,
} from './object_timers.js';
import { objectWeight } from './weight.js';

function containingObject(object, state) {
    if (object.container?.contents?.includes(object)) return object.container;
    return objectsInTimerGraph(state).find(candidate =>
        candidate !== object && candidate.contents?.includes(object));
}

function updateContainerWeights(container) {
    const visited = new Set();
    let current = container;
    while (current && !visited.has(current)) {
        visited.add(current);
        current.owt = objectWeight(current);
        current = current.container;
    }
}

function clearEquipment(object, state) {
    removeHeroEquipment(object, state);
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}

function detachObject(object, state) {
    const parent = object.where === 'contained'
        ? containingObject(object, state) : null;
    if (parent) {
        parent.contents = parent.contents.filter(content => content !== object);
        updateContainerWeights(parent);
    }

    if (object.where === 'inventory') {
        state.inventory = (state.inventory || [])
            .filter(candidate => candidate !== object);
    } else if (object.where === 'floor') {
        const pile = state.level?.objects?.[object.ox]?.[object.oy];
        const index = pile?.indexOf(object) ?? -1;
        if (index >= 0) pile.splice(index, 1);
    } else if (object.where === 'buried') {
        state.level.buriedObjects = (state.level?.buriedObjects || [])
            .filter(candidate => candidate !== object);
    } else if (object.where === 'migrating') {
        state.migratingObjects = (state.migratingObjects || [])
            .filter(candidate => candidate !== object);
    } else if (object.where === 'minvent') {
        for (const monster of state.level?.monsters || []) {
            const inventory = (monster.minvent || monster.inventory || [])
                .filter(candidate => candidate !== object);
            monster.minvent = inventory;
            monster.inventory = inventory;
            monster.hasInventory = inventory.length > 0;
            if (monster.mw === object) monster.mw = null;
        }
    }
    clearEquipment(object, state);
}

export function deleteObjectContents(container, state = game) {
    for (const object of [...(container?.contents || [])])
        deleteObject(object, state);
    if (container) {
        container.contents = [];
        container.owt = objectWeight(container);
    }
}

export function deleteObject(object, state = game) {
    if (!object || object.where === 'gone') return false;
    deleteObjectContents(object, state);
    detachObject(object, state);
    stopAllObjectTimers(object);
    object.where = 'gone';
    object.container = null;
    object.ocarry = null;
    object.ox = 0;
    object.oy = 0;
    object.lamplit = false;
    object.buried = false;
    delete object.carrierMid;
    return true;
}
