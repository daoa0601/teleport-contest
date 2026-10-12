// vision.js — Visibility and light.
// C ref: vision.c Algorithm C shadow-casting.

import { monsterHasMapPosition } from './monster_location.js';
import { game } from './gstate.js';
import {
    COLNO, ROWNO, DOOR, SDOOR, POOL, WATER, LAVAWALL, TREE, CLOUD,
    D_CLOSED, D_LOCKED, D_TRAPPED,
    M_AP_OBJECT, M_AP_FURNITURE, M_AP_TYPE, Upolyd,
    SV0, SV1, SV2, SV3, SV4, SV5, SV6, SV7, SVALL,
    IS_WALL,
} from './const.js';
import { newsym } from './display.js';
import { BOULDER } from './object_data.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { objectLightRadius } from './light.js';
import type { GameMap } from './game.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation, Position } from './map_types.js';

export function mimicBlocksLight(monster: Pick<Monster, 'm_ap_type' | 'mappearance'>): boolean {
    if (monster.mappearance === undefined) return false;
    return M_AP_TYPE(monster) === M_AP_OBJECT && monster.mappearance === BOULDER
        || M_AP_TYPE(monster) === M_AP_FURNITURE
            && (monster.mappearance < 12 || [15, 16, 18].includes(monster.mappearance));
}

const COULD_SEE = 0x1;
const IN_SIGHT = 0x2;

// C refs: mondata.h:emits_light(), light.c:do_light_sources().  Every
// currently light-emitting monster has range 1.  Keep temporary illumination
// in the vision transaction rather than mutating levl[].lit: the source owns
// these bits and they move with the monster.
const LIGHT_EMITTING_MONSTERS = new Set([
    30,  // flaming sphere
    31,  // shocking sphere
    111, // fire vortex
    134, // baby gold dragon
    144, // gold dragon
    155, // fire elemental
]);

export function monsterEmitsLight(mnum: number | undefined): boolean {
    if (mnum === undefined) return false;
    return MONSTER_SYMBOL[mnum] === 25 // S_LIGHT
        || LIGHT_EMITTING_MONSTERS.has(mnum);
}

function mobileLightSources(level: GameMap): (Position & { range: number })[] {
    const monsters = [...(level?.monsters || [])];
    const sources = monsters.filter(monster =>
        !monster.dead && monster.mx > 0 && monsterEmitsLight(monster.mnum))
        .map(monster => ({ x: monster.mx, y: monster.my, range: 1 }));
    if (Upolyd(game.u) && monsterEmitsLight(game.u.umonnum)) {
        // C polyself() increases the hero's radius from one to two so
        // the new light reaches beyond the adjacent visible squares.
        sources.push({ x: game.u.ux, y: game.u.uy, range: 2 });
    }
    const addObjectLight = (object: GameObject, x: number, y: number): void => {
        const range = objectLightRadius(object);
        if (range) sources.push({ x, y, range });
    };
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            for (const object of level?.objects?.[x]?.[y] || [])
                addObjectLight(object, x, y);
    for (const object of game.inventory || [])
        addObjectLight(object, game.u.ux, game.u.uy);
    for (const monster of monsters) {
        if (monster.dead || monster.mx < 1) continue;
        for (const object of monster.minvent || monster.inventory || [])
            addObjectLight(object, monster.mx, monster.my);
    }

    sources.push(...(game._transientLights || []));
    return sources;
}

// C light.c:any_light_source(). The monster pass must request a refresh even
// when the hero stays still: a monster can move its own light or a lit object.
export function hasLightSources(): boolean {
    return !!game.level && mobileLightSources(game.level).length > 0;
}

function mobileLightMap(level: GameMap, couldSee: Uint8Array[]): Uint8Array[] {
    const lit = Array.from({ length: ROWNO }, () => new Uint8Array(COLNO));
    for (const source of mobileLightSources(level)) {
        const limits = visionValue(circle_start, source.range);
        for (let y = Math.max(0, source.y - source.range);
            y <= Math.min(ROWNO - 1, source.y + source.range); y++) {
            const offset = visionValue(circle_data, limits + Math.abs(y - source.y));
            for (let x = Math.max(1, source.x - offset);
                x <= Math.min(COLNO - 1, source.x + offset); x++) {
                const atHero = source.x === game.u.ux
                    && source.y === game.u.uy;
                if (atHero ? ((couldSee[y]?.[x] ?? 0) & COULD_SEE)
                    : ((source.x === x && source.y === y)
                        || clearPath(source.x, source.y, x, y))) {
                    visionRow(lit, y)[x] = 1;
                }
            }
        }
    }
    return lit;
}

