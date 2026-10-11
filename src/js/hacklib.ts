// hacklib.js — Utility functions.
// C ref: hacklib.c, dungeon.c helpers

import { game } from './gstate.js';
import { COLNO, ROWNO } from './const.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GameState } from './game_state.js';

export function isok(x: number, y: number) {
    return x >= 1 && x <= COLNO - 1 && y >= 0 && y <= ROWNO - 1;
}

export function distmin(x1: number, y1: number, x2: number, y2: number) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function dist2(x1: number, y1: number, x2: number, y2: number) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// C ref: dungeon.c depth().  Internal branch levels are local coordinates;
// tty/status and dungeon listings use their absolute dungeon depth.
export function dungeonDepth(dnum: number, dlevel: number, dungeons = game?.dungeons) {
    const dungeon = dungeons?.[dnum];
    if (!dungeon) return dlevel;
    if (dungeon.dname === 'The Elemental Planes') return dlevel - 6;
    const start = typeof dungeon.depth_start === 'number' && Number.isInteger(dungeon.depth_start)
        ? dungeon.depth_start : 1;
    return start + dlevel - 1;
}

export function depth(uz: DungeonLocation | null | undefined, dungeons = game?.dungeons) {
    return dungeonDepth(uz?.dnum ?? 0, uz?.dlevel ?? 1, dungeons);
}

// C dungeon.c:deepest_lev_reached(). Endgame planes have negative depths
// and do not reduce the deepest dungeon level the hero has visited.
export function deepestLevelReached(noQuest = false, state = game) {
    let deepest = 0;
    for (const [dnum, dungeon] of (state.dungeons || []).entries()) {
        if (!dungeon.dunlev_ureached) continue;
        if (noQuest && dnum === state.quest_dnum) continue;
        deepest = Math.max(deepest,
            dungeonDepth(dnum, dungeon.dunlev_ureached, state.dungeons));
    }
    return deepest;
}

// C ref: dungeon.c:ledger_no().  Ledger numbers are save-file bookkeeping
// coordinates: every preceding dungeon contributes all of its local levels.
// They deliberately differ from both a branch-local dlevel and display depth.
export function ledgerNo(
    uz: DungeonLocation | null | undefined, state: Pick<GameState, 'dungeons'> = game,
) {
    const dungeonIndex = uz?.dnum ?? 0;
    const ledgerStart = state.dungeons.slice(0, dungeonIndex)
        .reduce((total, dungeon) =>
            total + (dungeon.num_dunlevs || 0), 0);
    return ledgerStart + (uz?.dlevel ?? 1);
}

export function maxLedgerNo(state: Pick<GameState, 'dungeons'> = game) {
    return state.dungeons.reduce((total, dungeon) =>
        total + (dungeon.num_dunlevs || 0), 0);
}

// C ref: dungeon.c:endgamelevelname().  Keep this name projection shared by
// the bottom status line and insight/background disclosure.
export function endgameLevelName(uz: DungeonLocation | null | undefined) {
    const endgameDepth = depth(uz);
    return new Map([
        [-5, 'Astral Plane'],
        [-4, 'Plane of Water'],
        [-3, 'Plane of Fire'],
        [-2, 'Plane of Air'],
        [-1, 'Plane of Earth'],
    ]).get(endgameDepth) || `unknown plane #${endgameDepth}`;
}

// C ref: rn2(x) already in rng.js — re-export not needed
