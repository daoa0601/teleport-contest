import { changeHeroLuck } from './attrib.js';
// Egg state changes shared by throwing and floor breakage.
// C refs: obj.h stale_egg, uhitm.c hmon_hitmon_misc_obj(),
// and dothrow.c breakobj().
import { createFireExplosion } from './fire_explosion.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { EGG, ROCK } from './object_data.js';
import { stopAllObjectTimers } from './object_timers.js';
import { d } from './rng.js';
import { objectWeight } from './weight.js';
const GEM_CLASS = 13;
const MAX_EGG_HATCH_TIME = 200;
const PM_PYROLISK = MONSTER_NAME.indexOf('pyrolisk');
export function eggHasMonsterSpecies(egg) {
    return !!egg && egg.corpsenm !== undefined && Number.isInteger(egg.corpsenm)
        && egg.corpsenm >= 0
        && egg.corpsenm < MONSTER_NAME.length;
}
export function eggIsStale(egg, state = game) {
    return (state.moves ?? 0) - (egg?.age ?? 0) > 2 * MAX_EGG_HATCH_TIME;
}
export function applyHeroEggLuckPenalty(egg, state = game) {
    if (egg?.otyp !== EGG || !egg.spe || !eggHasMonsterSpecies(egg))
        return 0;
    const quantity = egg.quan ?? egg.quantity ?? 1;
    const penalty = Math.min(quantity, 5);
    changeHeroLuck(-penalty, state);
    return penalty;
}
export function isPyroliskEgg(egg) {
    return egg?.otyp === EGG && egg.corpsenm === PM_PYROLISK;
}
export function turnEggIntoRock(egg) {
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
    egg.owt = objectWeight(egg);
    return egg;
}
export function explodePyroliskEggAt(x, y, { state = game, heroCaused = !state.context.mon_moving, publish, random, rollDice = d, } = {}) {
    return createFireExplosion(x, y, rollDice(3, 6), {
        state,
        heroCaused,
        ...(publish ? { publish } : {}),
        ...(random ? { random } : {}),
    });
}
//# sourceMappingURL=egg_impact.js.map