// C trap.c:deltrap()/maybe_finish_sokoban(). Callers own actor release,
// terrain changes, and redraw; raw deletion only removes the trap itself.
import { HOLE, PIT } from './const.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import { recordGameLogEvent } from './gamelog.js';
import { clearPitConnections } from './pit_connections.js';

export function deleteTrap(trap: Trap, state: GameState = game): void {
    const level = requireGameLevel(state);
    clearPitConnections(trap, state);
    const index = level.traps.indexOf(trap);
    if (index < 0) throw new Error('deleteTrap: trap is not on the level');
    level.traps.splice(index, 1);
    if (trap.ttyp === PIT || trap.ttyp === HOLE) finishSokobanIfSolved(state);
}

export function finishSokobanIfSolved(state: GameState = game): void {
    const level = requireGameLevel(state);
    if (!level.flags.sokoban_rules || state.in_mklev) return;
    if (level.traps.some(trap => !trap.madeby_u
        && (trap.ttyp === PIT || trap.ttyp === HOLE))) return;

    level.flags.sokoban_rules = false;
    requirePlayingGame(state);
    const dungeon = state.dungeons[state.u.uz.dnum];
    if (!dungeon) throw new Error('A solved Sokoban level requires its dungeon.');
    const number = dungeon.entry_lev - state.u.uz.dlevel + 1;
    recordGameLogEvent(`completed ${number}${ordinalSuffix(number)} Sokoban level`, { state });
}

// C hacklib.c:ordin().
function ordinalSuffix(number: number): string {
    const digit = number % 10;
    if (digit === 0 || digit > 3 || Math.trunc((number % 100) / 10) === 1) return 'th';
    return digit === 1 ? 'st' : digit === 2 ? 'nd' : 'rd';
}
