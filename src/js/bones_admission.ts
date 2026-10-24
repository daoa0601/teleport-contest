// C bones.c:can_make_bones()/no_bones_level(). Dungeon topology owns which
// levels can leave bones; the depth trial still runs in wizard and explore mode.
import { Invocation_lev, MAGIC_PORTAL } from './const.js';
import { specialLevelAt } from './dungeon.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GameState } from './game_state.js';
import { game, requirePlayingGame } from './gstate.js';
import { depth, ledgerNo, maxLedgerNo } from './hacklib.js';
import { rn2 } from './rng.js';

export function canMakeBones(state: GameState = game, random: typeof rn2 = rn2): boolean {
    requirePlayingGame(state);
    if (state.flags.bones === false) return false;
    const location = state.u.uz;
    const ledger = ledgerNo(location, state);
    if (ledger <= 0 || ledger > maxLedgerNo(state)) return false;
    const branchLevel = isBranchLevel(location, state);
    if (!levelAllowsBones(location, state)) return false;
    if (state.u.uswallow) return false;
    if (!branchLevel && state.level.traps.some(trap => trap.ttyp === MAGIC_PORTAL))
        return false;

    const dungeonDepth = depth(location, state.dungeons);
    if (dungeonDepth <= 0) return false;
    if (random(1 + (dungeonDepth >> 2)) === 0 && !state.flags.debug) return false;
    return !state.discover && !state.flags.explore;
}

export function levelAllowsBones(location: DungeonLocation, state: GameState = game): boolean {
    const dungeon = state.dungeons[location.dnum];
    if (!dungeon?.bonetag) return false;
    const special = specialLevelAt(location, state);
    if (special && !special.bonetag) return false;
    if (location.dlevel === dungeon.num_dunlevs) return false;
    if (isBranchLevel(location, state) && location.dlevel > 1) return false;
    return !Invocation_lev(location, state);
}

function isBranchLevel(location: DungeonLocation, state: Pick<GameState, 'branches'>): boolean {
    const here = (end: DungeonLocation) => end.dnum === location.dnum
        && end.dlevel === location.dlevel;
    return state.branches.some(branch => here(branch.end1) || here(branch.end2));
}
