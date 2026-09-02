// Liquid which can flow into a newly opened hole.
// C ref: dig.c:fillholetyp().

import {
    COLNO, DB_LAVA, DB_MOAT, DB_UNDER, DRAWBRIDGE_UP,
    LAVAPOOL, MOAT, POOL, ROOM, ROWNO, WATER,
} from './const.js';
import { game } from './gstate.js';
import { rn2 } from './rng.js';

function nearbyTerrain(x, y, state) {
    const location = state.level?.at?.(x, y);
    if (!location) return null;
    const bridgeLiquid = location.typ === DRAWBRIDGE_UP
        ? (location.drawbridgemask ?? 0) & DB_UNDER
        : null;
    if (location.typ === MOAT || bridgeLiquid === DB_MOAT) return 'moat';
    if (location.typ === POOL || location.typ === WATER) return 'pool';
    if (location.typ === LAVAPOOL || bridgeLiquid === DB_LAVA) return 'lava';
    return null;
}

export function liquidForHole(
    x,
    y,
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
