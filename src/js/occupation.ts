// Interrupt ongoing work without cancelling an involuntary delay.
// C allmain.c:stop_occupation(), eat.c:maybe_finished_meal().

import { plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import { continueFoodMeal } from './eat.js';
import { game } from './gstate.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import type { GameState } from './game_state.js';

export async function stopHeroOccupation(
    state: GameState = game, publish: MessagePublisher = plineWithContinuation, { finishMeal = true } = {},
) {
    const occupation = state._occupation;
    if (occupation) {
        if (finishMeal && occupation.key === 'eat-food'
            && (state.context.victual?.usedtime ?? 0) >= (state.context.victual?.reqtime ?? 0)) {
            state._occupation = null;
            await continueFoodMeal(occupation, state);
        } else {
            await publish(`You stop ${occupation.text}.`);
        }
        state._occupation = null;
    }
    if (occupation || (state.multi ?? 0) >= 0)
        endVoluntaryMultiTurn(state);
    state._cannedCommands = [];
}
