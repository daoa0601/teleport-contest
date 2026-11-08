// C obj.h:is_mines_prize()/is_soko_prize(). The pending prize is one
// concrete object identity, not every object of its type or former prizes.
import { game } from './gstate.js';
// C obj.h:is_mines_prize()/is_soko_prize(): which pending prize
// (achieveo.mines_prize_oid / soko_prize_oid) this object identity is.
export function levelPrizeKind(object, state = game) {
    if (!Number.isInteger(object.o_id) || object.o_id <= 0)
        return null;
    const prizes = state.context.achieveo;
    if (object.o_id === prizes?.mines_prize_oid)
        return 'mines';
    if (object.o_id === prizes?.soko_prize_oid)
        return 'sokoban';
    return null;
}
// Part of C obj.h:is_mines_prize()/is_soko_prize(): the combined test.
export function isLevelPrize(object, state = game) {
    return levelPrizeKind(object, state) !== null;
}
//# sourceMappingURL=level_prize.js.map