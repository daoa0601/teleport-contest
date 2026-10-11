// C spell.c:losespells(). Forgotten spells retain their casting letters.
import { exerciseWisdom } from './attrib.js';
import { game } from './gstate.js';
import { rn2, rnd, rnl } from './rng.js';
export function loseHeroSpellMemory({ state = game } = {}) {
    if (state.context.spbook) {
        state.context.spbook.book = null;
        state.context.spbook.o_id = 0;
    }
    if (state._occupation?.key === 'study-book')
        state._occupation = null;
    const spells = state.spells || [];
    let forgotten = rn2(spells.length + 1);
    if ((state.u.confusionTurns ?? 0) > 0)
        forgotten = Math.max(forgotten, rn2(spells.length + 1));
    if (forgotten > 1 && !rnl(7))
        forgotten = rnd(forgotten);
    for (let index = 0; forgotten > 0; index++) {
        if (rn2(spells.length - index) < forgotten) {
            const spell = spells[index];
            if (!spell)
                throw new Error(`No memorized spell at index ${index}`);
            spell.know = 0;
            exerciseWisdom(false, state);
            forgotten--;
        }
    }
}
//# sourceMappingURL=spell_memory.js.map