// C ref: vision.c seenv_matrix
const seenv_matrix = [
    [SV2, SV1,   SV0],
    [SV3, SVALL, SV7],
    [SV4, SV5,   SV6],
] as const;

// C display.c:unset_seenv(). The caller supplies the origin or an adjacent cell.
export function unset_seenv(location: MapLocation, fromX: number, fromY: number, x: number, y: number): void {
    const dx = x - fromX;
    const dy = fromY - y;
    location.seenv &= ~seenVector(dx, dy);
}

// Circle data for range limits (C vision.c:27-70)
const circle_data = [
    /*  0*/ 0,
    /*  1*/ 1, 1,
    /*  3*/ 2, 2, 1,
    /*  6*/ 3, 3, 2, 1,
    /* 10*/ 4, 4, 4, 3, 2,
    /* 15*/ 5, 5, 5, 4, 3, 2,
    /* 21*/ 6, 6, 6, 5, 5, 4, 2,
    /* 28*/ 7, 7, 7, 6, 6, 5, 4, 2,
    /* 36*/ 8, 8, 8, 7, 7, 6, 6, 4, 2,
    /* 45*/ 9, 9, 9, 9, 8, 8, 7, 6, 5, 3,
    /* 55*/ 10, 10, 10, 10, 9, 9, 8, 7, 6, 5, 3,
    /* 66*/ 11, 11, 11, 11, 10, 10, 9, 9, 8, 7, 5, 3,
    /* 78*/ 12, 12, 12, 12, 11, 11, 10, 10, 9, 8, 7, 5, 3,
    /* 91*/ 13, 13, 13, 13, 12, 12, 12, 11, 10, 10, 9, 7, 6, 3,
    /*105*/ 14, 14, 14, 14, 13, 13, 13, 12, 12, 11, 10, 9, 8, 6, 3,
    /*120*/ 15, 15, 15, 15, 14, 14, 14, 13, 13, 12, 11, 10, 9, 8, 6, 3,
    /*136*/ 16,
];
const circle_start = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120];

// Vision state arrays
const viz_clear = Array.from({ length: ROWNO }, () => new Int8Array(COLNO));
const left_ptrs = Array.from({ length: ROWNO }, () => new Int16Array(COLNO));
const right_ptrs = Array.from({ length: ROWNO }, () => new Int16Array(COLNO));

// Double-buffered COULD_SEE bitmap
const cs_buf0 = Array.from({ length: ROWNO }, () => new Uint8Array(COLNO));
const cs_buf1 = Array.from({ length: ROWNO }, () => new Uint8Array(COLNO));
const cs_rmin0 = new Int16Array(ROWNO).fill(COLNO);
const cs_rmax0 = new Int16Array(ROWNO).fill(0);
const cs_rmin1 = new Int16Array(ROWNO).fill(COLNO);
const cs_rmax1 = new Int16Array(ROWNO).fill(0);

type VisionRow = Uint8Array | Int8Array | Int16Array;

type VisionOutput = {
    kind: 'bitmap';
    rows: Uint8Array[];
    left: Int16Array;
    right: Int16Array;
} | {
    kind: 'callback';
    visit: (x: number, y: number) => void;
};

interface VisionScan {
    readonly startColumn: number;
    readonly startRow: number;
    readonly step: -1 | 1;
    readonly output: VisionOutput;
}

// Dense vision tables have fixed native dimensions. A missing entry is a
// broken scan boundary, so report it instead of treating it as a dark cell.
function visionRow<Row extends VisionRow>(rows: readonly Row[], row: number): Row {
    const value = rows[row];
    if (value === undefined)
        throw new RangeError(`Vision row ${row} is outside ${rows.length} rows.`);
    return value;
}

