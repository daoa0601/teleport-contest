// The #monster unicorn-horn admission test (cmd.c:domonability()'s
// is_unicorn() branch). The apply.c use_unicorn_horn() port lives in
// apply.ts; heroCanUseUnicornHorn stays here because cmd.c's owner, cmd.ts,
// is outside this move.
import { game } from './gstate.js';
import { heroMonsterForm } from './polyself.js';
import { monsterIsUnicorn } from './monster_data.js';
import type { GameState } from './game_state.js';

export function heroCanUseUnicornHorn(state: GameState = game) {
    const form = heroMonsterForm(state);
    return form !== null && monsterIsUnicorn(form);
}
