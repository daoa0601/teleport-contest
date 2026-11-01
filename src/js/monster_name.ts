import type { Monster } from './monster_types.js';
// C mon.c:newcham() names the changed form with an x_monnam() call whose
// saddle is always suppressed. mon.c owns newcham(), so the helper stays in
// this module rather than joining the other do_name.c namers.

import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import { formatMonsterName } from './do_name.js';

// C newcham(): YMonnam with the saddle always suppressed.
export function monsterFormChangeName(monster: Monster, { state = game }: { state?: GameState } = {}): string {
    requireLiveGame(state);
    const name = formatMonsterName(monster, state, {
        article: 'your', suppressSaddle: true,
    });
    return name.charAt(0).toUpperCase() + name.slice(1);
}