function visionValue(values: ArrayLike<number>, index: number): number {
    const value = values[index];
    if (value === undefined)
        throw new RangeError(`Vision index ${index} is outside ${values.length} entries.`);
    return value;
}

function seenVector(dx: number, dy: number): number {
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
        throw new RangeError(`Seen direction (${dx}, ${dy}) must be adjacent.`);
    return seenv_matrix[dy < 0 ? 0 : dy > 0 ? 2 : 1][dx < 0 ? 0 : dx > 0 ? 2 : 1];
}

function mark_visible_range(output: VisionOutput, row: number, left: number, right: number): void {
    if (left > right) return;
    if (output.kind === 'callback') {
        for (let i = left; i <= right; i++) output.visit(i, row);
        return;
    }
    const rowp = visionRow(output.rows, row);
    for (let i = left; i <= right; i++) rowp[i] = COULD_SEE;
    if (visionValue(output.left, row) > left) output.left[row] = left;
    if (visionValue(output.right, row) < right) output.right[row] = right;
}

// C ref: vision.c does_block().  In addition to terrain, boulders and
// monsters disguised as boulders participate in the shadow-casting dig pass.
function _blocks(level: GameMap, x: number, y: number): boolean {
    const loc = level.at(x, y);
    if (!loc) return true;
    const typ = loc.typ ?? 0;
    // C vision.c:does_block(): rock, trees, water/lava walls, and clouds all
    // participate in the same shadow-casting boundary.  LAVAWALL is above
    // POOL in the terrain enum, so the old numeric shortcut missed it and
    // exposed the tutorial cells beyond the lava curtain.
    if (typ < POOL || typ === TREE || typ === WATER
        || typ === LAVAWALL || typ === CLOUD) return true;
    if (typ === DOOR) {
        const mask = loc.doormask ?? 0;
        if (mask & (D_CLOSED | D_LOCKED | D_TRAPPED)) return true;
    }
    if (level.objects?.[x]?.[y]?.some(object => object.otyp === BOULDER))
        return true;
    const monster = level.monsters?.find(candidate => monsterHasMapPosition(candidate, game) && !candidate.dead
        && candidate.mx === x && candidate.my === y);
    if (monster && (!monster.minvis || game.u.seeInvisible
        || (game.u.seeInvisibleTurns ?? 0) > 0)
        && mimicBlocksLight(monster)) return true;
    // C vision.c:does_block() delegates the last opacity class to
    // region.c:visible_region_at().  Gas and steam clouds are level-owned
    // regions rather than CLOUD terrain, so they must participate in the
    // same Algorithm C blocker table for their complete lifetime.
    if (level.regions?.some(region => region.visible && region.ttl !== -2
        && region.cells?.some(cell => cell.x === x && cell.y === y)))
        return true;
    return false;
}

// C ref: vision_reset() — rebuild viz_clear and left/right ptrs
export function vision_reset(): void {
    const level = game.level;
    if (!level) return;

    for (let y = 0; y < ROWNO; y++) {
        const clearRow = visionRow(viz_clear, y);
        const leftPointers = visionRow(left_ptrs, y);
        const rightPointers = visionRow(right_ptrs, y);
        clearRow.fill(0);
        let dig_left = 0;
        let block = true;
        for (let x = 1; x < COLNO; x++) {
            const cur_block = _blocks(level, x, y);
            if (block !== cur_block) {
                if (block) {
                    for (let i = dig_left; i < x; i++) {
                        leftPointers[i] = dig_left;
                        rightPointers[i] = x - 1;
                    }
                } else {
                    let i = dig_left;
                    if (dig_left) dig_left--;
                    for (; i < x; i++) {
                        leftPointers[i] = dig_left;
                        rightPointers[i] = x;
                        clearRow[i] = 1;
                    }
                }
                dig_left = x;
                block = !block;
            }
        }
        let i = dig_left;
        if (!block && dig_left) dig_left--;
        for (; i < COLNO; i++) {
            leftPointers[i] = dig_left;
            rightPointers[i] = COLNO - 1;
            clearRow[i] = block ? 0 : 1;
        }
    }
    game._viz_rmin = null;
    game._viz_rmax = null;
}

