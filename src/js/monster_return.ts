import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
// Monsters which may be replaced after they die.
// C ref: mon.c mondead().

import { game } from './gstate.js';
import { makemonAt } from './mklev.js';
import { monsterIsKop } from './monster_data.js';
import { rnd } from './rng.js';

function downstairs(state: GameState) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (!stair.isladder && !stair.up) return stair;
    }
    return null;
}

export async function returnDeadKop(
    monster: Monster, state: GameState = game, rollOne = rnd,
): Promise<Monster | null> {
    if (!monsterIsKop(monster.mnum)) return null;
    // mondead(): switch (rnd(5)) -- 1 near the down stairs, 2 anywhere.
    const returnRoll = rollOne(5);
    if (returnRoll > 2) return null;

    if (returnRoll === 1) {
        const stair = downstairs(state);
        if (stair)
            return makemonAt(monster.mnum, stair.sx, stair.sy, 0);
    }
    return makemonAt(monster.mnum, 0, 0, 0);
}
