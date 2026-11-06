// Native reading conduct: every reading counts, only the first is logged.
import { game, requireLiveGame } from './gstate.js';
import { LL_CONDUCT } from './const.js';
import { recordGameLogEvent } from './pline.js';
// Part of C read.c:doread(): the u.uconduct.literate break with its
// first-time livelog (C inlines this at every reading site).
export function recordLiteracy(message, { state = game } = {}) {
    requireLiveGame(state);
    const conduct = state.u.uconduct;
    if (!conduct)
        throw new Error('Literacy requires initialized hero conduct.');
    const first = !conduct.literate;
    conduct.literate = (conduct.literate || 0) + 1;
    if (first)
        recordGameLogEvent(message, { state, flags: LL_CONDUCT });
}
//# sourceMappingURL=literacy.js.map