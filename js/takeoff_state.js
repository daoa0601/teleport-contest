// C do_wear.c:takeoff_order, reset_remarm(), cancel_doff(), doffing().
import { game } from './gstate.js';
export const TAKEOFF_ORDER = [
    'ublindf', 'uwep', 'uarms', 'uarmg', 'uleft', 'uright', 'uarmc',
    'uarmh', 'uamul', 'uarm', 'uarmu', 'uarmf', 'uswapwep', 'uquiver',
];
export function takeoffSlotObject(slot, state = game) {
    return state[slot] || state.u[slot] || null;
}
export function resetBulkTakeoff(state = game) {
    delete state.context.takeoff;
}
// Slot replacement cancels work on that item, including an interrupted delay.
export function cancelSlotTakeoff(slot, state = game) {
    const progress = state.context.takeoff;
    if (!progress)
        return;
    progress.pending = progress.pending.filter(candidate => candidate !== slot);
    if (progress.current === slot) {
        progress.current = null;
        progress.delay = 0;
    }
}
export function isBeingTakenOff(object, state = game) {
    const slot = state.context.takeoff?.current;
    return !!slot && takeoffSlotObject(slot, state) === object;
}
//# sourceMappingURL=takeoff_state.js.map