// Runtime command counts, interruption, and the per-command ECMD_* result
// that handlers report to the rhack() seam.
// C refs: cmd.c:reset_cmd_vars(), rhack(), hack.c:nomul().
import { game } from './gstate.js';
import { ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME } from './const.js';
import { stopRun } from './runmode.js';
import { clearCommandKeys } from './input.js';
import { clearRepeatCommand } from './command_repeat.js';
// C command handlers return an ECMD_* status which rhack() inspects after
// the command finishes (cmd.c:3810): ECMD_CANCEL and ECMD_FAIL make it call
// reset_cmd_vars(TRUE), clearing CQ_CANNED and CQ_REPEAT. JS handlers run
// before that seam, so they record the same bits here instead.
export function beginCommandResult(state = game) {
    state._commandResult = ECMD_OK;
}
// Multiple failure paths can combine bits exactly like a C return value
// (use_pole() returns res|ECMD_CANCEL after an already-timed wield).
export function commandResultCancelled(state = game) {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_CANCEL;
}
export function commandResultFailed(state = game) {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_FAIL;
}
// doapply() ORs arti_speak()'s ECMD_TIME into the tool result
// (apply.c:4422), so a cancelled tool use by a speaking artifact still
// spends its turn.
export function commandResultSpentTime(state = game) {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_TIME;
}
// C cmd.c:reset_cmd_vars(). Full command_count belongs to the next parse.
// Unlike end_running(), reset_cmd_vars() zeroes context.run directly: no
// time repaint is queued and the terrain classifier is not recomputed.
export function resetCommandVariables(clearQueues) {
    game.context.run = 0;
    if (game._runState?.mode === 8)
        delete game._runState.visited;
    game._runState = null;
    game.context.mv = false;
    game.context.travel = false;
    game.context.travel1 = false;
    game.context.nopick = false;
    game.context.forcefight = false;
    game.context.move = 0;
    setMulti(0);
    game.iflags.menu_requested = false;
    game._movementAttempt = null;
    if (clearQueues) {
        clearCannedCommands();
        clearRepeatCommand();
    }
}
// C cmdq_clear(CQ_CANNED): commands and their answers share one queue.
export function clearCannedCommands(state = game) {
    state._cannedCommands = [];
    clearCommandKeys();
}
// C has one multi counter; involuntary delays have a positive mirror here.
export function currentMulti(state = game) {
    const helplessTurns = state._helplessTurns ?? 0;
    if (helplessTurns > 0)
        return -helplessTurns;
    return state.multi;
}
// Direct native assignments (combat wake, life saving, unmul, countdown)
// must change the same counter that nomul() compares during this turn.
export function setMulti(value, state = game) {
    state.multi = value;
    state._helplessTurns = Math.max(0, -value);
}
// C hack.c:nomul(). Caller-owned reasons and recovery messages follow this
// call even when a longer existing delay makes it return early.
export function nomul(value, state = game) {
    const previous = currentMulti(state);
    if (previous < value)
        return;
    if (previous >= 0)
        state.context.botl = true;
    const hero = state.u;
    hero.invulnerable = false; // u.uinvulnerable, not the timed property
    hero.usleep = 0;
    setMulti(value, state);
    if (value === 0)
        state._helplessReason = null;
    stopRun(state);
    clearCannedCommands(state);
}
// Keep the full command count and any occupation. A timed occupation may
// still need its final callback after the remaining multi becomes zero.
export function endVoluntaryMultiTurn(state = game) {
    nomul(0, state);
}
// Native multi < 0 includes sleep, paralysis, prayer, and delayed actions.
export function heroHasInvoluntaryDelay(state = game) {
    return currentMulti(state) < 0;
}
// C steal.c:thiefdead(), called by mon.c:m_detach() for death or removal.
// Keep the armor-removal delay, but replace the theft and recovery message.
export function armorThiefGone(monster, state = game) {
    const theft = state._armorTheft;
    if (!theft || theft.thief !== monster)
        return;
    theft.thief = null;
    if (state._afterMove?.kind === 'steal') {
        state._afterMove = { kind: 'unstolen-armor' };
        state._helplessDoneMessage = null;
    }
}
// C donning()/doffing() inspect afternmv, not a separate armor timer.
export function pendingArmorAction(state = game) {
    const after = state._afterMove;
    return after?.kind === 'wear' || after?.kind === 'remove' ? after : null;
}
//# sourceMappingURL=command_state.js.map