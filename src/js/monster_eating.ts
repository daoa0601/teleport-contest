import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
// C dogmove.c:finish_meating(). Unlike seemimic(), this does not remove
// corpse disguise metadata or change light blocking.

import { M_AP_NOTHING, M_AP_TYPE } from './const.js';
import { newsym } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { MONSTER_SYMBOL } from './monster_data.js';

const S_MIMIC = 13;

export function finishMonsterEating(monster: Monster, state: GameState = game): void {
    requireLiveGame(state);
    monster.meating = 0;
    if (M_AP_TYPE(monster) !== M_AP_NOTHING
        && MONSTER_SYMBOL[monster.mnum] !== S_MIMIC) {
        monster.m_ap_type = M_AP_NOTHING;
        monster.mappearance = 0;
        newsym(monster.mx, monster.my);
    }
}
