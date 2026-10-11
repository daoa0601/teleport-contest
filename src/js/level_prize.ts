// C obj.h:is_mines_prize()/is_soko_prize(). The pending prize is one
// concrete object identity, not every object of its type or former prizes.
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

export function levelPrizeKind(
    object: GameObject, state: GameState = game,
): 'mines' | 'sokoban' | null {
    if (!Number.isInteger(object.o_id) || object.o_id <= 0) return null;
    const prizes = state.context.achieveo;
    if (object.o_id === prizes?.mines_prize_oid) return 'mines';
    if (object.o_id === prizes?.soko_prize_oid) return 'sokoban';
    return null;
}

export function isLevelPrize(object: GameObject, state: GameState = game): boolean {
    return levelPrizeKind(object, state) !== null;
}
