// Egg state changes shared by throwing and floor breakage.
// C refs: obj.h stale_egg, uhitm.c hmon_hitmon_misc_obj(),
// and dothrow.c breakobj().

import { createFireExplosion } from './fire_explosion.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import { MONSTER_NAME } from './monster_data.js';
import { EGG, ROCK } from './object_data.js';
import { stopAllObjectTimers } from './object_timers.js';
import { d } from './rng.js';
import { objectWeight } from './weight.js';

const GEM_CLASS = 13;
const MAX_EGG_HATCH_TIME = 200;
const PM_PYROLISK = MONSTER_NAME.indexOf('pyrolisk');

export function eggHasMonsterSpecies(egg: GameObject | null | undefined): egg is GameObject & { corpsenm: number } {
    return !!egg && egg.corpsenm !== undefined && Number.isInteger(egg.corpsenm)
        && egg.corpsenm >= 0
        && egg.corpsenm < MONSTER_NAME.length;
}

export function eggIsStale(egg: GameObject | null | undefined, state: Pick<GameState, 'moves'> = game): boolean {
    return (state.moves ?? 0) - (egg?.age ?? 0) > 2 * MAX_EGG_HATCH_TIME;
}

export function applyHeroEggLuckPenalty(egg: GameObject | null | undefined, state: GameState = game): number {
    if (egg?.otyp !== EGG || !egg.spe || !eggHasMonsterSpecies(egg))
        return 0;
    const quantity = egg.quan ?? egg.quantity ?? 1;
    const penalty = Math.min(quantity, 5);
    state.u.uluck = Math.max(
        -13,
        Math.min(13, (state.u?.uluck ?? 0) - penalty),
    );
    return penalty;
}

export function isPyroliskEgg(egg: GameObject | null | undefined): boolean {
    return egg?.otyp === EGG && egg.corpsenm === PM_PYROLISK;
}

export function turnEggIntoRock(egg: GameObject): GameObject {
    stopAllObjectTimers(egg);
    egg.otyp = ROCK;
    egg.oclass = GEM_CLASS;
    egg.oartifact = 0;
    egg.artifact = false;
    egg.spe = 0;
    egg.enchantment = 0;
    egg.known = false;
    egg.dknown = false;
    egg.bknown = false;
    egg.typeKnown = false;
    egg.owt = objectWeight(egg);
    return egg;
}

export function explodePyroliskEggAt(x: number, y: number, {
    state = game,
    heroCaused = true,
    publish,
    random,
    rollDice = d,
}: {
    state?: GameState;
    heroCaused?: boolean;
    publish?: MessagePublisher;
    random?: (bound: number) => number;
    rollDice?: (count: number, sides: number) => number;
} = {}) {
    return createFireExplosion(x, y, rollDice(3, 6), {
        state,
        heroCaused,
        ...(publish ? { publish } : {}),
        ...(random ? { random } : {}),
    });
}
