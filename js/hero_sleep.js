// Hero sleep state.
// C ref: timeout.c fall_asleep().
import { heroHasInvoluntaryDelay } from './cmd.js';
import { nomul } from './hack.js';
import { game } from './gstate.js';
import { FAINTED } from './const.js';
import { plineWithContinuation } from './pline.js';
import { stopHeroOccupation } from './occupation.js';
import { heroIsUnconscious } from './trap.js';
// C timeout.c:fall_asleep().
export async function putHeroToSleep(turns, { state = game, doneMessage = 'You wake up.', publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    // fall_asleep() begins with stop_occupation(), which reports the
    // interrupted activity.
    await stopHeroOccupation(state, publish);
    const duration = Math.max(0, turns);
    // nomul() refuses to shorten an existing involuntary delay. fall_asleep()
    // still installs its sleep marker and recovery message afterward.
    nomul(-duration, state);
    state._helplessReason = 'sleeping';
    state._helplessDoneMessage = doneMessage;
    hero.usleep = state.moves || 1;
    return state._helplessTurns;
}
// C youprop.h:Unaware — gm.multi < 0 && (unconscious() || is_fainted()),
// using the current involuntary-delay representation.
export function heroIsUnaware(state = game) {
    return heroHasInvoluntaryDelay(state)
        && (heroIsUnconscious(state) || state.u?.uhs === FAINTED);
}
//# sourceMappingURL=hero_sleep.js.map