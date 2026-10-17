// Monsters which may be replaced after they die.
// C ref: mon.c mondead().
import { game } from './gstate.js';
import { makemonAt } from './mklev.js';
import { monsterIsKop } from './monster_data.js';
import { rnd } from './rng.js';
function downstairs(state) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (!stair.isladder && !stair.up)
            return stair;
    }
    return null;
}
export async function returnDeadKop(monster, state = game, rollOne = rnd) {
    if (!monsterIsKop(monster.mnum))
        return null;
    // mondead(): switch (rnd(5)) -- 1 near the down stairs, 2 anywhere.
    const returnRoll = rollOne(5);
    if (returnRoll > 2)
        return null;
    if (returnRoll === 1) {
        const stair = downstairs(state);
        if (stair)
            return makemonAt(monster.mnum, stair.sx, stair.sy, 0);
    }
    return makemonAt(monster.mnum, 0, 0, 0);
}
//# sourceMappingURL=monster_return.js.map