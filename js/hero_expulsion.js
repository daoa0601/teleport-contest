// Moving an engulfing monster off the hero after expulsion.
// C refs: mhitu.c expels(), mon.c unstuck(), mnexto().

import {
    IS_LAVA, IS_OBSTRUCTED, IS_POOL, WATER, isok,
} from './const.js';
import { game } from './gstate.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_SYMBOL,
} from './monster_data.js';
import { BOULDER } from './object_data.js';
import { rnd, rn2 } from './rng.js';
import { collectNearbyCoords } from './u_init.js';

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M2_ROCKTHROW = 0x08000000;
const S_EYE = 5;
const S_LIGHT = 25;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;

function destinationFitsMonster(monster, state, x, y) {
    if (!isok(x, y) || x === state.u?.ux && y === state.u?.uy) return false;
    if (state.level?.monsters?.some(candidate => candidate !== monster
        && !candidate.dead && candidate.mx === x && candidate.my === y)) {
        return false;
    }

    const location = state.level?.at?.(x, y);
    if (!location || IS_OBSTRUCTED(location.typ)) return false;
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const flying = !!(flags & M1_FLY)
        || MONSTER_SYMBOL[monster?.mnum] === S_EYE
        || MONSTER_SYMBOL[monster?.mnum] === S_LIGHT;
    if (location.typ === WATER && !(flags & M1_SWIM)) return false;
    if (IS_POOL(location.typ) && !flying && !(flags & M1_SWIM)) return false;
    if (IS_LAVA(location.typ) && !flying
        && monster?.mnum !== PM_FIRE_ELEMENTAL
        && monster?.mnum !== PM_SALAMANDER) return false;
    const objects = state.level?.objects?.[x]?.[y] || [];
    return !objects.some(object => object.otyp === BOULDER)
        || !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_ROCKTHROW);
}

export function releaseHeroFromMonster(monster, state = game) {
    state.u.ustuck = null;
    state.u.uswallow = 0;
    state.u.uswldtim = 0;
    state.u.ux = monster.mx;
    state.u.uy = monster.my;
    state.vision_full_recalc = 1;
    return { oldx: monster.mx, oldy: monster.my };
}

export function moveExpelledMonster(monster, state = game, {
    random = rn2,
    rollOne = rnd,
    calls = [],
} = {}) {
    monster.mspec_used = rollOne(2);
    calls.push('rnd(2)');
    const destination = collectNearbyCoords(
        state.u.ux, state.u.uy, 3, random, calls,
    ).find(({ x, y }) => destinationFitsMonster(monster, state, x, y));
    const oldx = monster.mx;
    const oldy = monster.my;
    if (destination) {
        monster.mx = destination.x;
        monster.my = destination.y;
    }
    return {
        oldx, oldy, x: monster.mx, y: monster.my,
        moved: oldx !== monster.mx || oldy !== monster.my,
    };
}
