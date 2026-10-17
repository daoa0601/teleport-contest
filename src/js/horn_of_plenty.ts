// C mkobj.c:hornoplenty(), for doapply's one-charge use.
import { ICE, IRONBARS, Is_airlevel, Is_waterlevel, MAX_OIL_IN_FLASK } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { addObjectToContainer } from './object_container.js';
import { heroCanReachFloor } from './floor_reach.js';
import { dropObjectAtHero, hitFloorWithObject } from './object_drop.js';
import { landObjectOnAltar } from './altar_object.js';
import { ALTAR } from './const.js';
import { inventoryItemDescription } from './invent.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { surfaceName } from './terrain_name.js';
import { mkobj, rndClass } from './mklev.js';
import { consumeObjectCharge } from './object_charge.js';
import { FOOD_RATION, HORN_OF_PLENTY, LUMP_OF_ROYAL_JELLY, OBJECT_MAGIC, POT_BOOZE, POT_OIL, POT_SICKNESS, POT_WATER } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { learnObjectType } from './object_knowledge.js';
import { objectName, observeObjectForNaming } from './objnam.js';
import { rn2 } from './rng.js';
import { addShopObjectToBill } from './shk.js';
import { objectWeight } from './weight.js';
import type { GameObject } from './object_types.js';

export async function useHornOfPlenty(horn: GameObject, {
    tipping = false, target = null,
}: { tipping?: boolean; target?: GameObject | null } = {}): Promise<number> {
    requirePlayingGame(game);
    if (horn.spe < 1) {
        await pline('Nothing happens.');
        horn.cknown = true;
        return 0;
    }
    await consumeObjectCharge(horn, { maybeUnpaid: !tipping });
    let object: GameObject;
    let what: string;
    if (!rn2(13)) {
        object = await mkobj(8, false);
        if (OBJECT_MAGIC[object.otyp]) {
            do { object.otyp = rndClass(POT_BOOZE, POT_WATER); } while (object.otyp === POT_SICKNESS);
            if (object.otyp === POT_OIL) object.age = MAX_OIL_IN_FLASK;
        }
        what = object.quan > 1 ? 'Some potions spill' : 'A potion spills';
    } else {
        object = await mkobj(7, false);
        if (object.otyp === FOOD_RATION && !rn2(7)) object.otyp = LUMP_OF_ROYAL_JELLY;
        what = 'Some food spills';
    }
    await pline(`${what} out.`);
    object.blessed = horn.blessed;
    object.cursed = horn.cursed;
    object.owt = objectWeight(object);
    if (horn.unpaid) await addShopObjectToBill(object, game, { ininv: false, silent: tipping });
    const previousPriceSuppression = game.iflags.suppress_price;
    game.iflags.suppress_price = true;
    try {
        const terrain = game.level.requireAt(game.u.ux, game.u.uy).typ;
        if (!tipping) {
            observeObjectForNaming(object);
            const name = object.quan > 1 ? `${object.quan} ${makePlural(objectName(object, game))}` : objectName(object, game);
            const action = `The ${name} ${object.quan > 1 ? 'slip' : 'slips'}`;
            let destination = 'to the floor';
            if (game.u.uswallow) destination = 'out of your reach';
            else if (Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz) || terrain < IRONBARS || terrain >= ICE)
                destination = 'away from you';
            await holdAnotherObject(object, { dropMessage: `Oops!  ${action} ${destination}!` });
        } else if (target) {
            await addObjectToContainer(target, object);
            target.owt = objectWeight(target);
            if (target.where === 'inventory') await reportHeroEncumbrance();
        } else if (!heroCanReachFloor(game, { checkPit: true })) {
            await hitFloorWithObject(object);
        } else {
            if (terrain === ALTAR) await landObjectOnAltar(object);
            else {
                observeObjectForNaming(object);
                const description = inventoryItemDescription(object);
                await pline(`${description.charAt(0).toUpperCase()}${description.slice(1)} ${
                    object.quan === 1 ? 'drops' : 'drop'} to the ${surfaceName(game.u.ux, game.u.uy)}.`);
            }
            await dropObjectAtHero(object);
        }
    } finally {
        if (previousPriceSuppression === undefined) delete game.iflags.suppress_price;
        else game.iflags.suppress_price = previousPriceSuppression;
    }
    if (horn.dknown) learnObjectType(HORN_OF_PLENTY, game);
    return 1;
}
