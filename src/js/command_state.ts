// Runtime command counts and interruption.
// C refs: cmd.c:reset_cmd_vars(), hack.c:nomul().

import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { stopRun } from './runmode.js';
import { clearCommandKeys } from './input.js';
import { clearRepeatCommand } from './command_repeat.js';

// C cmd.c:reset_cmd_vars(). Full command_count belongs to the next parse.
export function resetCommandVariables(clearQueues: boolean): void {
    stopRun();
    game.context.nopick = false;
    game.context.forcefight = false;
    game.context.move = 0;
    setMulti(0);
    game.iflags.menu_requested = false;
    game._movementAttempt = null;
    if (clearQueues) {
        game._cannedCommands = [];
        clearCommandKeys();
        clearRepeatCommand();
    }
}

// C has one multi counter; involuntary delays have a positive mirror here.
export function currentMulti(state: GameState = game): number {
    const helplessTurns = state._helplessTurns ?? 0;
    if (helplessTurns > 0) return -helplessTurns;
    return state.multi;
}

// Direct native assignments (combat wake, life saving, unmul, countdown)
// must change the same counter that nomul() compares during this turn.
export function setMulti(value: number, state: GameState = game): void {
    state.multi = value;
    state._helplessTurns = Math.max(0, -value);
}

// C hack.c:nomul(). Caller-owned reasons and recovery messages follow this
// call even when a longer existing delay makes it return early.
export function nomul(value: number, state: GameState = game): void {
    const previous = currentMulti(state);
    if (previous < value) return;
    if (previous >= 0) state.context.botl = true;
    const hero = state.u;
    hero.invulnerable = false; // u.uinvulnerable, not the timed property
    hero.usleep = 0;
    setMulti(value, state);
    if (value === 0) state._helplessReason = null;
    stopRun(state);
    state._cannedCommands = [];
}

// Keep the full command count and any occupation. A timed occupation may
// still need its final callback after the remaining multi becomes zero.
export function endVoluntaryMultiTurn(state: GameState = game): void {
    nomul(0, state);
}

// Native multi < 0 includes sleep, paralysis, prayer, and delayed actions.
export function heroHasInvoluntaryDelay(state: GameState = game): boolean {
    return currentMulti(state) < 0;
}

// C steal.c:thiefdead(), called by mon.c:m_detach() for death or removal.
// Keep the armor-removal delay, but replace the theft and recovery message.
export function armorThiefGone(monster: Monster, state: GameState = game): void {
    const theft = state._delayedAction;
    if (theft?.kind !== 'steal' || theft.thief !== monster
        || state._helplessAfter !== 'steal-armor') return;
    state._helplessAfter = 'unstolen-armor';
    state._helplessDoneMessage = null;
}

