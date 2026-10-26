// gamelog.js — Chronicle of source-owned in-game events.
// C refs: include/global.h LL_* flags (defined in const.js), pline.c
// livelog_printf()/gamelog_add(), insight.c:do_gamelog()/show_gamelog().
import { game } from './gstate.js';
import { LL_NONE, LL_SPOILER } from './const.js';
export { LL_NONE, LL_WISH, LL_ACHIEVE, LL_UMONST, LL_DIVINEGIFT, LL_LIFESAVE, LL_CONDUCT, LL_ARTIFACT, LL_GENOCIDE, LL_KILLEDPET, LL_ALIGNMENT, LL_DUMP_ASC, LL_DUMP_ALL, LL_MINORAC, LL_SPOILER, LL_DUMP, LL_DEBUG, } from './const.js';
// insight.c:spoilerevent().  Entries saved before flags were tracked carry
// none, so they count as ordinary non-spoiler lines.
export function isSpoilerGameLogEvent(entry) {
    return ((entry.flags ?? 0) & LL_SPOILER) !== 0;
}
export function recordGameLogEvent(text, { state = game, turn = state.moves || 1, flags = LL_NONE, } = {}) {
    if (!text)
        return null;
    if (!Array.isArray(state.gamelog))
        state.gamelog = [];
    const entry = {
        turn: Math.max(1, Math.trunc(turn)),
        text: String(text),
        flags: Math.trunc(flags) || LL_NONE,
    };
    state.gamelog.push(entry);
    return entry;
}
export function gameLogEvents(state = game) {
    return Array.isArray(state.gamelog) ? state.gamelog : [];
}
//# sourceMappingURL=gamelog.js.map