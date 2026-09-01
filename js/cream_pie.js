// Applying a cream pie to the hero's face.
// C ref: apply.c use_cream_pie().

import { pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { CREAM_PIE } from './object_data.js';
import { heroHasEyes } from './polyself.js';
import { rnd, rn2 } from './rng.js';
import {
    blindfolded, heroIsBlind, syncBlindness,
} from './senses.js';
import {
    chargeAlteredUnpaidObject, splitShopBill,
} from './shk.js';
import { redrawSight, rememberVisibleTerrain } from './sight_change.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { objectWeight } from './weight.js';

function splitOnePie(stack) {
    const quantity = stack.quan ?? stack.quantity ?? 1;
    if (quantity <= 1) return { pie: stack, several: false };

    const pie = {
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
        timed: false,
        lamplit: false,
        where: 'inventory',
    };
    pie.owt = objectWeight(pie);
    stack.quan = stack.quantity = quantity - 1;
    stack.owt = objectWeight(stack);
    splitShopBill(stack, pie);
    return { pie, several: true };
}

function deletePie(pie) {
    releaseWeaponSlots(pie);
    pie.owornmask = 0;
    pie.worn = false;
    const index = game.inventory?.indexOf(pie) ?? -1;
    if (index >= 0) game.inventory.splice(index, 1);
    pie.where = 'gone';
    game._capacityDirty = true;
}

export async function useCreamPie(stack) {
    if (stack?.otyp !== CREAM_PIE) return false;
    const { pie, several } = splitOnePie(stack);
    const wasBlind = heroIsBlind(game);
    const wasCreamed = (game.u?.ucreamed ?? 0) > 0;
    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);

    if (hallucinating) {
        await pline('You give yourself a facial.');
    } else {
        await pline(several
            ? 'You immerse your face in one of the cream pies.'
            : 'You immerse your face in the cream pie.');
    }

    if (heroHasEyes(game) && !blindfolded(game)) {
        const blindIncrement = rnd(25);
        game.u.ucreamed = (game.u.ucreamed ?? 0) + blindIncrement;
        game.u.blindTurns = (game.u.blindTurns ?? 0) + blindIncrement;
        const blind = syncBlindness(game);
        if (blind && !wasBlind) rememberVisibleTerrain();
        if (!blind || wasBlind) {
            await plineWithContinuation(
                `There's ${wasCreamed ? 'more ' : ''}sticky goop all over your face.`,
            );
        } else {
            await plineWithContinuation(
                "You can't see through all the sticky goop on your face.",
            );
        }
        if (blind !== wasBlind) await redrawSight();
    }

    await chargeAlteredUnpaidObject(pie, 'splatter');
    rn2(100);
    deletePie(pie);
    return true;
}
