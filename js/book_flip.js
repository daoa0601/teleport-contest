// Applying a spellbook without studying it. C apply.c:flip_through_book().
import { displayColorName, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { makePlural } from './object_grammar.js';
import { learnObjectType } from './object_knowledge.js';
import { minimalObjectName } from './objnam.js';
import { OBJECT_MAGIC, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, } from './object_data.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
const FADED_INK = [
    'fresh', 'slightly faded', 'very faded', 'extremely faded', 'barely visible',
];
export async function flipThroughBook(book, { state = game } = {}) {
    requireLiveGame(state);
    if (state.u.uinwater) {
        await plineWithContinuation("You don't want to get the pages even more soggy, do you?");
        return { spentTime: false, heroDied: false };
    }
    const name = minimalObjectName(book, state);
    const pagesOf = (book.quan ?? book.quantity ?? 1) === 1 ? name : makePlural(name);
    await plineWithContinuation(`You flip through the pages of the ${pagesOf}.`);
    const blind = heroIsBlind(state);
    const hallucinating = heroIsHallucinating(state);
    if (book.otyp === SPE_BOOK_OF_THE_DEAD) {
        if (!heroIsDeaf(state)) {
            const sound = hallucinating ? 'chuckling' : 'rustling';
            await plineWithContinuation(`You hear the pages make an unpleasant ${sound} sound.`);
        }
        else if (!blind) {
            const color = displayColorName('red', state);
            await plineWithContinuation(`You see the pages glow faintly ${color}.`);
        }
        else {
            await plineWithContinuation('You feel the pages tremble.');
        }
    }
    else if (blind) {
        const texture = hallucinating ? 'freshly picked' : 'rough and dry';
        await plineWithContinuation(`The pages feel ${texture}.`);
    }
    else if (book.otyp === SPE_BLANK_PAPER) {
        const description = hallucinating ? "doesn't have much of a plot"
            : 'has nothing written in it';
        await plineWithContinuation(`This spellbook ${description}.`);
        learnObjectType(book.otyp, state);
    }
    else if (hallucinating) {
        await plineWithContinuation('You enjoy the animated initials.');
    }
    else if (book.otyp === SPE_NOVEL) {
        await plineWithContinuation('This looks like it might be interesting to read.');
    }
    else {
        const studies = Math.min(book.spestudied ?? 0, 4);
        const fading = FADED_INK[studies];
        if (fading === undefined)
            throw new Error(`Spellbook ${book.o_id} has invalid study count ${studies}`);
        const ink = OBJECT_MAGIC[book.otyp] ? 'magical ink' : 'ink';
        await plineWithContinuation(`The ${ink} in this spellbook is ${fading}.`);
    }
    return { spentTime: true, heroDied: false };
}
//# sourceMappingURL=book_flip.js.map