// Runtime command counts and interruption.
// C refs: cmd.c:reset_cmd_vars(), hack.c:nomul().
import { game } from './gstate.js';
import { stopRun } from './runmode.js';
import { clearCommandKeys } from './input.js';
// C cmd.c:reset_cmd_vars(). Full command_count belongs to the next parse.
export function resetCommandVariables(clearQueues) {
    stopRun();
    game.context.nopick = false;
    game.context.forcefight = false;
    game.context.move = 0;
    game.multi = 0;
    game.iflags.menu_requested = false;
    if (clearQueues) {
        game._cannedCommands = [];
        clearCommandKeys();
    }
}
// C hack.c:nomul(0). Cancel voluntary repetition, not an involuntary delay.
// Keep the full command count and any occupation. A timed occupation may
// still need its final callback after the remaining multi becomes zero.
export function endVoluntaryMultiTurn(state = game) {
    if (heroHasInvoluntaryDelay(state))
        return;
    state.context.botl = true;
    const hero = state.u;
    hero.invulnerable = false; // u.uinvulnerable, not the timed property
    hero.usleep = 0;
    state.multi = 0;
    stopRun(state);
    state._cannedCommands = [];
}
// Native multi < 0 includes sleep, paralysis, prayer, and delayed actions.
// Their remaining turns have separate owners in this runtime.
export function heroHasInvoluntaryDelay(state = game) {
    const dressing = state._delayedAction;
    return (state.multi ?? 0) < 0
        || (state._helplessTurns ?? 0) > 0
        || (state._prayerTurnsRemaining ?? 0) > 0
        || !!(dressing && dressing.kind !== 'steal' && dressing.remainingGlobalTurns > 0);
}
//# sourceMappingURL=command_state.js.map