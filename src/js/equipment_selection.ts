// C do_wear.c:equip_ok(), inaccessible_equipment(), count_worn_stuff().
import { armorWearDecision } from './armor_wear.js';
import {
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_SUGGEST,
    W_ACCESSORY, W_ARMOR,
} from './const.js';
import { isEyewear } from './eyewear.js';
import { game } from './gstate.js';
import { plineWithContinuation as pline } from './pline.js';
import { objectName, ownedObjectName } from './objnam.js';
import { objectOwnershipPrefix } from './shk.js';
import type { GameState } from './game_state.js';
import type { InventoryClassification } from './inventory_prompt.js';
import { MEAT_RING } from './object_data.js';
import type { GameObject } from './object_types.js';

type EquipmentAction = 'wear' | 'put on' | 'take off' | 'remove';

// C do_wear.c:equip_ok().
// C do_wear.c:puton_ok().
// C do_wear.c:remove_ok().
// C do_wear.c:wear_ok().
// C do_wear.c:takeoff_ok().
export function equipmentClassification(
    object: GameObject, action: EquipmentAction, itemAction = false, state: GameState = game,
): InventoryClassification {
    const removing = action === 'take off' || action === 'remove';
    const accessory = action === 'put on' || action === 'remove';
    const worn = !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY));
    if (removing !== worn) return GETOBJ_EXCLUDE_INACCESS;
    if (![3, 4, 5].includes(object.oclass) && !isEyewear(object) && object.otyp !== MEAT_RING)
        return GETOBJ_EXCLUDE;
    if (accessory !== (object.oclass !== 3)) return GETOBJ_DOWNPLAY;
    if (object.oclass === 3 && !removing && armorWearDecision(object, state).refusal)
        return GETOBJ_DOWNPLAY;
    if (removing && !itemAction && equipmentIsCovered(object, object.oclass === 4, state))
        return GETOBJ_EXCLUDE_INACCESS;
    return GETOBJ_SUGGEST;
}

function equipmentIsCovered(object: GameObject, knownCursedOnly: boolean, state: GameState): boolean {
    const blocks = (covering: GameObject | null | undefined) => !!covering
        && (!knownCursedOnly || !!covering.cursed && !!covering.bknown);
    if (object === state.uarm) return blocks(state.uarmc);
    if (object === state.uarmu) return blocks(state.uarmc) || blocks(state.uarm);
    if (object === state.uleft || object === state.uright) return blocks(state.uarmg);
    return false;
}

// C do_wear.c:inaccessible_equipment(..., FALSE).
export function coveringEquipment(object: GameObject): GameObject[] {
    if (!object.owornmask) return [];
    const { uarm, uarmc, uarmu, uarmg, uleft, uright } = game;
    if (object === uarm) return uarmc ? [uarmc] : [];
    if (object === uarmu) return [uarmc, uarm].filter(item => item != null);
    if (object === uleft || object === uright) return uarmg ? [uarmg] : [];
    return [];
}

export async function reportCoveredEquipment(object: GameObject): Promise<boolean> {
    const covering = coveringEquipment(object);
    const first = covering[0];
    if (!first) return false;
    const second = covering[1];
    const sameOwner = second !== undefined
        && objectOwnershipPrefix(first, game, { capitalized: false })
            === objectOwnershipPrefix(second, game, { capitalized: false });
    const name = covering.map((item, index) => {
        return index > 0 && sameOwner ? objectName(item)
            : ownedObjectName(item, game, { capitalized: false });
    }).join(' and ');
    await pline(`You need to take off ${name} to dip ${ownedObjectName(object, game, { capitalized: false })}.`);
    return true;
}

export function accessibleEquipment(accessory: boolean, state: GameState = game): GameObject[] {
    const objects = accessory
        ? [state.uleft, state.uright, state.uamul, state.ublindf]
        : [state.uarmh, state.uarms, state.uarmg, state.uarmf,
            state.uarmc || state.uarm || state.uarmu];
    return objects.filter((object): object is GameObject => object != null);
}

export function wearingFullEquipment(state: GameState = game): boolean {
    return !!(state.uarm && state.uarmu && state.uarmc && state.uarmh
        && state.uarms && state.uarmg && state.uarmf && state.uleft
        && state.uright && state.uamul && state.ublindf);
}
