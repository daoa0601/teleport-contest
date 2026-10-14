// Native lock.c keeps progress separately from the running occupation.
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

export function resetPick(state: GameState = game): void {
    state._lockAttempt = null;
}

export function maybeResetPick(container: GameObject | null, state: GameState = game): void {
    const attempt = state._lockAttempt;
    if (container ? attempt?.container === container : attempt?.container?.where !== 'inventory')
        resetPick(state);
}
