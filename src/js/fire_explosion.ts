import type { GameObject } from './object_types.js';
import type { ExplosionOptions } from './explosion.js';
import type { MagicDamageResult } from './magic_types.js';

export interface FireExplosionOptions extends ExplosionOptions {
    rollDice?: typeof d;
}

// Fire explosions from pyrolisk eggs and burning oil.
// C explode.c:explode_oil(), splatter_burning_oil().
import { BURNING_OIL, EXPL_FIERY, LOST_EXPLODING } from './const.js';
import { plineWithContinuation } from './display.js';
import { impossible } from './diagnostics.js';
import { explode } from './explosion.js';
import { game } from './gstate.js';
import { endObjectBurn } from './light.js';
import { objectCombatName } from './objnam.js';
import { d, rn2 } from './rng.js';

// Extinguish before the blast so death and bones cannot retain its light.
export async function explodeLitOilPotion(potion: GameObject, x: number, y: number, {
    state = game, heroCaused = !state.context.mon_moving, publish = plineWithContinuation,
    random = rn2, rollDice = d,
}: FireExplosionOptions = {}): Promise<MagicDamageResult> {
    const diluted = !!potion.odiluted;
    if (!potion.lamplit) {
        await impossible('exploding unlit oil', { state });
        await impossible(`end_burn: obj ${objectCombatName(potion, { state })} not lit`, { state });
    } else if (!endObjectBurn(potion, state, state.moves ?? 0)) {
        await impossible(`end_burn: obj ${objectCombatName(potion, { state })} not timed!`, { state });
    }
    potion.how_lost = LOST_EXPLODING;
    return explode(x, y, 11, rollDice(diluted ? 3 : 4, 4), BURNING_OIL, EXPL_FIERY, {
        state, heroCaused, publish, random,
    });
}

export function createFireExplosion(x: number, y: number, damage: number, {
    state = game, heroCaused = !state.context.mon_moving, publish = plineWithContinuation, random = rn2,
}: ExplosionOptions = {}): Promise<MagicDamageResult> {
    // Pyrolisk eggs use the native generic object class, with a fire spell type.
    return explode(x, y, -11, damage, 0, EXPL_FIERY, { state, heroCaused, publish, random });
}
