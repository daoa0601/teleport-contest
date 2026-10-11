// Native reading conduct: every reading counts, only the first is logged.
import { game, requireLiveGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
export function recordLiteracy(message, { state = game } = {}) {
    requireLiveGame(state);
    const conduct = state.u.uconduct;
    if (!conduct)
        throw new Error('Literacy requires initialized hero conduct.');
    const first = !conduct.literate;
    conduct.literate = (conduct.literate || 0) + 1;
    if (first)
        recordGameLogEvent(message, { state });
}
//# sourceMappingURL=literacy.js.map