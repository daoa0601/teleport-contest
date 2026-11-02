// Whether the hero can touch the floor at the current square.
// C refs: engrave.c can_reach_floor(); the trap.c uteetering_at_seen_pit()
// and uescaped_shaft() halves live in trap.ts now.

import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { floorReachProblem } from './trap.js';

export type FloorReachProblem = 'swallowed' | 'held' | 'levitating'
    | 'riding' | 'ceiling' | 'pit-edge' | 'shaft-edge';
export interface FloorReachOptions { checkPit?: boolean }

// C engrave.c:can_reach_floor().
export function heroCanReachFloor(
    state: GameState = game,
    options: FloorReachOptions = {},
): boolean {
    return floorReachProblem(state, options) === null;
}
