// Remove an object identity from the live game.
// C refs: mkobj.c obj_extract_self(), shk.c obfree(), and delete_contents().

import { game } from './gstate.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { stopAllObjectTimers } from './object_timers.js';
import { unlinkObject } from './object_location.js';
import { objectWeight } from './weight.js';

function clearEquipment(object, state) {
    removeHeroEquipment(object, state);
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
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
    unlinkObject(object, state);
    clearEquipment(object, state);
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
