// Applying a carried coin. C apply.c:flip_coin().
import { currentAttribute } from './attrib.js';
import { heroFingerName } from './body_parts.js';
import { A_DEX } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { objectName } from './objnam.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';
export async function flipCoin(coin, { state = game } = {}) {
    requireLiveGame(state);
    await plineWithContinuation(`You flip ${withIndefiniteArticle(objectName(coin, state))}.`);
    let lost = false;
    if (state.u.uinwater) {
        await plineWithContinuation('It tumbles away.');
        lost = true;
    }
    else {
        const dexterity = currentAttribute(A_DEX, state);
        if ((state.u.glibTurns ?? 0) > 0 || state.u.fumbling
            || propertyIsActive('fumbling', state)
            || (dexterity < 10 && rn2(dexterity) === 0)) {
            await plineWithContinuation(`It slips between your ${makePlural(heroFingerName(state))}.`);
            lost = true;
        }
    }
    if (lost) {
        let dropped = coin;
        if (objectQuantity(coin) > 1) {
            const split = splitObjectStack(coin, 1, state);
            if (!split)
                throw new Error(`Coin stack ${coin.o_id} could not be split`);
            dropped = split;
        }
        await dropInventoryObjectAtHero(dropped, { state });
    }
    else if (heroIsHallucinating(state)) {
        await plineWithContinuation(rn2(100) ? 'Wow, a double header!'
            : 'The coin miraculously lands on its edge!');
    }
    else {
        await plineWithContinuation(`It comes up ${rn2(2) ? 'heads' : 'tails'}.`);
    }
    return { spentTime: true, heroDied: !!state.program_state.gameover };
}
//# sourceMappingURL=coin_flip.js.map