// C ref: vision.c:block_point()/unblock_point().  The source updates its
// blocker dig table immediately but defers the expensive vision_recalc() to
// the ordinary scheduler boundary.  Rebuilding the compact JS table is
// equivalent to the incremental fill/dig operation; retain the old visible
// row bounds so vision_recalc() can repaint cells which become hidden.
export function vision_note_blocker_change(x: number, y: number): void {
    if (!game.level || y < 0 || y >= ROWNO || x < 0 || x >= COLNO) return;
    const wasInVisibilityMap = !!game.viz_array?.[y]?.[x];
    const oldRmin = game._viz_rmin ?? null;
    const oldRmax = game._viz_rmax ?? null;
    vision_reset();
    game._viz_rmin = oldRmin;
    game._viz_rmax = oldRmax;
    if (wasInVisibilityMap) game.vision_full_recalc = 1;
}

// C's level-change transaction starts visibility with no cells inherited
// from the previous level.  Coordinate overlap between two maps must not
// suppress the first newsym() repaint on the destination.
export function vision_reset_new_level(): void {
    for (let y = 0; y < ROWNO; y++) {
        visionRow(cs_buf0, y).fill(0);
        visionRow(cs_buf1, y).fill(0);
    }
    game.viz_array = cs_buf0;
    game.active_buf = 0;
    game._viz_rmin = null;
    game._viz_rmax = null;
    vision_reset();
}

// Bresenham quadrant path functions (C ref: vision.c q1-q4_path)
function q1_path(srow: number, scol: number, y2: number, x2: number): 0 | 1 {
    let x = scol, y = srow;
    const dx = x2 - x, dy = y - y2;
    const dxs = dx << 1, dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x++; err -= dys; }
            y--;
            err += dxs;
            if (!viz_clear[y]?.[x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y--; err -= dxs; }
            x++;
            err += dys;
            if (!viz_clear[y]?.[x]) return 0;
        }
    }
    return 1;
}

function q2_path(srow: number, scol: number, y2: number, x2: number): 0 | 1 {
    let x = scol, y = srow;
    const dx = x - x2, dy = y - y2;
    const dxs = dx << 1, dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x--; err -= dys; }
            y--;
            err += dxs;
            if (!viz_clear[y]?.[x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y--; err -= dxs; }
            x--;
            err += dys;
            if (!viz_clear[y]?.[x]) return 0;
        }
    }
    return 1;
}

function q3_path(srow: number, scol: number, y2: number, x2: number): 0 | 1 {
    let x = scol, y = srow;
    const dx = x - x2, dy = y2 - y;
    const dxs = dx << 1, dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x--; err -= dys; }
            y++;
            err += dxs;
            if (!viz_clear[y]?.[x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y++; err -= dxs; }
            x--;
            err += dys;
            if (!viz_clear[y]?.[x]) return 0;
        }
    }
    return 1;
}

function q4_path(srow: number, scol: number, y2: number, x2: number): 0 | 1 {
    let x = scol, y = srow;
    const dx = x2 - x, dy = y2 - y;
    const dxs = dx << 1, dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x++; err -= dys; }
            y++;
            err += dxs;
            if (!viz_clear[y]?.[x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y++; err -= dxs; }
            x++;
            err += dys;
            if (!viz_clear[y]?.[x]) return 0;
        }
    }
    return 1;
}

