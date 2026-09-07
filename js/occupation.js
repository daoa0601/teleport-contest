// Interrupt ongoing work without cancelling an involuntary delay.
// C allmain.c:stop_occupation(), eat.c:maybe_finished_meal().

import { plineWithContinuation } from './display.js';
import { continueFoodMeal } from './eat.js';
import { game } from './gstate.js';
import { stopRun } from './runmode.js';

export async function stopHeroOccupation(
    state = game, publish = plineWithContinuation,
) {
    const occupation = state._occupation;
    if (occupation) {
        if (occupation.key === 'eat-food'
            && occupation.usedtime >= occupation.reqtime) {
            await continueFoodMeal(occupation, state);
        } else {
            await publish(`You stop ${occupation.text}.`);
        }
        state._occupation = null;
    }
    if (occupation || (state.multi ?? 0) >= 0) {
        state.multi = 0;
        state._commandCount = 0;
        stopRun(state);
    }
    state._cannedCommands = [];
}
