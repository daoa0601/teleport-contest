// C ref: dokick.c container_impact_dmg().  A kicked, dropped, or thrown
// container may lose fragile contents.  Callers own placement and pass the
// object's PRE-impact coordinates for shop-room attribution.
import { BAG_OF_HOLDING, BAG_OF_TRICKS, EGG, MIRROR, OBJECT_MATERIAL, } from './object_data.js';
import { game, requireLiveGame } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { isContainer } from './container.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { deleteObject } from './object_delete.js';
import { objectResistsDestruction } from './object_state.js';
import { formatHeardMessage } from './hero_speech.js';
import { rn2 } from './rng.js';
import { chargeDestroyedShopContent, settleDestroyedShopCharges, } from './shop_loss.js';
import { objectWeight } from './weight.js';
const GEM_CLASS = 13;
const GLASS = 19;
function adjustLuck(state, delta) {
    const hero = state.u;
    hero.uluck = Math.max(-13, Math.min(13, (hero.uluck ?? 0) + delta));
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
        if (OBJECT_MATERIAL[content.otyp] === GLASS
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
            adjustLuck(state, -2);
        /* eggs laid by you: always exactly 1 breaks (dokick.c:447-450) */
        if (content.otyp === EGG && content.spe
            && eggHasMonsterSpecies(content))
            adjustLuck(state, -1);
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