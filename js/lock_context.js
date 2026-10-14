// Native lock.c keeps progress separately from the running occupation.
import { game } from './gstate.js';
export function resetPick(state = game) {
    state._lockAttempt = null;
}
export function maybeResetPick(container, state = game) {
    const attempt = state._lockAttempt;
    if (container ? attempt?.container === container : attempt?.container?.where !== 'inventory')
        resetPick(state);
}
//# sourceMappingURL=lock_context.js.map