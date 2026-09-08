// Monster inventory operations.
// C refs: steal.c:mpickobj()/add_to_minv() and invent.c:carry_obj_effects().

import { attachCursedFigurineTimer } from './figurine_timer.js';
import {
    I_SPECIAL, LOST_DROPPED, LOST_NONE, LOST_STOLEN, LOST_THROWN,
    W_ARM, W_SADDLE, W_WEP,
} from './const.js';
import { place_object } from './floor_object.js';
import { game } from './gstate.js';
import { mergable, mergeObjectStacks } from './object_merge.js';
import { deleteObject } from './object_delete.js';
import { removeObjectAndContentsFromBill } from './shk.js';
import { artifactEmitsLight } from './artifacts.js';
import { endObjectBurn, objectShedsLight } from './light.js';
import { monsterCanEngulf } from './monster_data.js';
import { plineWithContinuation } from './display.js';
import { updateMonsterEquipment } from './monster_equipment.js';
import { unwieldMonsterWeapon } from './monster_weapon.js';

export function clearMonsterCarriedObjectState(object, state = game) {
    if (!object) return;
    if (object.lamplit && artifactEmitsLight(object)) endObjectBurn(object, state);
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    object.ocarry = null;
    delete object.carrierMid;
}

// NetHack adds newly acquired objects to the front of minvent. Some object
// creation code asks for the back explicitly. Carrying effects run before the
// object is linked because linking may merge it into an existing stack.
export function addObjectToMonsterInventory(
    monster, object, state = game, { atFront = true } = {},
) {
    if (!monster || !object) return null;
    // A hostile monster that keeps a thrown object has stolen it. A pet keeps
    // the original thrown or dropped marker.
    if (!monster.mtame) {
        if (object.how_lost === LOST_THROWN)
            object.how_lost = LOST_STOLEN;
        else if (object.how_lost === LOST_DROPPED)
            object.how_lost = LOST_NONE;
    }
    removeObjectAndContentsFromBill(object, state);
    object.no_charge = false;
    attachCursedFigurineTimer(object, state);
    const extinguishAfterPickup = objectShedsLight(object)
        && !artifactEmitsLight(object) && monsterCanEngulf(monster);
    const carried = linkObjectToMonsterInventory(
        monster, object, { atFront, state },
    );
    if (extinguishAfterPickup)
        endObjectBurn(carried, state, state.moves ?? 0);
    return carried;
}

// Some C callers use add_to_minv() directly for newly created objects such as
// monster gold. This function links those objects without pickup effects.
export function linkObjectToMonsterInventory(
    monster, object, { atFront = true, state = game } = {},
) {
    if (!monster || !object) return null;
    const inventory = monster.minvent || monster.inventory || [];
    const existing = inventory.find(candidate =>
        mergable(candidate, object, state));
    if (existing) {
        const survivor = mergeObjectStacks(existing, object, state);
        monster.minvent = inventory;
        monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
        survivor.where = 'minvent';
        survivor.carrierMid = monster.m_id ?? null;
        return survivor;
    }
    if (atFront) inventory.unshift(object);
    else inventory.push(object);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.where = 'minvent';
    // add_to_minv() leaves ox and oy unchanged. They remain either zero for a
    // new object or the object's former floor position.
    object.carrierMid = monster.m_id ?? null;
    return object;
}

// C obj_extract_self(): only unlink the object. Worn items must go through
// removeObjectFromMonsterInventory() to update the monster and its equipment.
export function unlinkMonsterObject(monster, object) {
    if (!monster || !object) return false;
    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(object);
    if (index < 0) return false;

    inventory.splice(index, 1);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.ocarry = null;
    delete object.carrierMid;
    object.where = 'free';
    return true;
}

export async function removeObjectFromMonsterInventory(monster, object, state = game, {
    publish = plineWithContinuation,
} = {}) {
    const worn = object.owornmask ?? 0;
    const wielded = monster.mw === object || object.wielded || (worn & W_WEP);
    if (!unlinkMonsterObject(monster, object)) return false;
    if ((worn & W_ARM) && object.lamplit && artifactEmitsLight(object))
        endObjectBurn(object, state);
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    if (worn) {
        if (!monster.dead && monster.mhp > 0)
            await updateMonsterEquipment(monster, object, false, state, { publish });
        monster.misc_worn_check = (monster.misc_worn_check ?? 0) & ~worn;
        monster.misc_worn_check |= I_SPECIAL;
    }
    if (monster.saddle === object || (worn & W_SADDLE)) {
        monster.saddle = null;
        monster.saddled = false;
    }
    if (wielded) await unwieldMonsterWeapon(monster, state, { weapon: object, publish });
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    return true;
}

export async function dropObjectFromMonsterInventory(
    monster, object, state = game, options = {},
) {
    if (!await removeObjectFromMonsterInventory(monster, object, state, options)) return null;
    return place_object(object, monster.mx, monster.my, state);
}

export async function destroyObjectFromMonsterInventory(
    monster, object, state = game, options = {},
) {
    if (!await removeObjectFromMonsterInventory(monster, object, state, options)) return false;
    return deleteObject(object, state);
}
