// Applying a cream pie to the hero's face.
// C ref: apply.c use_cream_pie().
import { heroIsHallucinating } from './senses.js';
import { pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { CREAM_PIE } from './object_data.js';
import { heroHasEyes } from './body_parts.js';
import { rnd } from './rng.js';
import { blindfolded, heroIsBlind, } from './senses.js';
import { chargeAlteredUnpaidObject, } from './shk.js';
import { makeBlinded } from './sight_change.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { splitObjectStack } from './object_stack.js';
import { unlinkObject } from './object_location.js';
import { delobj } from './object_delete.js';
function splitOnePie(stack) {
    const quantity = stack.quan ?? stack.quantity ?? 1;
    if (quantity <= 1)
        return { pie: stack, several: false };
    const pie = splitObjectStack(stack, 1, game);
    if (!pie)
        throw new Error('A stack of cream pies must yield one pie.');
    return { pie, several: true };
}
async function deletePie(pie) {
    await releaseWeaponSlots(pie);
    unlinkObject(pie, game);
    await delobj(pie, game);
    game._capacityDirty = true;
}
export async function useCreamPie(stack) {
    if (stack?.otyp !== CREAM_PIE)
        return false;
    const { pie, several } = splitOnePie(stack);
    const wasBlind = heroIsBlind(game);
    const wasCreamed = (game.u?.ucreamed ?? 0) > 0;
    const hallucinating = heroIsHallucinating(game);
    if (hallucinating) {
        await pline('You give yourself a facial.');
    }
    else {
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
            await plineWithContinuation(`There's ${wasCreamed ? 'more ' : ''}sticky goop all over your face.`);
        }
        else {
            await plineWithContinuation("You can't see through all the sticky goop on your face.");
        }
    }
    await chargeAlteredUnpaidObject(pie, 'splatter');
    await deletePie(pie);
    return true;
}
//# sourceMappingURL=cream_pie.js.map