// C ref: vision.c right_side()
function right_side(scan: VisionScan, row: number, left: number, right_mark: number, limitsIdx: number): void {
    const nrow = row + scan.step;
    const deeper = nrow >= 0 && nrow < ROWNO
        && (limitsIdx < 0 || visionValue(circle_data, limitsIdx) >= visionValue(circle_data, limitsIdx + 1));
    const lim_max = limitsIdx >= 0
        ? Math.min(COLNO - 1, scan.startColumn + visionValue(circle_data, limitsIdx))
        : COLNO - 1;
    if (right_mark > lim_max) right_mark = lim_max;
    const nextLimIdx = limitsIdx >= 0 ? limitsIdx + 1 : -1;

    while (left <= right_mark) {
        let right_edge = visionValue(visionRow(right_ptrs, row), left);
        if (right_edge > lim_max) right_edge = lim_max;

        if (!viz_clear[row]?.[left]) {
            if (right_edge > right_mark) {
                right_edge = (row - scan.step >= 0 && row - scan.step < ROWNO && viz_clear[row - scan.step]?.[right_mark])
                    ? right_mark + 1 : right_mark;
            }
            mark_visible_range(scan.output, row, left, right_edge);
            left = right_edge + 1;
            continue;
        }

        if (left !== scan.startColumn) {
            for (; left <= right_edge; left++) {
                const result = scan.step < 0
                    ? q1_path(scan.startRow, scan.startColumn, row, left)
                    : q4_path(scan.startRow, scan.startColumn, row, left);
                if (result) break;
            }
            if (left > lim_max) return;
            if (left === lim_max) {
                mark_visible_range(scan.output, row, lim_max, lim_max);
                return;
            }
            if (left >= right_edge) { left = right_edge; continue; }
        }

        let right;
        if (right_mark < right_edge) {
            for (right = right_mark; right <= right_edge; right++) {
                const result = scan.step < 0
                    ? q1_path(scan.startRow, scan.startColumn, row, right)
                    : q4_path(scan.startRow, scan.startColumn, row, right);
                if (!result) break;
            }
            right--;
        } else {
            right = right_edge;
        }

        if (left <= right) {
            if (left === right && left === scan.startColumn && scan.startColumn < COLNO - 1
                && !viz_clear[row]?.[scan.startColumn + 1]) {
                right = scan.startColumn + 1;
            }
            if (right > lim_max) right = lim_max;
            mark_visible_range(scan.output, row, left, right);
            if (deeper) right_side(scan, nrow, left, right, nextLimIdx);
            left = right + 1;
        }
    }
}

// C ref: vision.c left_side()
function left_side(scan: VisionScan, row: number, left_mark: number, right: number, limitsIdx: number): void {
    const nrow = row + scan.step;
    const deeper = nrow >= 0 && nrow < ROWNO
        && (limitsIdx < 0 || visionValue(circle_data, limitsIdx) >= visionValue(circle_data, limitsIdx + 1));
    const lim_min = limitsIdx >= 0
        ? Math.max(0, scan.startColumn - visionValue(circle_data, limitsIdx))
        : 0;
    if (left_mark < lim_min) left_mark = lim_min;
    const nextLimIdx = limitsIdx >= 0 ? limitsIdx + 1 : -1;

    while (right >= left_mark) {
        let left_edge = visionValue(visionRow(left_ptrs, row), right);
        if (left_edge < lim_min) left_edge = lim_min;

        if (!viz_clear[row]?.[right]) {
            if (left_edge < left_mark) {
                left_edge = (row - scan.step >= 0 && row - scan.step < ROWNO && viz_clear[row - scan.step]?.[left_mark])
                    ? left_mark - 1 : left_mark;
            }
            mark_visible_range(scan.output, row, left_edge, right);
            right = left_edge - 1;
            continue;
        }

        if (right !== scan.startColumn) {
            for (; right >= left_edge; right--) {
                const result = scan.step < 0
                    ? q2_path(scan.startRow, scan.startColumn, row, right)
                    : q3_path(scan.startRow, scan.startColumn, row, right);
                if (result) break;
            }
            if (right < lim_min) return;
            if (right === lim_min) {
                mark_visible_range(scan.output, row, lim_min, lim_min);
                return;
            }
            if (right <= left_edge) { right = left_edge; continue; }
        }

        let left;
        if (left_mark > left_edge) {
            for (left = left_mark; left >= left_edge; left--) {
                const result = scan.step < 0
                    ? q2_path(scan.startRow, scan.startColumn, row, left)
                    : q3_path(scan.startRow, scan.startColumn, row, left);
                if (!result) break;
            }
            left++;
        } else {
            left = left_edge;
        }

        if (left <= right) {
            if (left === right && right === scan.startColumn && scan.startColumn > 0
                && !viz_clear[row]?.[scan.startColumn - 1]) {
                left = scan.startColumn - 1;
            }
            if (left < lim_min) left = lim_min;
            mark_visible_range(scan.output, row, left, right);
            if (deeper) left_side(scan, nrow, left, right, nextLimIdx);
            right = left - 1;
        }
    }
}

