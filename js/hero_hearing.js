// Native potion.c:make_deaf(). Commit the timeout before publishing its change.
import { TIMEOUT } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroIsDeaf, syncDeafness } from './senses.js';
export async function makeDeaf(turns, { state = game, talk = true } = {}) {
    requireLiveGame(state);
    const old = state.u.deafTurns || 0;
    state.u.deafTurns = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
    syncDeafness(state);
    if (!!old !== !!state.u.deafTurns && talk && !heroIsUnaware(state))
        await plineWithContinuation(old && !heroIsDeaf(state)
            ? 'You can hear again.' : 'You are unable to hear anything.');
}
//# sourceMappingURL=hero_hearing.js.map