// Rubbing royal jelly on eggs.
// C ref: apply.c use_royal_jelly().

import { pline } from './display.js';
import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { restartEggHatchTimer } from './mklev.js';
import { LUMP_OF_ROYAL_JELLY } from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, stopObjectTimer,
} from './object_timers.js';
import {
    moveUsedObjectToBill, rejoinShopBill, splitShopBill,
} from './shk.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { objectWeight } from './weight.js';

const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;

function quantityOf(object) {
    return object.quan ?? object.quantity ?? 1;
}

function takeOneJelly(stack) {
    const inventoryIndex = game.inventory.indexOf(stack);
    if (quantityOf(stack) === 1) {
        game.inventory.splice(inventoryIndex, 1);
        stack.where = 'free';
        return {
            jelly: stack,
            parent: null,
            inventoryIndex,
            billSplit: null,
        };
    }

    const jelly = {
        ...stack,
        o_id: nextIdent(game),
        quan: 1,
        quantity: 1,
        owt: 0,
        owornmask: 0,
        worn: false,
        wielded: false,
        alternate: false,
        ready: false,
        timed: 0,
        objectTimers: [],
        where: 'free',
    };
    jelly.owt = objectWeight(jelly);
    stack.quan = stack.quantity = quantityOf(stack) - 1;
    stack.owt = objectWeight(stack);
    return {
        jelly,
        parent: stack,
        inventoryIndex,
        billSplit: splitShopBill(stack, jelly),
    };
}

function putJellyBack(use) {
    if (use.parent) {
        use.parent.quan = use.parent.quantity = quantityOf(use.parent) + 1;
        use.parent.owt = objectWeight(use.parent);
        rejoinShopBill(use.billSplit);
        use.jelly.where = 'gone';
        return;
    }

    const index = Math.max(0, Math.min(
        use.inventoryIndex, game.inventory.length,
    ));
    game.inventory.splice(index, 0, use.jelly);
    use.jelly.where = 'inventory';
}

function consumeJelly(jelly) {
    releaseWeaponSlots(jelly);
    jelly.owornmask = 0;
    jelly.worn = false;
    if (!moveUsedObjectToBill(jelly)) jelly.where = 'gone';
    game._capacityDirty = true;
}

function eggHasHatchTimer(egg) {
    return objectTimers(egg).some(timer =>
        timer.kind === OBJECT_TIMER_KIND.HATCH_EGG);
}

function eggName(egg) {
    return quantityOf(egg) === 1 ? 'egg' : `${quantityOf(egg)} eggs`;
}

function quiverMessage(egg, adverb) {
    const verb = quantityOf(egg) === 1 ? 'quivers' : 'quiver';
    return `The ${eggName(egg)} ${verb} ${adverb}.`;
}

export async function useRoyalJelly(stack, chooseEgg) {
    if (stack?.otyp !== LUMP_OF_ROYAL_JELLY) return false;
    const use = takeOneJelly(stack);
    const egg = await chooseEgg();
    if (!egg) {
        putJellyBack(use);
        return false;
    }

    await pline(`You smear royal jelly all over your ${eggName(egg)}.`);
    const oldSpecies = egg.corpsenm ?? -1;
    if (oldSpecies === PM_KILLER_BEE) egg.corpsenm = PM_QUEEN_BEE;

    const hadTimer = eggHasHatchTimer(egg);
    let quivers = egg.corpsenm !== oldSpecies;
    if (use.jelly.cursed) {
        stopObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG);
        await pline(quivers || hadTimer
            ? quiverMessage(egg, 'feebly')
            : 'Nothing seems to happen.');
    } else {
        if ((egg.corpsenm ?? -1) >= 0 && !hadTimer) {
            restartEggHatchTimer(egg);
            quivers = eggHasHatchTimer(egg) || quivers;
        }
        if (use.jelly.blessed && !egg.spe) {
            egg.spe = 2;
            quivers = true;
        }
        if (egg.spe === 2) quivers = true;
        await pline(quivers
            ? quiverMessage(egg, 'briefly')
            : 'Nothing seems to happen.');
    }

    consumeJelly(use.jelly);
    return true;
}

export function isRoyalJelly(object) {
    return object?.otyp === LUMP_OF_ROYAL_JELLY;
}
