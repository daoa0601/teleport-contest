import { requirePlayingGame } from './gstate.js';
// Native uhitm.c:nohandglow() and hmon's surviving hand-to-hand target.
import { heroHandName } from './body_parts.js';
import { canSeeMonster, displayColorName, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { monsterName } from './monster_name.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { makePlural } from './object_grammar.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind } from './senses.js';
export async function confuseTouchedMonster(monster, { state = game } = {}) {
    requirePlayingGame(state);
    if (!state.u.umconf || monster.mconf)
        return;
    const hands = makePlural(heroHandName(state));
    const unseen = heroIsBlind(state)
        || heroIsInvisible(state) && !propertyIsActive('seeInvisible', state);
    let message;
    if (state.u.umconf === 1) {
        message = unseen ? `Your ${hands} stop tingling.`
            : `Your ${hands} stop glowing ${displayColorName('red', state)}.`;
    }
    else {
        message = unseen ? `The tingling in your ${hands} lessens.`
            : `Your ${hands} no longer glow so brightly ${displayColorName('red', state)}.`;
    }
    await plineWithContinuation(message);
    state.u.umconf--;
    if (monsterResistsEffect(monster, state.u.ulevel))
        return;
    monster.mconf = 1;
    if (!monster.mstun && !monster.msleeping && monster.mcanmove !== 0
        && !((monster.mfrozen ?? 0) > 0) && canSeeMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} appears confused.`);
    }
}
//# sourceMappingURL=confusing_touch.js.map