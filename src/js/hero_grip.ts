import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

// C mon.c:set_ustuck(). A grip change can change the status conditions.
export function setHeroGrip(monster: Monster | null, state: GameState = game): void {
    state.context.botl = true;
    state.u.ustuck = monster;
    if (!monster) {
        state.u.uswallow = state.uswallow = 0;
        state.u.uswldtim = 0;
    }
}