// C ref: vision.c view_from()
function view_from(srow: number, scol: number, output: VisionOutput, range = 0): void {
    const clearRow = visionRow(viz_clear, srow);
    const leftPointers = visionRow(left_ptrs, srow);
    const rightPointers = visionRow(right_ptrs, srow);
    let left: number;
    let right: number;
    if (clearRow[scol]) {
        left = visionValue(leftPointers, scol);
        right = visionValue(rightPointers, scol);
    } else {
        left = !scol ? 0
            : (clearRow[scol - 1] ? visionValue(leftPointers, scol - 1) : scol - 1);
        right = scol === COLNO - 1 ? COLNO - 1
            : (clearRow[scol + 1] ? visionValue(rightPointers, scol + 1) : scol + 1);
    }

    let limitsIdx = -1;
    if (range) {
        if (left < scol - range) left = scol - range;
        if (right > scol + range) right = scol + range;
        limitsIdx = visionValue(circle_start, range) + 1;
    }

    mark_visible_range(output, srow, left, right);

    const nrow_down = srow + 1;
    if (nrow_down < ROWNO) {
        const scan: VisionScan = { startColumn: scol, startRow: srow, step: 1, output };
        if (scol < COLNO - 1) right_side(scan, nrow_down, scol, right, limitsIdx);
        if (scol) left_side(scan, nrow_down, left, scol, limitsIdx);
    }
    const nrow_up = srow - 1;
    if (nrow_up >= 0) {
        const scan: VisionScan = { startColumn: scol, startRow: srow, step: -1, output };
        if (scol < COLNO - 1) right_side(scan, nrow_up, scol, right, limitsIdx);
        if (scol) left_side(scan, nrow_up, left, scol, limitsIdx);
    }
}

// C ref: vision.c do_clear_area() when the origin is not the hero. Return
// cells exposed by the same shadow-casting engine so non-rendering consumers
// can reason about visibility from another actor's position.
export function visibleCellsFrom(scol: number, srow: number, range: number): Position[] {
    if (!game.level || scol < 1 || scol >= COLNO
        || srow < 0 || srow >= ROWNO) return [];
    const cells: Position[] = [];
    view_from(srow, scol, {
        kind: 'callback',
        visit: (x, y) => { cells.push({ x, y }); },
    }, range);
    return cells;
}

// C ref: vision.c do_clear_area().  When the effect is centered on the hero,
// C deliberately avoids view_from()'s recursive callback order: it refreshes
// the shared vision matrix and scans the radius-clipped circle row-major,
// retaining only couldsee() cells.  RNG-using callbacks such as fountain.c's
// gush() make that otherwise-internal ordering observable.
export function clearAreaCells(scol: number, srow: number, range: number, { ignoreBlockers = false } = {}): Position[] {
    if (!game.level || range < 1 || range >= circle_start.length
        || scol < 1 || scol >= COLNO || srow < 0 || srow >= ROWNO) {
        return [];
    }
    if (scol !== game.u?.ux || srow !== game.u?.uy)
        return visibleCellsFrom(scol, srow, range);

    if (game.vision_full_recalc) vision_recalc(0);
    const cells = [];
    const limitsStart = visionValue(circle_start, range);
    const minY = Math.max(0, srow - range);
    const maxY = Math.min(ROWNO - 1, srow + range);
    for (let y = minY; y <= maxY; y++) {
        const offset = visionValue(circle_data, limitsStart + Math.abs(y - srow));
        const minX = Math.max(1, scol - offset);
        const maxX = Math.min(COLNO - 1, scol + offset);
        for (let x = minX; x <= maxX; x++) {
            if (ignoreBlockers || couldsee(x, y)) cells.push({ x, y });
        }
    }
    return cells;
}

