// Object burial and buried-object ownership.
// C refs: dig.c bury_an_obj() and bury_objs().

import { ICE } from './const.js';
import { updateCorpseIceTimer } from './floor_object.js';
import { game } from './gstate.js';
import { endObjectBurn } from './light.js';
import { unlinkObject } from './object_location.js';
import {
    BOULDER, CORPSE, OBJECT_MATERIAL, POT_OIL, ROCK,
} from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer, stopAllObjectTimers,
} from './object_timers.js';
import { rnd } from './rng.js';

const POTION_CLASS = 8;

export function addBuriedObject(object, x, y, state = game) {
    if (!object) return object;
    removeFloorReference(object, state);
    object.where = 'buried';
    object.buried = true;
    object.ox = x;
    object.oy = y;
    if (!state.level.buriedObjects) state.level.buriedObjects = [];
    state.level.buriedObjects.unshift(object);
    updateCorpseIceTimer(
        object, x, y, state.level.at(x, y)?.typ === ICE, state,
    );
    return object;
}

export function buryObject(object, state = game) {
    if (!canBuryObject(object)) return false;
    unlinkObject(object, state);
    return buryUnlinkedObject(object, state);
}

export function canBuryObject(object) {
    return !!object && !objectResistsDestruction(object, 0, 0);
}

// The caller has unlinked the object and completed any inventory effects.
export function buryUnlinkedObject(object, state = game) {
    const x = object.ox;
    const y = object.oy;
    if (object.lamplit && object.otyp !== POT_OIL) endObjectBurn(object, state);

    const underIce = state.level?.at?.(x, y)?.typ === ICE;
    if ((object.otyp === ROCK && !underIce) || object.otyp === BOULDER) {
        stopAllObjectTimers(object);
        object.where = 'gone';
        object.buried = false;
        object.ox = object.oy = 0;
        return null;
    }

    scheduleBuriedRot(object, underIce, state);
    addBuriedObject(object, x, y, state);
    return true;
}

export function buryFloorObjectsAt(x, y, state = game) {
    const buried = [];
    const pile = state.level?.objects?.[x]?.[y];
    for (const object of [...(pile || [])]) {
        if (buryObject(object, state) === true) buried.push(object);
    }
    return buried;
}

function removeFloorReference(object, state) {
    const pile = state.level?.objects?.[object.ox]?.[object.oy];
    const index = pile?.indexOf(object) ?? -1;
    if (index >= 0) pile.splice(index, 1);
}

function scheduleBuriedRot(object, underIce, state) {
    const canRot = underIce
        ? object.oclass === POTION_CLASS
        : (OBJECT_MATERIAL[object.otyp] ?? Infinity) <= 8;
    if (object.otyp === CORPSE || !canRot
        || objectResistsDestruction(object, 5, 95)) {
        return;
    }
    scheduleObjectTimer(
        object, OBJECT_TIMER_KIND.ROT_ORGANIC,
        (underIce ? 0 : 250) + rnd(250) + (state.moves ?? 0), state,
    );
}
