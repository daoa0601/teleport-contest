// C ref: dokick.c container_impact_dmg().  A kicked, dropped, or thrown
// container may lose fragile contents.  Callers own placement and pass the
// object's PRE-impact coordinates for shop-room attribution.
import { objectMaterial } from './object_material.js';
import { BAG_OF_HOLDING, BAG_OF_TRICKS, EGG, MIRROR, } from './object_data.js';
import { game, requireLiveGame } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import { isContainer } from './container.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { deleteObject } from './object_delete.js';
import { objectResistsDestruction } from './object_state.js';
import { formatHeardMessage } from './hero_speech.js';
import { rn2 } from './rng.js';
import { objectWeight } from './weight.js';
import { changeHeroLuck } from './attrib.js';
import { costlySpot, stolenValue, insideShopRoomAt, makeAngryShopkeeper } from './shk.js';
import { roomsAt } from './room.js';
import { shopkeeperName } from './shknam.js';
import { SHOPBASE } from './const.js';
import { currency } from './currency.js';
const GEM_CLASS = 13;
const GLASS = 19;
// dokick.c:443-450 per-item adapter: mark no_charge for the hero's own
// contents, then charge the item at its pre-destruction value.  Called by
// the container-impact owner immediately before each deletion.
export async function chargeDestroyedShopContent(object, x, y, fromInventory, { publish = plineWithContinuation, state = game } = {}) {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot)
        return 0;
    if (fromInventory && !object.unpaid)
        object.no_charge = true;
    return stolenValue(object, x, y, !!spot.resident.mpeaceful, { silent: true, publish, state });
}
// dokick.c:476-484 summary: insider debt or outsider damage and anger.
export async function settleDestroyedShopCharges({ loss, x, y, publish = plineWithContinuation, state = game }) {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot || !loss)
        return { loss, settled: false };
    const objectRooms = roomsAt(state.level, x, y, SHOPBASE);
    // C inside_shop(): a boundary hero is an outsider; the decode is the
    // shared shk helper, and the first-room equality stays separate.
    const heroRoom = insideShopRoomAt(state, state.u.ux, state.u.uy);
    const insider = heroRoom != null && objectRooms[0] === heroRoom.roomno;
    if (!insider) {
        await publish(`You caused ${loss} ${currency(loss)} worth of damage!`);
        await makeAngryShopkeeper(spot.resident, state);
    }
    else {
        await publish(`You owe ${shopkeeperName(spot.resident)} ${loss} ${currency(loss)} for objects destroyed.`);
    }
    return { loss, settled: true };
}
export async function containerImpactDamage(container, x, y, { state = game, publish = plineWithContinuation, random = rn2, fromInventory = true, } = {}) {
    // Contents breakage mutates live floor state, shop billing, and the
    // topline.
    requireLiveGame(state);
    /* only consider normal containers */
    if (!isContainer(container)
        || container.otyp === BAG_OF_HOLDING
        || container.otyp === BAG_OF_TRICKS
        || !(container.contents?.length))
        return;
    let loss = 0;
    let weightChanged = false;
    // C walks the cobj chain head to tail; add_to_container() prepends
    // (mkobj.c:2692-2693), so the chain is newest-first and the per-item
    // RNG outcomes land on the same objects in this iteration order.
    for (const content of [...container.contents]) {
        let result = null;
        if (objectMaterial(content.otyp) === GLASS
            && content.oclass !== GEM_CLASS
            && !objectResistsDestruction(content, 33, 100, random)) {
            result = 'shatter';
        }
        else if (content.otyp === EGG && random(3) === 0) {
            result = 'cracking';
        }
        if (!result)
            continue;
        if (content.otyp === MIRROR)
            changeHeroLuck(-2, state);
        /* eggs laid by you: always exactly 1 breaks (dokick.c:447-450) */
        if (content.otyp === EGG && content.spe
            && eggHasMonsterSpecies(content))
            changeHeroLuck(-1, state);
        // C You_hear(): suppression and prefixes without skipping the
        // destruction itself.
        const heard = formatHeardMessage(`a muffled ${result}.`, state);
        if (heard !== null)
            await publish(heard);
        /* per-item billing marks and values the live object before its
         * deletion (dokick.c:457-462 precede useup/obfree at 463-468) */
        loss += await chargeDestroyedShopContent(content, x, y, fromInventory, { state, publish });
        const quantity = content.quan ?? content.quantity ?? 1;
        if (quantity > 1) {
            content.quan = quantity - 1;
            content.quantity = quantity - 1;
        }
        else {
            await deleteObject(content, state);
        }
        /* contents of this container are no longer known */
        container.cknown = false;
        weightChanged = true;
    }
    if (weightChanged)
        container.owt = objectWeight(container);
    await settleDestroyedShopCharges({ loss, x, y, publish, state });
}
//# sourceMappingURL=container_impact.js.map