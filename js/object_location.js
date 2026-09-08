// Unlink an object without destroying it or its contents.
// C mkobj.c:obj_extract_self(). Equipment effects belong to the caller.

import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import { objectsInTimerGraph } from './object_timers.js';
import { objectWeight } from './weight.js';

export function unlinkObject(object, state = game) {
    if (object.where === 'floor') {
        remove_object(object, state);
    } else if (object.where === 'contained') {
        let parent = object.container?.contents?.includes(object)
            ? object.container : objectsInTimerGraph(state).find(candidate =>
                candidate !== object && candidate.contents?.includes(object));
        if (parent) parent.contents = parent.contents.filter(item => item !== object);
        const updated = new Set();
        while (parent && !updated.has(parent)) {
            updated.add(parent);
            parent.owt = objectWeight(parent);
            parent = parent.container;
        }
    } else if (object.where === 'inventory') {
        state.inventory = state.inventory.filter(item => item !== object);
    } else if (object.where === 'buried') {
        state.level.buriedObjects = state.level.buriedObjects.filter(item => item !== object);
    } else if (object.where === 'migrating') {
        state.migratingObjects = state.migratingObjects.filter(item => item !== object);
    } else if (object.where === 'minvent') {
        const carrier = object.ocarry || state.level?.monsters.find(monster =>
            (monster.minvent || monster.inventory || []).includes(object));
        if (carrier) unlinkMonsterObject(carrier, object);
    }
    object.where = 'free';
    object.buried = false;
    object.container = null;
    object.ocarry = null;
    delete object.carrierMid;
    return object;
}
