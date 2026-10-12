// C do_wear.c:takeoff_order, reset_remarm(), cancel_doff(), doffing().
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

export const TAKEOFF_ORDER = [
    'ublindf', 'uwep', 'uarms', 'uarmg', 'uleft', 'uright', 'uarmc',
    'uarmh', 'uamul', 'uarm', 'uarmu', 'uarmf', 'uswapwep', 'uquiver',
] as const;
export type TakeoffSlot = typeof TAKEOFF_ORDER[number];

export interface TakeoffContext {
    pending: TakeoffSlot[];
    current: TakeoffSlot | null;
    delay: number;
    text: 'disrobing' | 'disarming';
}

export function takeoffSlotObject(slot: TakeoffSlot, state: GameState = game): GameObject | null {
    return state[slot] || state.u[slot] || null;
}

export function resetBulkTakeoff(state: GameState = game): void {
    delete state.context.takeoff;
}

// Slot replacement cancels work on that item, including an interrupted delay.
export function cancelSlotTakeoff(slot: TakeoffSlot, state: GameState = game): void {
    const progress = state.context.takeoff;
    if (!progress) return;
    progress.pending = progress.pending.filter(candidate => candidate !== slot);
    if (progress.current === slot) {
        progress.current = null;
        progress.delay = 0;
    }
}

export function isBeingTakenOff(object: GameObject, state: GameState = game): boolean {
    const slot = state.context.takeoff?.current;
    return !!slot && takeoffSlotObject(slot, state) === object;
}
