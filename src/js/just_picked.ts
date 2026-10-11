import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

export function clearJustPicked(state: GameState | null | undefined): void {
    for (const object of state?.inventory || [])
        object.pickup_prev = false;
}

export function markJustPicked(object: GameObject): GameObject;
export function markJustPicked(object: GameObject | null | undefined): GameObject | null | undefined;
export function markJustPicked(object: GameObject | null | undefined): GameObject | null | undefined {
    if (object) object.pickup_prev = true;
    return object;
}
