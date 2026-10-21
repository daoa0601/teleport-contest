// Hero sleep state.
// C ref: timeout.c fall_asleep().

import { heroHasInvoluntaryDelay, nomul } from './command_state.js';
import { game } from './gstate.js';
import { FAINTED } from './const.js';
import { plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import { stopHeroOccupation } from './occupation.js';

export async function putHeroToSleep(turns: number, {
    state = game,
    reason = 'sleeping',
    doneMessage = 'You wake up.',
    publish = plineWithContinuation as MessagePublisher,
} = {}) {
    const hero = state.u;
    // fall_asleep() begins with stop_occupation(), which reports the
    // interrupted activity.
    await stopHeroOccupation(state, publish);
    const duration = Math.max(0, turns);
    // nomul() refuses to shorten an existing involuntary delay. fall_asleep()
    // still installs its sleep marker and recovery message afterward.
    nomul(-duration, state);
    state._helplessReason = reason;
    state._helplessDoneMessage = doneMessage;
    hero.usleep = state.moves || 1;
    return state._helplessTurns;
}

// C youprop.h:Unaware, using the current involuntary-delay representation.
export function heroIsUnaware(state = game) {
    return heroHasInvoluntaryDelay(state)
        && (heroIsUnconscious(state) || state.u?.uhs === FAINTED);
}

// C trap.c:unconscious(), narrower than Unaware (which also includes fainting).
export function heroIsUnconscious(state = game) {
    if (!heroHasInvoluntaryDelay(state)) return false;
    const message = state._helplessDoneMessage || '';
    return !!state.u?.usleep || message.startsWith('You awake')
        || message.startsWith('You regain con')
        || message.startsWith('You are consci');
}
