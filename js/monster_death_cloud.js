// Clouds created by a monster's death.
// C ref: mon.c mondead().
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { createPoisonGasCloud } from './regions.js';
import { plineWithContinuation } from './display.js';
import { rn2 } from './rng.js';
const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');
export async function createSteamVortexDeathCloud(monster, state = game, random = rn2, publish = plineWithContinuation) {
    if (monster.mnum !== PM_STEAM_VORTEX)
        return null;
    return await createPoisonGasCloud(state, monster.mx, monster.my, random(10) + 5, 0, random, publish);
}
//# sourceMappingURL=monster_death_cloud.js.map