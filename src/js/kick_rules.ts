// Native dokick.c:martial() applies to role training, bigfoot, and boots.
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { MONSTER_NAME } from './monster_data.js';
import { KICKING_BOOTS } from './object_data.js';

export function heroHasMartialKick(state: GameState = game): boolean {
    return state.urole?.key === 'monk' || state.urole?.key === 'samurai'
        || state.u.umonnum === MONSTER_NAME.indexOf('sasquatch')
        || (state.uarmf || state.u.uarmf)?.otyp === KICKING_BOOTS;
}
