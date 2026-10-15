// C hack.c:avoid_moving_on_trap()/avoid_moving_on_liquid().
import { heroKnowsLavaWalking, heroKnowsWaterWalking } from './armor.js';
import { IS_WATERWALL, LAVAWALL, VIBRATING_SQUARE } from './const.js';
import { displayLiquidName, plineWithContinuation } from './display.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { trapName } from './trap_name.js';

export function knownRunTrap(x: number, y: number, state: GameState): Trap | undefined {
    return state.level?.traps.find(trap => trap.tx === x && trap.ty === y
        && trap.tseen && trap.ttyp !== VIBRATING_SQUARE);
}

export function runLiquidIsDangerous(x: number, y: number, state: GameState): boolean {
    const location = state.level?.at(x, y);
    if (!location) return false;
    const inAir = state.u.levitating || state.u.flying;
    const lava = isLavaAt(x, y, state), pool = isPoolAt(x, y, state);
    const liquidWall = IS_WATERWALL(location.typ) || location.typ === LAVAWALL;
    if ((location.typ === state.level?.at(state.u.ux, state.u.uy)?.typ
        || ((state.context.run ?? 0) < 2 && (!lava || inAir)) || state.context.travel)
        && (inAir || heroKnowsLavaWalking(state) || (pool && heroKnowsWaterWalking(state)))
        && !liquidWall) return false;
    return !!((pool || lava) && location.seenv);
}

export async function announceRunTrap(trap: Trap, state: GameState): Promise<void> {
    if (state.flags.mention_walls)
        await plineWithContinuation(`You stop in front of ${withIndefiniteArticle(trapName(trap.ttyp, { state }))}.`);
}

export async function announceRunLiquid(x: number, y: number, state: GameState): Promise<void> {
    if (state.flags.mention_walls)
        await plineWithContinuation(`You stop at the edge of the ${displayLiquidName(isPoolAt(x, y, state) ? 'water' : 'lava', state)}.`);
}
