// C mthrowu.c:m_lined_up() and linedup().
import {
    BOLT_LIM, COULD_SEE, D_CLOSED, D_LOCKED, IS_DOOR, IS_OBSTRUCTED,
    IS_WATERWALL, LAVAWALL, M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE, Upolyd, isok,
} from './const.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { BOULDER, WAN_STRIKING } from './object_data.js';
import { rn2 } from './rng.js';
import { clearPath } from './vision.js';
import type { PlayingGameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';

type BoulderHandling = 'block' | 'ignore' | 'chance';
const M2_ROCKTHROW = 0x08000000;

export function monsterLinedUpWithMonster(
    source: Monster, target: Monster, state: PlayingGameState,
): boolean {
    return linedUp(source, { x: target.mx, y: target.my }, state, 'block', rn2);
}

export function monsterLinedUpWithHero(
    source: Monster, state: PlayingGameState, random = rn2,
): boolean {
    const appearance = M_AP_TYPE(state.u);
    if (Upolyd(state.u) && random(25)
        && (state.u.uundetected
            || appearance !== M_AP_NOTHING && appearance !== M_AP_MONSTER)) return false;
    const inventory = source.minvent ?? source.inventory ?? [];
    const ignoresBoulders = !!((MONSTER_FLAGS2[source.mnum] ?? 0) & M2_ROCKTHROW)
        || inventory.some(object => object.otyp === WAN_STRIKING);
    // A native monster that has not located the hero has zeroed mux/muy.
    const target = { x: source.mux ?? 0, y: source.muy ?? 0 };
    return linedUp(source, target, state, ignoresBoulders ? 'ignore' : 'chance', random);
}

function linedUp(
    source: Monster, target: Position, state: PlayingGameState,
    boulders: BoulderHandling, random: typeof rn2,
): boolean {
    const dx = target.x - source.mx;
    const dy = target.y - source.my;
    if ((!dx && !dy) || (dx && dy && Math.abs(dx) !== Math.abs(dy))
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM) return false;

    const targetsHeroSquare = target.x === state.u.ux && target.y === state.u.uy;
    const clear = targetsHeroSquare
        ? !!((state.viz_array?.[source.my]?.[source.mx] ?? 0) & COULD_SEE)
        : clearPath(target.x, target.y, source.mx, source.my);
    if (clear) return true;
    if (boulders === 'block') return false;

    const stepX = Math.sign(dx), stepY = Math.sign(dy);
    let x = source.mx, y = source.my;
    let boulderSquares = 0;
    do {
        x += stepX;
        y += stepY;
        if (blockingTerrain(state, x, y)) return false;
        if ((state.level.objects[x]?.[y] ?? []).some(object => object.otyp === BOULDER))
            boulderSquares++;
    } while (x !== target.x || y !== target.y);
    return boulders === 'ignore' || random(2 + boulderSquares) < 2;
}

export function blockingTerrain(state: PlayingGameState, x: number, y: number): boolean {
    if (!isok(x, y)) return true;
    const square = state.level.at(x, y);
    return !square || IS_OBSTRUCTED(square.typ)
        || IS_DOOR(square.typ) && !!((square.doormask ?? 0) & (D_CLOSED | D_LOCKED))
        || IS_WATERWALL(square.typ) || square.typ === LAVAWALL;
}
