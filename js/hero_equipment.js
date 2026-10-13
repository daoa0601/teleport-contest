// Clear equipment when an item leaves the hero or changes type.
// C worn.c:setnotworn(). Command messages belong to the caller.
import { clearHeroAccessory, removeHeroAccessory } from './accessory.js';
import { announceDisplacementLoss, armorSlotFor, clearHeroArmor, removeHeroArmor } from './armor.js';
import { I_SPECIAL } from './const.js';
import { removeEyewear, unequipEyewear } from './eyewear.js';
import { game } from './gstate.js';
import { syncBlindness } from './senses.js';
import { losePrimaryWeapon, releaseWeaponSlots } from './weapon_slots.js';
export async function removeHeroEquipment(object, state = game) {
    const armorSlot = armorSlotFor(object.otyp);
    if (state.uskin === object) {
        state.uskin = null;
        object.owornmask = (object.owornmask ?? 0) & ~I_SPECIAL;
        await clearHeroArmor(object, state);
    }
    if (armorSlot && (state[armorSlot] === object
        || state.u?.[armorSlot] === object)) {
        await clearHeroArmor(object, state);
    }
    clearHeroAccessory(object, state);
    if (state.ublindf === object || state.u?.ublindf === object) {
        unequipEyewear(object, state);
        syncBlindness(state);
    }
    await releaseWeaponSlots(object, state);
}
// C steal.c:remove_worn_item(). Landing can otherwise disrobe or burn the
// very item whose removal is still in progress.
export async function removeWornHeroItem(object, state = game) {
    const wasInUse = object.in_use;
    object.in_use = true;
    try {
        const slot = armorSlotFor(object.otyp);
        if (slot && (state[slot] === object || state.u?.[slot] === object)) {
            const cancelledDon = state._delayedAction?.kind === 'wear'
                && state._delayedAction.object === object;
            // Native *_off() clears worn sources; the command loop owns find_ac().
            const removed = await removeHeroArmor(object, state, {
                deferArmorClass: true,
            });
            if (removed && !cancelledDon)
                await announceDisplacementLoss(object, state);
        }
        await removeHeroAccessory(object, state);
        if (state.ublindf === object || state.u?.ublindf === object) {
            await removeEyewear(object, { state });
            if (state.program_state?.gameover)
                return;
        }
        if (state.uwep === object || state.u?.uwep === object)
            await losePrimaryWeapon(state);
        await removeHeroEquipment(object, state);
    }
    finally {
        if (wasInUse === undefined)
            delete object.in_use;
        else
            object.in_use = wasInUse;
    }
}
//# sourceMappingURL=hero_equipment.js.map