import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
// Clouds created by a monster's death.
// C ref: mon.c mondead().

import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { createSteamCloud } from './regions.js';
import { rn2 } from './rng.js';

const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');

export function createSteamVortexDeathCloud(
    monster: Monster, state: GameState = game, random = rn2,
) {
    if (monster.mnum !== PM_STEAM_VORTEX) return null;
    return createSteamCloud(
        state, monster.mx, monster.my, random(10) + 5, random,
    );
}
