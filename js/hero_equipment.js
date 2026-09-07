// Clear equipment when an item leaves the hero or changes type.
// C worn.c:setnotworn(). Command messages belong to the caller.

import { removeHeroAccessory } from './accessory.js';
import { armorSlotFor, removeHeroArmor } from './armor.js';
import { I_SPECIAL } from './const.js';
import { unequipEyewear } from './eyewear.js';
import { game } from './gstate.js';
import { syncBlindness } from './senses.js';
import { releaseWeaponSlots } from './weapon_slots.js';

export function removeHeroEquipment(object, state = game) {
    const armorSlot = armorSlotFor(object.otyp);
    if (state.uskin === object) {
        state.uskin = null;
        object.owornmask &= ~I_SPECIAL;
        removeHeroArmor(object, state);
    }
    if (armorSlot && (state[armorSlot] === object
        || state.u?.[armorSlot] === object)) {
        removeHeroArmor(object, state);
    }
    removeHeroAccessory(object, state);
    if (state.ublindf === object || state.u?.ublindf === object) {
        unequipEyewear(object, state);
        syncBlindness(state);
    }
    releaseWeaponSlots(object, state);
}