// C ref: vision.c clear_path() (Algorithm A).  Monster sight and light-source
// projection use an integer Bresenham line, checking only intermediate cells;
// this is intentionally distinct from Algorithm C hero shadow casting.
export function clearPath(col1: number, row1: number, col2: number, row2: number): boolean {
    if (col1 === col2 && row1 === row2) return true;
    let x = col1;
    let y = row1;
    const dx = Math.abs(col2 - col1);
    const dy = Math.abs(row2 - row1);
    const xstep = col2 >= col1 ? 1 : -1;
    const ystep = row2 >= row1 ? 1 : -1;
    const dxs = dx << 1;
    const dys = dy << 1;

    if (dy > dx) {
        let error = dxs - dy;
        for (let remaining = dy - 1; remaining > 0; remaining--) {
            if (error >= 0) {
                x += xstep;
                error -= dys;
            }
            y += ystep;
            error += dxs;
            if (!viz_clear[y]?.[x]) return false;
        }
    } else {
        let error = dys - dx;
        for (let remaining = dx - 1; remaining > 0; remaining--) {
            if (error >= 0) {
                y += ystep;
                error -= dxs;
            }
            x += xstep;
            error += dys;
            if (!viz_clear[y]?.[x]) return false;
        }
    }
    return true;
}

