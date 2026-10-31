// Applying a cream pie to the hero's face.
// C ref: apply.c use_cream_pie().
import { heroIsHallucinating } from './senses.js';
import { pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { CREAM_PIE } from './object_data.js';
import { heroFaceName, heroHasEyes } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { definiteName, objectName, observeObjectForNaming } from './objnam.js';
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
    // C apply.c:use_cream_pie() clears the wield slot via setnotworn(),
    // which does not arm the "begin bashing" bare-hands notice.
    await releaseWeaponSlots(pie, game, { keepUnweapon: true });
    await chargeAlteredUnpaidObject(pie, 'splatter');
    unlinkObject(pie, game);
    await delobj(pie, game);
}
export async function useCreamPie(stack) {
    if (stack?.otyp !== CREAM_PIE)
        return false;
    const wasBlind = heroIsBlind(game);
    const wasCreamed = (game.u?.ucreamed ?? 0) > 0;
    const { pie, several } = splitOnePie(stack);
    const hallucinating = heroIsHallucinating(game);
    if (hallucinating) {
        await pline('You give yourself a facial.');
    }
    else {
        observeObjectForNaming(pie);
        const name = definiteName(objectName(pie));
        const target = several ? `one of ${makePlural(name)}` : name;
        await pline(`You immerse your ${heroFaceName()} in ${target}.`);
    }
    if (heroHasEyes(game) && !blindfolded(game)) {
        const blindIncrement = rnd(25);
        game.u.ucreamed = (game.u.ucreamed ?? 0) + blindIncrement;
        await makeBlinded((game.u.blindTurns ?? 0) + blindIncrement, { talk: false });
        const blind = heroIsBlind(game);
        if (!blind || wasBlind) {
            await plineWithContinuation(`There's ${wasCreamed ? 'more ' : ''}sticky goop all over your ${heroFaceName()}.`);
        }
        else {
            await plineWithContinuation(`You can't see through all the sticky goop on your ${heroFaceName()}.`);
        }
    }
    await deletePie(pie);
    return true;
}
//# sourceMappingURL=cream_pie.js.map