// hacklib.js — Utility functions.
// C ref: hacklib.c, dungeon.c helpers

import { game } from './gstate.js';

export function isok(x, y) {
    const { COLNO, ROWNO } = await_const();
    return x >= 1 && x <= COLNO - 1 && y >= 0 && y <= ROWNO - 1;
}

// Lazy import to avoid circular deps
let _const = null;
function await_const() {
    if (!_const) _const = { COLNO: 80, ROWNO: 21 };
    return _const;
}

export function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function dist2(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// C ref: dungeon.c depth().  Internal branch levels are local coordinates;
// tty/status and dungeon listings use their absolute dungeon depth.
export function dungeonDepth(dnum, dlevel) {
    const dungeon = game?.dungeons?.[dnum];
    if (!dungeon) return dlevel;
    if (dungeon.dname === 'The Elemental Planes') return dlevel - 6;
    const start = Number.isInteger(dungeon.depth_start)
        ? dungeon.depth_start : 1;
    return start + dlevel - 1;
}

export function depth(uz) {
    return dungeonDepth(uz?.dnum ?? 0, uz?.dlevel ?? 1);
}

// C ref: dungeon.c:ledger_no().  Ledger numbers are save-file bookkeeping
// coordinates: every preceding dungeon contributes all of its local levels.
// They deliberately differ from both a branch-local dlevel and display depth.
export function ledgerNo(uz) {
    const dungeonIndex = uz?.dnum ?? 0;
    const ledgerStart = (game.dungeons || []).slice(0, dungeonIndex)
        .reduce((total, dungeon) =>
            total + (dungeon.num_dunlevs || 0), 0);
    return ledgerStart + (uz?.dlevel ?? 1);
}

export function maxLedgerNo() {
    return (game.dungeons || []).reduce((total, dungeon) =>
        total + (dungeon.num_dunlevs || 0), 0);
}

// C ref: dungeon.c:endgamelevelname().  Keep this name projection shared by
// the bottom status line and insight/background disclosure.
export function endgameLevelName(uz) {
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
