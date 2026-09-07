// Moving an engulfing monster off the hero after expulsion.
// C refs: mhitu.c expels(), mon.c unstuck(), mnexto().

import { game } from './gstate.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import { AD_STCK, AT_ENGL, AT_HUGS } from './monster_attack_types.js';
import { rnd, rn2 } from './rng.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';

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
    const canHold = MONSTER_ATTACKS[monster.mnum].some(([type, damage]) =>
        type === AT_ENGL || type === AT_HUGS || damage === AD_STCK);
    if (!monster.mspec_used && canHold) {
        monster.mspec_used = rollOne(2);
        calls.push('rnd(2)');
    }
    const destination = findNearbyMonsterPosition(
        monster.mnum, state.u.ux, state.u.uy, { state, random, calls },
    );
    const oldx = monster.mx;
    const oldy = monster.my;
    if (destination) {
        monster.mx = destination.x;
        monster.my = destination.y;
        monster.mtrack = [];
    }
    return {
        oldx, oldy, x: monster.mx, y: monster.my,
        moved: oldx !== monster.mx || oldy !== monster.my,
    };
}
