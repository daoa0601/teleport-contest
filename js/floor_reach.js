// Whether the hero can touch the floor at the current square.
// C refs: engrave.c can_reach_floor(); the trap.c uteetering_at_seen_pit()
// and uescaped_shaft() halves live in trap.ts now.
import { game } from './gstate.js';
import { floorReachProblem } from './trap.js';
// C engrave.c:can_reach_floor().
export function heroCanReachFloor(state = game, options = {}) {
    return floorReachProblem(state, options) === null;
}
//# sourceMappingURL=floor_reach.js.map