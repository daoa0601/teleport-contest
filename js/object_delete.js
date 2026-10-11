// Remove an object identity from the live game.
// C refs: shk.c:1185-1275 obfree() as the deletion core, shk.c:1173-1183
// delete_contents(), invent.c:1428-1462 delobj()/delobj_core().
import { LEASH } from './object_data.js';
import { newsym } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { OBJECT_TIMER_KIND, stopAllObjectTimers } from './object_timers.js';
import { cleanupObjectBurn, objectShedsLight } from './light.js';
import { unlinkObject } from './object_location.js';
import { objectResistsDestruction } from './object_state.js';
import { reconcileObjectDeletionBill, objectPriceAdjustment } from './shk.js';
import { releaseObjectLeash } from './monster_leash.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { objectWeight } from './weight.js';
import { bookDisappears } from './spellbook_study.js';
const FOOD_CLASS = 7;
async function clearEquipment(object, state) {
    await removeHeroEquipment(object, state);
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}
// C eat.c:396-403 food_disappears(): stop being the meal in progress.
// Timers are stopped for every freed object further below.
function clearVictualReference(object, state) {
    if (state.context?.victual?.piece === object)
        state.context.victual = null;
}
export function stopObjectTimers(object, state) {
    const stoppedTimers = stopAllObjectTimers(object);
    const burn = stoppedTimers.find(timer => timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT);
    if (burn)
        cleanupObjectBurn(object, burn.deadline, state);
}
// C mkobj.c:dealloc_obj(). Billing, inventory release and meal cleanup
// belong to callers; raw absorption must not perform obfree() bookkeeping.
export function deallocateObject(object, state = game) {
    requireLiveGame(state);
    if (object.where === 'gone')
        return false;
    if (object.where !== 'free' || object.contents?.length)
        throw new Error('dealloc_obj requires a free object without contents');
    if (object.timed)
        stopObjectTimers(object, state);
    if (objectShedsLight(object))
        state.vision_full_recalc = 1;
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
export async function deleteObjectContents(container, state = game) {
    for (const object of [...(container?.contents || [])])
        await deleteObject(object, state);
    if (container) {
        container.contents = [];
        container.owt = objectWeight(container);
    }
}
// C shk.c:1185-1275 obfree().  A billed object is not freed: without a
// merge target it stays as a used-up bill entry; with one, the sink-owned
// billing branch reconciles the survivor's bill before deallocation.
// C maybe_reset_pick and next_boulder have no modeled state today;
// those clears are skipped rather than guessed.
export async function deleteObject(object, state = game, { mergeInto = null } = {}) {
    if (!object || object.where === 'gone')
        return false;
    bookDisappears(object, { state });
    if (object.otyp === LEASH && object.leashmon)
        releaseObjectLeash(object, state);
    if (object.oclass === FOOD_CLASS)
        clearVictualReference(object, state);
    await deleteObjectContents(object, state);
    unlinkObject(object, state);
    // C obj_stop_timers() runs cleanup even when the object stays on a bill.
    stopObjectTimers(object, state);
    const billing = reconcileObjectDeletionBill(object, mergeInto, state);
    if (billing === 'retained')
        return true;
    if (billing === 'blocked')
        return false;
    // C shk.c:1254-1264: when an object that is NOT on the bill is merged
    // away, the survivor takes over its identity number if the outgoing
    // one carried the unknown-item price surcharge and the survivor's did
    // not, so the merged stack keeps the higher price.
    if (mergeInto && billing === 'unbilled'
        && objectPriceAdjustment(object, object.o_id, state)
            > objectPriceAdjustment(mergeInto, mergeInto.o_id, state)) {
        mergeInto.o_id = object.o_id;
    }
    await clearEquipment(object, state);
    return deallocateObject(object, state);
}
// C invent.c:1428-1433 delobj(): normal object deletion (if unpaid, it
// remains on the bill).
export async function delobj(object, state = game) {
    await delobjCore(object, false, state);
}
// C invent.c:1435-1462 delobj_core().  `force` is the Rider-revival path.
export async function delobjCore(object, force, state = game) {
    requireLiveGame(state);
    /* obj_resists(obj,0,0) protects the Amulet, the invocation tools,
     * and Rider corpses; the ordinary path still consumes its rn2(100)
     * roll at zero probability (objectResistsDestruction does not skip
     * the call), so deletion RNG parity is preserved. */
    if (!force && objectResistsDestruction(object, 0, 0)) {
        object.in_use = false; /* in case caller has set this */
        return;
    }
    const updateMap = object.where === 'floor';
    unlinkObject(object, state);
    if (updateMap) {
        /* floor object's coordinates are always up to date */
        maybeUnhideAt(object.ox, object.oy, state);
        newsym(object.ox, object.oy);
    }
    await deleteObject(object, state);
}
//# sourceMappingURL=object_delete.js.map