// Fire explosions from pyrolisk eggs and burning oil.
// C explode.c:explode_oil(), splatter_burning_oil().
import { BURNING_OIL, EXPL_FIERY, LOST_EXPLODING } from './const.js';
import { plineWithContinuation } from './display.js';
import { explode } from './explosion.js';
import { game } from './gstate.js';
import { endObjectBurn } from './light.js';
import { d, rn2 } from './rng.js';
// Extinguish before the blast so death and bones cannot retain its light.
export async function explodeLitOilPotion(potion, x, y, { state = game, heroCaused = true, publish = plineWithContinuation, random = rn2, rollDice = d, } = {}) {
    if (!potion?.lamplit)
        throw new TypeError('burning oil explosion requires a lit potion');
    const diluted = !!potion.odiluted;
    if (!endObjectBurn(potion, state, state.moves ?? 0))
        throw new Error('lit potion of oil has no active burn timer');
    potion.how_lost = LOST_EXPLODING;
    return explode(x, y, 11, rollDice(diluted ? 3 : 4, 4), BURNING_OIL, EXPL_FIERY, {
        state, heroCaused, publish, random,
    });
}
export function createFireExplosion(x, y, damage, { state = game, heroCaused = true, publish = plineWithContinuation, random = rn2, } = {}) {
    // Pyrolisk eggs use the native generic object class, with a fire spell type.
    return explode(x, y, -11, damage, 0, EXPL_FIERY, { state, heroCaused, publish, random });
}
//# sourceMappingURL=fire_explosion.js.map