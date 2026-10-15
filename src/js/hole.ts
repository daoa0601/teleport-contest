// Liquid which can flow into a newly opened hole.
// C ref: dig.c:fillholetyp().

import {
    COLNO, LAVAPOOL, MOAT, POOL, ROOM, ROWNO,
} from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { rn2 } from './rng.js';
import { isLavaAt, isMoatAt, isPoolAt } from './terrain_properties.js';

function nearbyTerrain(x: number, y: number, state: GameState) {
    if (isMoatAt(x, y, state)) return 'moat';
    if (isPoolAt(x, y, state)) return 'pool';
    if (isLavaAt(x, y, state)) return 'lava';
    return null;
}

export function liquidForHole(
    x: number,
    y: number,
    state = game,
    { fillIfAny = false, random = rn2 } = {},
) {
    let pools = 0;
    let moats = 0;
    let lava = 0;
    for (let nearX = Math.max(1, x - 1);
        nearX <= Math.min(COLNO - 1, x + 1);
        nearX++) {
        for (let nearY = Math.max(0, y - 1);
            nearY <= Math.min(ROWNO - 1, y + 1);
            nearY++) {
            const terrain = nearbyTerrain(nearX, nearY, state);
            if (terrain === 'moat') moats++;
            else if (terrain === 'pool') pools++;
            else if (terrain === 'lava') lava++;
        }
    }

    if (!fillIfAny) pools = Math.trunc(pools / 3);
    if (lava && (fillIfAny || (lava > moats + pools && random(lava + 1))))
        return LAVAPOOL;
    if (moats && (fillIfAny || random(moats + 1))) return MOAT;
    if (pools && (fillIfAny || random(pools + 1))) return POOL;
    return ROOM;
}
