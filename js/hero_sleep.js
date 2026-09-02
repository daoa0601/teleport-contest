// Hero sleep state.
// C ref: timeout.c fall_asleep().

import { game } from './gstate.js';

export function putHeroToSleep(turns, {
    state = game,
    reason = 'sleeping',
    doneMessage = 'You wake up.',
} = {}) {
    const hero = state.u || (state.u = {});
    state._occupation = null;
    state._helplessTurns = Math.max(0, turns);
    state._helplessReason = reason;
    state._helplessDoneMessage = doneMessage;
    hero.usleep = state.moves || 1;
    return state._helplessTurns;
}
