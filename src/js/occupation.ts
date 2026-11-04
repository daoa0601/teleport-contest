// Interrupt ongoing work without cancelling an involuntary delay.
// C allmain.c:stop_occupation(), eat.c:maybe_finished_meal().

import { plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { eatfood } from './eat.js';
import { game } from './gstate.js';
import { cmdq_clear } from './cmd.js';
import { CQ_CANNED } from './const.js';
import { endVoluntaryMultiTurn } from './hack.js';
import type { GameState } from './game_state.js';

// C allmain.c:stop_occupation().
export async function stopHeroOccupation(
    state: GameState = game, publish: MessagePublisher = plineWithContinuation, { finishMeal = true } = {},
) {
    const occupation = state._occupation;
    if (occupation) {
        if (finishMeal && occupation.key === 'eat-food'
            && (state.context.victual?.usedtime ?? 0) >= (state.context.victual?.reqtime ?? 0)) {
            state._occupation = null;
            await eatfood(occupation, state);
        } else {
            await publish(`You stop ${occupation.text}.`);
        }
        state._occupation = null;
        state.context.botl = true;
    }
    if (occupation || (state.multi ?? 0) >= 0)
        endVoluntaryMultiTurn(state);
    cmdq_clear(CQ_CANNED, state);
}
