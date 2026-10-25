// botl.c:botl_score().  The optional 'showscore' status field reports the
// same approximate running score as the endgame summary, before any death
// penalty.
import { hiddenGold } from './gold.js';
import { deepestLevelReached } from './hacklib.js';
import { heroGoldAmount } from './hero_gold.js';
import type { GameState } from './game_state.js';

export function botlScore(state: GameState): number {
    const deepest = deepestLevelReached(false, state);
    // hidden_gold(False): only gold in containers whose contents are known.
    let money = heroGoldAmount(state) + hiddenGold(state, false);
    // don't include initial gold; don't impose a penalty if it's all gone
    money -= state._initialGoldCount ?? 0;
    if (money < 0) money = 0;
    const depthBonus = 50 * (deepest - 1)
        + (deepest > 30 ? 10000 : deepest > 20 ? 1000 * (deepest - 20) : 0);
    return (state.u.urexp ?? 0) + money + depthBonus;
}