// C ref: vision_recalc(control)
export function vision_recalc(control = 0): void {
    const u = game.u;
    if (!u || !game.level) return;
    game.vision_full_recalc = 0;
    if (game.in_mklev || game.program_state.in_getlev) return;

    // Swap to unused buffer
    const next = game.active_buf === 0 ? cs_buf1 : cs_buf0;
    const next_rmin = game.active_buf === 0 ? cs_rmin1 : cs_rmin0;
    const next_rmax = game.active_buf === 0 ? cs_rmax1 : cs_rmax0;

    for (let y = 0; y < ROWNO; y++) {
        visionRow(next, y).fill(0);
        next_rmin[y] = COLNO;
        next_rmax[y] = 0;
    }

    // C still builds COULD_SEE while the hero is blind.  That bitmap is the
    // geometric line-of-sight used by monster movement; only IN_SIGHT is
    // suppressed.  Clearing both here makes distant monsters incorrectly
    // become shortsighted/aimless on the same turn blindness starts.
    const visionDisabled = control === 2 || u.uswallow;
    const blindRecalc = !visionDisabled && game.blind;
    if (!visionDisabled) {
        view_from(u.uy, u.ux, { kind: 'bitmap', rows: next, left: next_rmin, right: next_rmax });
    }

    // Compute IN_SIGHT from COULD_SEE + lighting
    const level = game.level;
    const temporaryLight = mobileLightMap(level, next);
    const isLitAt = (x: number, y: number): boolean => !!level?.at(x, y)?.lit
        || !!temporaryLight[y]?.[x];
    const ux = u.ux, uy = u.uy;

    if (!blindRecalc) {
        for (let row = 0; row < ROWNO; row++) {
            const dy = Math.sign(uy - row);
            const nextRow = visionRow(next, row);
            const right = visionValue(next_rmax, row);
            for (let col = visionValue(next_rmin, row); col <= right; col++) {
                const bits = visionValue(nextRow, col);
                if (!(bits & COULD_SEE)) continue;
                const loc = level?.at(col, row);
                if (!loc) continue;

                // Night vision: adjacent cells always IN_SIGHT
                if (Math.abs(col - ux) <= 1 && Math.abs(row - uy) <= 1) {
                    nextRow[col] = bits | IN_SIGHT;
                    continue;
                }

                // Lit cells
                if (isLitAt(col, row)) {
                    if ((loc.typ === DOOR || loc.typ === SDOOR
                            || IS_WALL(loc.typ))
                        && !viz_clear[row]?.[col]) {
                        // Walls/doors: only IN_SIGHT if the adjacent cell
                        // toward the hero is lit.
                        const dx = Math.sign(ux - col);
                        const fx = col + dx, fy = row + dy;
                        const flev = level?.at(fx, fy);
                        if (flev && isLitAt(fx, fy)) {
                            nextRow[col] = bits | IN_SIGHT;
                        }
                    } else {
                        nextRow[col] = bits | IN_SIGHT;
                    }
                }
            }
        }
    }

    // Swap viz_array and run newsym updates
    const old_array = game.viz_array;
    game.viz_array = next;
    game.active_buf = game.active_buf === 0 ? 1 : 0;

    const old_rmin = game._viz_rmin;
    const old_rmax = game._viz_rmax;
    // Swallowing and vision_recalc(2) install an empty sight buffer but still
    // run this update loop against the old one. That departure/engulf repaint is
    // observable under Hallucination because newsym() consumes display RNG.
    if (old_array && game.level && blindRecalc) {
        // C's blind branch installs the fresh COULD_SEE map, then redraws
        // only cells which were previously IN_SIGHT.  Do not send the new
        // geometric visibility through the normal lit-cell update below.
        for (let row = 0; row < ROWNO; row++) {
            const old_row = visionRow(old_array, row);
            const start = old_rmin
                ? Math.min(visionValue(old_rmin, row), visionValue(next_rmin, row))
                : visionValue(next_rmin, row);
            const stop = old_rmax
                ? Math.max(visionValue(old_rmax, row), visionValue(next_rmax, row))
                : visionValue(next_rmax, row);
            if (start > stop) continue;
            for (let col = start; col <= stop; col++) {
                if (visionValue(old_row, col) & IN_SIGHT) newsym(col, row);
            }
        }
    } else if (old_array && game.level) {
        for (let row = 0; row < ROWNO; row++) {
            const old_row = visionRow(old_array, row);
            const next_row = visionRow(next, row);
            const start = old_rmin
                ? Math.min(visionValue(old_rmin, row), visionValue(next_rmin, row))
                : visionValue(next_rmin, row);
            const stop = old_rmax
                ? Math.max(visionValue(old_rmax, row), visionValue(next_rmax, row))
                : visionValue(next_rmax, row);
            if (start > stop) continue;
            const dy = Math.sign(uy - row);
            for (let col = start; col <= stop; col++) {
                const nv = visionValue(next_row, col);
                const ov = visionValue(old_row, col);
                const loc = game.level.at(col, row);
                if (!loc) continue;

                if (nv & IN_SIGHT) {
                    const oldseenv = loc.seenv || 0;
                    const sv = seenVector(Math.sign(col - ux), dy);
                    loc.seenv = (loc.seenv || 0) | sv;
                    if (!(ov & IN_SIGHT) || oldseenv !== loc.seenv) {
                        newsym(col, row);
                    }
                } else if ((nv & COULD_SEE) && isLitAt(col, row)) {
                    if ((IS_WALL(loc.typ) || loc.typ === DOOR || loc.typ === SDOOR)
                        && !viz_clear[row]?.[col]) {
                        const dx = Math.sign(ux - col);
                        const ax = col + dx, ay = row + dy;
                        const adjLoc = game.level.at(ax, ay);
                        if (adjLoc && isLitAt(ax, ay)) {
                            next_row[col] = nv | IN_SIGHT;
                            const oldseenv = loc.seenv || 0;
                            const sv = seenVector(Math.sign(col - ux), dy);
                            loc.seenv = (loc.seenv || 0) | sv;
                            if (!(ov & IN_SIGHT) || oldseenv !== loc.seenv)
                                newsym(col, row);
                        }
                    } else {
                        next_row[col] = nv | IN_SIGHT;
                        const oldseenv = loc.seenv || 0;
                        const sv = seenVector(Math.sign(col - ux), dy);
                        loc.seenv = (loc.seenv || 0) | sv;
                        if (!(ov & IN_SIGHT) || oldseenv !== loc.seenv)
                            newsym(col, row);
                    }
                } else if ((nv & COULD_SEE) && loc.waslit) {
                    loc.waslit = false;
                    newsym(col, row);
                } else {
                    if ((ov & IN_SIGHT)
                        || ((nv & COULD_SEE) ^ (ov & COULD_SEE))) {
                        newsym(col, row);
                    }
                }
            }
        }
    }
    if (ux > 0) newsym(ux, uy);

    game._viz_rmin = next_rmin;
    game._viz_rmax = next_rmax;
}

// C ref: cansee(x, y)
export function cansee(x: number, y: number): boolean {
    if (y < 0 || y >= ROWNO || x < 0 || x >= COLNO) return false;
    return !!((game.viz_array?.[y]?.[x] ?? 0) & IN_SIGHT);
}

// C ref: couldsee(x, y)
export function couldsee(x: number, y: number): boolean {
    if (y < 0 || y >= ROWNO || x < 0 || x >= COLNO) return false;
    return !!((game.viz_array?.[y]?.[x] ?? 0) & COULD_SEE);
}

export function init_vision_globals(): void {
    game.viz_array = cs_buf0;
    game.active_buf = 0;
}
