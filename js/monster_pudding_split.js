// Native mhitm.c:mattackm(), after a landed weapon contact finishes hitmm().
import { canSpotMonster, plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { cloneMonster } from './monster_clone.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { objectMaterial } from './object_material.js';
import { rn2 } from './rng.js';
const IRON = 11;
const METAL = 12;
const PM_BLACK_PUDDING = MONSTER_NAME.indexOf('black pudding');
const PM_BROWN_PUDDING = MONSTER_NAME.indexOf('brown pudding');
// Contact can finish with a native MISS (for example, after life saving).
// Unlike hero hits, this rule does not exclude missiles or require the
// weapon to remain wielded. The caller supplies the contact's saved weapon.
export async function tryMonsterPuddingSplit(aggressor, defender, weapon, { state = game, visible, publish = plineWithContinuation, random = rn2 }) {
    requirePlayingGame(state);
    if (!weapon || defender.mhp <= 1 || defender.mcan
        || (defender.mnum !== PM_BLACK_PUDDING && defender.mnum !== PM_BROWN_PUDDING))
        return { split: false, heroDied: false, aggressorDied: false };
    const material = objectMaterial(weapon, state);
    if (material !== IRON && material !== METAL)
        return { split: false, heroDied: false, aggressorDied: false };
    const clone = await cloneMonster(defender, state, { random });
    if (!clone)
        return { split: false, heroDied: false, aggressorDied: false };
    if (visible && canSpotMonster(defender)) {
        await publish(`${monsterName(defender, { state, capitalized: true })} divides as ${monsterName(aggressor, { state })} hits it!`);
    }
    const trap = await triggerImmediateMonsterTrap(clone, state, { random });
    await finishImmediateMonsterTrap(trap, state, { publish, random });
    return {
        split: true,
        heroDied: !!state.program_state.gameover,
        aggressorDied: aggressor.mhp <= 0,
    };
}
//# sourceMappingURL=monster_pudding_split.js.map