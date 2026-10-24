// gamelog.js — Chronicle of source-owned in-game events.
// C refs: livelog.c:livelog_printf(), insight.c:do_gamelog().
import { game } from './gstate.js';
export function recordGameLogEvent(text, { state = game, turn = state.moves || 1, } = {}) {
    if (!text)
        return null;
    if (!Array.isArray(state.gamelog))
        state.gamelog = [];
    const entry = { turn: Math.max(1, Math.trunc(turn)), text: String(text) };
    state.gamelog.push(entry);
    return entry;
}
export function gameLogEvents(state = game) {
    return Array.isArray(state.gamelog) ? state.gamelog : [];
}
//# sourceMappingURL=gamelog.js.map