// hacklib.js — Utility functions.
// C ref: hacklib.c, dungeon.c helpers
import { game } from './gstate.js';
import { COLNO, ROWNO } from './const.js';
export function isok(x, y) {
    return x >= 1 && x <= COLNO - 1 && y >= 0 && y <= ROWNO - 1;
}
export function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
export function dist2(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}
// C ref: dungeon.c depth().  Internal branch levels are local coordinates;
// tty/status and dungeon listings use their absolute dungeon depth.
export function dungeonDepth(dnum, dlevel, dungeons = game?.dungeons) {
    const dungeon = dungeons?.[dnum];
    if (!dungeon)
        return dlevel;
    if (dungeon.dname === 'The Elemental Planes')
        return dlevel - 6;
    const start = typeof dungeon.depth_start === 'number' && Number.isInteger(dungeon.depth_start)
        ? dungeon.depth_start : 1;
    return start + dlevel - 1;
}
export function depth(uz, dungeons = game?.dungeons) {
    return dungeonDepth(uz?.dnum ?? 0, uz?.dlevel ?? 1, dungeons);
}
// C dungeon.c:deepest_lev_reached(). Endgame planes have negative depths
// and do not reduce the deepest dungeon level the hero has visited.
export function deepestLevelReached(noQuest = false, state = game) {
    let deepest = 0;
    for (const [dnum, dungeon] of (state.dungeons || []).entries()) {
        if (!dungeon.dunlev_ureached)
            continue;
        if (noQuest && dnum === state.quest_dnum)
            continue;
        deepest = Math.max(deepest, dungeonDepth(dnum, dungeon.dunlev_ureached, state.dungeons));
    }
    return deepest;
}
// C ref: dungeon.c:ledger_no().  Ledger numbers are save-file bookkeeping
// coordinates: every preceding dungeon contributes all of its local levels.
// They deliberately differ from both a branch-local dlevel and display depth.
export function ledgerNo(uz, state = game) {
    const dungeonIndex = uz?.dnum ?? 0;
    const ledgerStart = state.dungeons.slice(0, dungeonIndex)
        .reduce((total, dungeon) => total + (dungeon.num_dunlevs || 0), 0);
    return ledgerStart + (uz?.dlevel ?? 1);
}
export function maxLedgerNo(state = game) {
    return state.dungeons.reduce((total, dungeon) => total + (dungeon.num_dunlevs || 0), 0);
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
// C hacklib.c:ing_suffix(), including compound verbs such as "put on".
export function ingSuffix(verb) {
    const particle = verb.match(/ (?:on|off|with)$/i)?.[0] || '';
    let stem = particle ? verb.slice(0, -particle.length) : verb;
    if (!/er$/i.test(stem)) {
        if (/[^aeiouwy][aeiouwy][^aeiouwy]$/.test(stem))
            stem += stem.at(-1);
        else if (/ie$/i.test(stem))
            stem = stem.slice(0, -2) + 'y';
        else if (stem.endsWith('e'))
            stem = stem.slice(0, -1);
    }
    return stem + 'ing' + particle;
}
//# sourceMappingURL=hacklib.js.map