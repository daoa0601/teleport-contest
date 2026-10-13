// Applying a cream pie to the hero's face.
// C ref: apply.c use_cream_pie().

import { heroIsHallucinating } from './senses.js';
import { pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { CREAM_PIE } from './object_data.js';
import { heroHasEyes } from './body_parts.js';
import { rnd, rn2 } from './rng.js';
import {
    blindfolded, heroIsBlind,
} from './senses.js';
import {
    chargeAlteredUnpaidObject,
} from './shk.js';
import { makeBlinded } from './sight_change.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { objectWeight } from './weight.js';
import type { GameObject } from './object_types.js';

function splitOnePie(stack: GameObject) {
    const quantity = stack.quan ?? stack.quantity ?? 1;
    if (quantity <= 1) return { pie: stack, several: false };

    const pie: GameObject = {
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
        lamplit: false,
        where: 'inventory',
    };
    pie.owt = objectWeight(pie);
    stack.quan = stack.quantity = quantity - 1;
    stack.owt = objectWeight(stack);

    return { pie, several: true };
}

async function deletePie(pie: GameObject) {
    await releaseWeaponSlots(pie);
    pie.owornmask = 0;
    pie.worn = false;
    const index = game.inventory?.indexOf(pie) ?? -1;
    if (index >= 0) game.inventory.splice(index, 1);
    pie.where = 'gone';
    game._capacityDirty = true;
}

export async function useCreamPie(stack: GameObject | null | undefined) {
    if (stack?.otyp !== CREAM_PIE) return false;
    const { pie, several } = splitOnePie(stack);
    const wasBlind = heroIsBlind(game);
    const wasCreamed = (game.u?.ucreamed ?? 0) > 0;
    const hallucinating = heroIsHallucinating(game);

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
        await makeBlinded((game.u.blindTurns ?? 0) + blindIncrement, { talk: false });
        const blind = heroIsBlind(game);
        if (!blind || wasBlind) {
            await plineWithContinuation(
                `There's ${wasCreamed ? 'more ' : ''}sticky goop all over your face.`,
            );
        } else {
            await plineWithContinuation(
                "You can't see through all the sticky goop on your face.",
            );
        }
    }

    await chargeAlteredUnpaidObject(pie, 'splatter');
    rn2(100);
    await deletePie(pie);
    return true;
}
