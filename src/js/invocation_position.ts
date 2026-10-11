// C hack.c:invocation_pos(). The level's vibrating square carries its
// persisted position; checking coordinates alone could match another level.
import { Invocation_lev, VIBRATING_SQUARE } from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';

export function isInvocationPosition(x: number, y: number, state: GameState = game): boolean {
    return Invocation_lev(state.u?.uz, state)
        && !!state.level?.traps?.some(trap =>
            trap.ttyp === VIBRATING_SQUARE && trap.tx === x && trap.ty === y);
}

export function heroIsOnStairs(state: GameState = game): boolean {
    const x = state.u?.ux, y = state.u?.uy;
    if (state.level?.upstair?.x === x && state.level.upstair.y === y)
        return true;
    if (state.level?.dnstair?.x === x && state.level.dnstair.y === y)
        return true;
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y) return true;
    }
    return false;
}
