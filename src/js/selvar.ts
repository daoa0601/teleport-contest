// selvar.js — map selections used by the Lua level API.
// C refs: src/selvar.c and src/nhlsel.c.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { newsym } from './display.js';
import {
    COLNO, ROWNO, ROOMOFFSET,
    STONE, CORR, ROOM, HWALL, VWALL, DOOR, AIR, CLOUD, SDOOR, SCORR,
    FOUNTAIN, THRONE, SINK, MOAT, POOL, LAVAPOOL, LAVAWALL, ICE,
    WATER, TREE, IRONBARS, CROSSWALL, MAX_TYPE, MATCH_WALL,
    W_RANDOM, W_NORTH, W_SOUTH, W_EAST, W_WEST, W_ANY,
    IS_STWALL, isok,
} from './const.js';

import type { Room } from './map_types.js';

export interface Coordinate { x: number; y: number }
export interface SelectionBounds { lx: number; ly: number; hx: number; hy: number }
export interface Selection {
    wid: number;
    hei: number;
    bounds_dirty: boolean;
    bounds: SelectionBounds;
    map: Uint8Array;
}
export interface SelectionArea {
    xstart: number;
    ystart: number;
    width: number;
    height: number;
    _room?: Room | null | undefined;
}
export type SelectionFloodMatch = (x: number, y: number) => boolean;
type SelectionVisitor = (x: number, y: number) => void;
type Point = [x: number, y: number];

export const SEL_GRADIENT_RADIAL = 0;
export const SEL_GRADIENT_SQUARE = 1;

export function selection_new(): Selection {
    return {
        wid: COLNO,
        hei: ROWNO,
        bounds_dirty: false,
        bounds: { lx: COLNO, ly: ROWNO, hx: 0, hy: 0 },
        map: new Uint8Array(COLNO * ROWNO).fill(1),
    };
}

export function selection_clear(selection: Selection, value: number) {
    selection.map.fill(1 + value);
    selection.bounds = value
        ? { lx: 0, ly: 0, hx: COLNO - 1, hy: ROWNO - 1 }
        : { lx: COLNO, ly: ROWNO, hx: 0, hy: 0 };
    selection.bounds_dirty = false;
}

export function selection_clone(selection: Selection): Selection {
    return {
        wid: selection.wid,
        hei: selection.hei,
        bounds_dirty: selection.bounds_dirty,
        bounds: { ...selection.bounds },
        map: selection.map.slice(),
    };
}

export function selection_getpoint(x: number, y: number, selection: Selection | null | undefined): number {
    if (!selection?.map || x < 0 || y < 0
        || x >= selection.wid || y >= selection.hei) return 0;
    const encoded = selection.map[selection.wid * y + x];
    if (encoded === undefined)
        throw new RangeError('Selection storage is smaller than its dimensions.');
    return encoded - 1;
}

export function selection_setpoint(x: number, y: number, selection: Selection | null | undefined, value: number) {
    if (!selection?.map || x < 0 || y < 0
        || x >= selection.wid || y >= selection.hei) return;

    const index = selection.wid * y + x;
    if (value && !selection.bounds_dirty) {
        if (selection.bounds.lx > x) selection.bounds.lx = x;
        if (selection.bounds.ly > y) selection.bounds.ly = y;
        if (selection.bounds.hx < x) selection.bounds.hx = x;
        if (selection.bounds.hy < y) selection.bounds.hy = y;
    } else if (selection.map[index] !== 0) {
        // C checks the encoded byte rather than the logical point value.
        selection.bounds_dirty = true;
    }
    selection.map[index] = value + 1;
}

export function selection_recalc_bounds(selection: Selection) {
    if (!selection.bounds_dirty) return;

    const bounds = { lx: -1, ly: -1, hx: -1, hy: -1 };
    for (let x = 0; x < selection.wid && bounds.lx < 0; x++)
        for (let y = 0; y < selection.hei; y++)
            if (selection_getpoint(x, y, selection)) {
                bounds.lx = x;
                break;
            }

    if (bounds.lx >= 0) {
        for (let x = selection.wid - 1; x >= bounds.lx; x--) {
            for (let y = 0; y < selection.hei; y++)
                if (selection_getpoint(x, y, selection)) {
                    bounds.hx = x;
                    break;
                }
            if (bounds.hx >= 0) break;
        }
        for (let y = 0; y < selection.hei; y++) {
            for (let x = bounds.lx; x <= bounds.hx; x++)
                if (selection_getpoint(x, y, selection)) {
                    bounds.ly = y;
                    break;
                }
            if (bounds.ly >= 0) break;
        }
        for (let y = selection.hei - 1; y >= bounds.ly; y--) {
            for (let x = bounds.lx; x <= bounds.hx; x++)
                if (selection_getpoint(x, y, selection)) {
                    bounds.hy = y;
                    break;
                }
            if (bounds.hy >= 0) break;
        }
        selection.bounds = bounds;
    } else {
        selection.bounds = { lx: COLNO, ly: ROWNO, hx: 0, hy: 0 };
    }
    selection.bounds_dirty = false;
}

export function selection_getbounds(selection: Selection): SelectionBounds {
    selection_recalc_bounds(selection);
    return selection.bounds.lx >= selection.wid
        ? { lx: 0, ly: 0, hx: COLNO - 1, hy: ROWNO - 1 }
        : { ...selection.bounds };
}

export function selection_not(selection: Selection): Selection {
    for (let x = 0; x < selection.wid; x++)
        for (let y = 0; y < selection.hei; y++)
            selection_setpoint(
                x, y, selection,
                selection_getpoint(x, y, selection) ? 0 : 1,
            );
    selection_getbounds(selection);
    return selection;
}

export function selection_filter_percent(selection: Selection, percent: number): Selection;
export function selection_filter_percent(selection: null, percent: number): null;
export function selection_filter_percent(selection: Selection | null, percent: number): Selection | null;
export function selection_filter_percent(selection: Selection | null, percent: number): Selection | null {
    if (!selection) return null;
    const result = selection_new();
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (selection_getpoint(x, y, selection)
                && rn2(100) < percent)
                selection_setpoint(x, y, result, 1);
    return result;
}

export function selection_numpoints(selection: Selection): number {
    let count = 0;
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (selection_getpoint(x, y, selection)) count++;
    return count;
}

function selection_binary(left: Selection, right: Selection, operation: (left: number, right: number) => number): Selection {
    selection_recalc_bounds(left);
    selection_recalc_bounds(right);
    const bounds = {
        lx: Math.min(left.bounds.lx, right.bounds.lx),
        ly: Math.min(left.bounds.ly, right.bounds.ly),
        hx: Math.max(left.bounds.hx, right.bounds.hx),
        hy: Math.max(left.bounds.hy, right.bounds.hy),
    };
    const result = selection_new();
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            selection_setpoint(x, y, result, operation(
                selection_getpoint(x, y, left),
                selection_getpoint(x, y, right),
            ));
    return result;
}

export function selection_and(left: Selection, right: Selection) {
    return selection_binary(left, right, (a, b) => a & b);
}

export function selection_or(left: Selection, right: Selection) {
    const result = selection_binary(left, right, (a, b) => a | b);
    selection_recalc_bounds(result);
    return result;
}

export function selection_xor(left: Selection, right: Selection) {
    const result = selection_binary(left, right, (a, b) => a ^ b);
    selection_recalc_bounds(result);
    return result;
}

export function selection_sub(left: Selection, right: Selection) {
    const result = selection_binary(left, right, (a, b) => (a ^ b) & a);
    selection_recalc_bounds(result);
    return result;
}

export function match_maptyps(expected: number, actual: number): boolean {
    if (expected === MATCH_WALL && !IS_STWALL(actual)) return false;
    if (expected < MAX_TYPE && expected !== actual) return false;
    return true;
}

export function selection_filter_mapchar(selection: Selection, typ: number, lit?: number): Selection;
export function selection_filter_mapchar(selection: null, typ: number, lit?: number): null;
export function selection_filter_mapchar(selection: Selection | null, typ: number, lit?: number): Selection | null;
export function selection_filter_mapchar(selection: Selection | null, typ: number, lit = -2): Selection | null {
    if (!selection) return null;
    const result = selection_new();
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++) {
        for (let y = bounds.ly; y <= bounds.hy; y++) {
            const location = game.level?.at?.(x, y);
            if (!selection_getpoint(x, y, selection)
                || !location || !match_maptyps(typ, location.typ)) continue;
            const keep = lit === -1 ? rn2(2)
                : lit === 0 || lit === 1 ? Number(location.lit) === lit
                    : true;
            if (keep)
                selection_setpoint(x, y, result, 1);
        }
    }
    return result;
}

export function selection_rndcoord(selection: Selection, remove = false): Coordinate | null {
    const bounds = selection_getbounds(selection);
    let count = 0;
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (selection_getpoint(x, y, selection)) count++;
    if (!count) return null;

    let choice = rn2(count);
    for (let x = bounds.lx; x <= bounds.hx; x++) {
        for (let y = bounds.ly; y <= bounds.hy; y++) {
            if (!selection_getpoint(x, y, selection)) continue;
            if (choice-- === 0) {
                if (remove) selection_setpoint(x, y, selection, 0);
                return { x, y };
            }
        }
    }
    return null;
}

function random_wdir() {
    switch (rn2(4)) {
    case 0: return W_NORTH;
    case 1: return W_SOUTH;
    case 2: return W_EAST;
    case 3: return W_WEST;
    default: throw new RangeError('Random direction is outside 0 through 3.');
    }
}

export function selection_do_grow(selection: Selection | null, direction: number) {
    if (!selection) return;
    if (direction === W_RANDOM) direction = random_wdir();
    const grown = selection_new();
    const bounds = selection_getbounds(selection);
    for (let x = Math.max(0, bounds.lx - 1);
        x <= Math.min(COLNO - 1, bounds.hx + 1); x++) {
        for (let y = Math.max(0, bounds.ly - 1);
            y <= Math.min(ROWNO - 1, bounds.hy + 1); y++) {
            if (((direction & W_WEST)
                    && selection_getpoint(x + 1, y, selection))
                || ((direction & (W_WEST | W_NORTH))
                        === (W_WEST | W_NORTH)
                    && selection_getpoint(x + 1, y + 1, selection))
                || ((direction & W_NORTH)
                    && selection_getpoint(x, y + 1, selection))
                || ((direction & (W_NORTH | W_EAST))
                        === (W_NORTH | W_EAST)
                    && selection_getpoint(x - 1, y + 1, selection))
                || ((direction & W_EAST)
                    && selection_getpoint(x - 1, y, selection))
                || ((direction & (W_EAST | W_SOUTH))
                        === (W_EAST | W_SOUTH)
                    && selection_getpoint(x - 1, y - 1, selection))
                || ((direction & W_SOUTH)
                    && selection_getpoint(x, y - 1, selection))
                || ((direction & (W_SOUTH | W_WEST))
                        === (W_SOUTH | W_WEST)
                    && selection_getpoint(x + 1, y - 1, selection)))
                selection_setpoint(x, y, grown, 1);
        }
    }

    const grownBounds = selection_getbounds(grown);
    for (let x = grownBounds.lx; x <= grownBounds.hx; x++)
        for (let y = grownBounds.ly; y <= grownBounds.hy; y++)
            if (selection_getpoint(x, y, grown))
                selection_setpoint(x, y, selection, 1);
}

export function selection_floodfill(
    selection: Selection, startX: number, startY: number, diagonals: boolean,
    accepts: SelectionFloodMatch | null,
) {
    if (!accepts) return;
    const seen = selection_new();
    const pending: Point[] = [[startX, startY]];
    while (pending.length) {
        const point = pending.pop();
        if (!point) break;
        const [x, y] = point;
        if (isok(x, y)) {
            selection_setpoint(x, y, selection, 1);
            selection_setpoint(x, y, seen, 1);
        }
        const candidates: Point[] = [
            [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
        ];
        if (diagonals) candidates.push(
            [x + 1, y + 1], [x - 1, y - 1],
            [x - 1, y + 1], [x + 1, y - 1],
        );
        for (const [nextX, nextY] of candidates) {
            if (isok(nextX, nextY) && accepts(nextX, nextY)
                && !selection_getpoint(nextX, nextY, seen)
                && !pending.some(([px, py]) => px === nextX && py === nextY))
                pending.push([nextX, nextY]);
        }
    }
}

export function selection_do_ellipse(
    selection: Selection, centerX: number, centerY: number,
    radiusX: number, radiusY: number, outline: boolean,
) {
    let x = 0, y = radiusY;
    const a2 = radiusX * radiusX, b2 = radiusY * radiusY;
    const crit1 = -(Math.trunc(a2 / 4) + radiusX % 2 + b2);
    const crit2 = -(Math.trunc(b2 / 4) + radiusY % 2 + a2);
    const crit3 = -(Math.trunc(b2 / 4) + radiusY % 2);
    let t = -a2 * y;
    let dxt = 2 * b2 * x, dyt = -2 * a2 * y;
    const d2xt = 2 * b2, d2yt = 2 * a2;
    let width = 1;

    if (outline) {
        while (y >= 0 && x <= radiusX) {
            selection_setpoint(centerX + x, centerY + y, selection, 1);
            if (x !== 0 || y !== 0)
                selection_setpoint(centerX - x, centerY - y, selection, 1);
            if (x !== 0 && y !== 0) {
                selection_setpoint(centerX + x, centerY - y, selection, 1);
                selection_setpoint(centerX - x, centerY + y, selection, 1);
            }
            if (t + b2 * x <= crit1 || t + a2 * y <= crit3) {
                x++;
                dxt += d2xt;
                t += dxt;
            } else if (t - a2 * y > crit2) {
                y--;
                dyt += d2yt;
                t += dyt;
            } else {
                x++;
                dxt += d2xt;
                t += dxt;
                y--;
                dyt += d2yt;
                t += dyt;
            }
        }
        return;
    }

    while (y >= 0 && x <= radiusX) {
        if (t + b2 * x <= crit1 || t + a2 * y <= crit3) {
            x++;
            dxt += d2xt;
            t += dxt;
            width += 2;
        } else {
            for (let i = 0; i < width; i++)
                selection_setpoint(centerX - x + i, centerY - y, selection, 1);
            if (y !== 0)
                for (let i = 0; i < width; i++)
                    selection_setpoint(centerX - x + i, centerY + y, selection, 1);
            if (t - a2 * y <= crit2) {
                x++;
                dxt += d2xt;
                t += dxt;
                width += 2;
            }
            y--;
            dyt += d2yt;
            t += dyt;
        }
    }
}

function line_dist_coord(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number {
    const px = x2 - x1, py = y2 - y1;
    const squared = px * px + py * py;
    if (!squared) return (x1 - x3) ** 2 + (y1 - y3) ** 2;
    // Native float rounding happens before conversion back to integer coordinates.
    const proportion = Math.max(0, Math.min(1, Math.fround(
        Math.fround((x3 - x1) * px + (y3 - y1) * py) / Math.fround(squared))));
    const x = Math.trunc(Math.fround(x1 + Math.fround(proportion * px)));
    const y = Math.trunc(Math.fround(y1 + Math.fround(proportion * py)));
    return (x - x3) ** 2 + (y - y3) ** 2;
}

export function selection_do_gradient(
    selection: Selection, x1: number, y1: number, x2: number, y2: number,
    type: number, minDistance: number, maxDistance: number,
) {
    if (minDistance > maxDistance)
        [minDistance, maxDistance] = [maxDistance, minDistance];
    const minSquared = minDistance * minDistance;
    const maxSquared = maxDistance * maxDistance;
    const spread = Math.max(1, maxSquared - minSquared);
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            let distance;
            if (type === SEL_GRADIENT_SQUARE) {
                const d1 = line_dist_coord(x1, y1, x2, y2, x1, y);
                const d2 = line_dist_coord(x1, y1, x2, y2, x, y1);
                const d3 = line_dist_coord(x1, y1, x2, y2, x2, y);
                const d4 = line_dist_coord(x1, y1, x2, y2, x, y2);
                const d5 = line_dist_coord(x1, y1, x2, y2, x, y);
                distance = Math.min(d5, Math.min(
                    Math.max(d1, d2), Math.max(d3, d4),
                ));
            } else {
                distance = line_dist_coord(x1, y1, x2, y2, x, y);
            }
            if (distance <= minSquared
                || (distance <= maxSquared
                    && distance - minSquared < rn2(spread)))
                selection_setpoint(x, y, selection, 1);
        }
    }
}

export function selection_do_line(x1: number, y1: number, x2: number, y2: number, selection: Selection) {
    const xStep = x1 < x2 ? 1 : -1;
    const yStep = y1 < y2 ? 1 : -1;
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    selection_setpoint(x1, y1, selection, 1);
    if (!dx && !dy) return;

    if (dx > dy) {
        const a = (dy - dx) * 2, b = dy * 2;
        let error = b - dx;
        do {
            if (error >= 0) {
                y1 += yStep;
                error += a;
            } else {
                error += b;
            }
            x1 += xStep;
            selection_setpoint(x1, y1, selection, 1);
        } while (x1 !== x2);
    } else {
        const a = (dx - dy) * 2, b = dx * 2;
        let error = b - dy;
        do {
            if (error >= 0) {
                x1 += xStep;
                error += a;
            } else {
                error += b;
            }
            y1 += yStep;
            selection_setpoint(x1, y1, selection, 1);
        } while (y1 !== y2);
    }
}

export function selection_do_randline(
    x1: number, y1: number, x2: number, y2: number,
    roughness: number, recursion: number, selection: Selection,
) {
    if (recursion < 1 || (x1 === x2 && y1 === y2)) return;
    roughness = Math.min(
        roughness, Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)),
    );
    let midX, midY;
    if (roughness < 2) {
        midX = Math.trunc((x1 + x2) / 2);
        midY = Math.trunc((y1 + y2) / 2);
    } else {
        do {
            midX = Math.trunc((x1 + x2) / 2)
                + rn2(roughness) - Math.trunc(roughness / 2);
            midY = Math.trunc((y1 + y2) / 2)
                + rn2(roughness) - Math.trunc(roughness / 2);
        } while (midX < 0 || midX >= COLNO || midY < 0 || midY >= ROWNO);
    }
    if (!selection_getpoint(midX, midY, selection))
        selection_setpoint(midX, midY, selection, 1);
    roughness = Math.trunc(roughness * 2 / 3);
    selection_do_randline(
        x1, y1, midX, midY, roughness, recursion - 1, selection,
    );
    selection_do_randline(
        midX, midY, x2, y2, roughness, recursion - 1, selection,
    );
    selection_setpoint(x2, y2, selection, 1);
}

export function selection_iterate(selection: Selection | null, callback: SelectionVisitor) {
    if (!selection) return;
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection))
                callback(x, y);
}

export function selection_is_irregular(selection: Selection): boolean {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && !selection_getpoint(x, y, selection))
                return true;
    return false;
}

export function selection_size_description(selection: Selection): string {
    const bounds = selection_getbounds(selection);
    const width = bounds.hx - bounds.lx + 1;
    const height = bounds.hy - bounds.ly + 1;
    const shape = selection_is_irregular(selection)
        ? 'irregularly shaped' : width === height ? 'square' : 'rectangular';
    return `${shape} ${width} by ${height}`;
}

export function selection_from_mkroom(room: Room | null = null): Selection {
    const selection = selection_new();
    if (!room) return selection;
    const roomIndex = room.roomnoidx
        ?? game.level?.rooms?.indexOf(room) ?? -1;
    const roomNumber = roomIndex + ROOMOFFSET;
    for (let y = room.ly; y <= room.hy; y++) {
        for (let x = room.lx; x <= room.hx; x++) {
            const location = game.level?.at?.(x, y);
            if (isok(x, y) && location && !location.edge
                && location.roomno === roomNumber)
                selection_setpoint(x, y, selection, 1);
        }
    }
    return selection;
}

export function selection_force_newsyms(selection: Selection) {
    for (let x = 1; x < selection.wid; x++)
        for (let y = 0; y < selection.hei; y++)
            if (selection_getpoint(x, y, selection)) newsym(x, y);
}

const GROW_DIRECTIONS: Readonly<Record<string, number>> = {
    all: W_ANY,
    random: W_RANDOM,
    north: W_NORTH,
    south: W_SOUTH,
    east: W_EAST,
    west: W_WEST,
};

// The existing special-level port uses this value object at its Lua boundary.
// Its storage and operations now delegate to the complete selvar.c model.
export class SpecialSelection {
    readonly selection: Selection;

    constructor(selection = selection_new()) {
        this.selection = selection;
    }

    has(x: number, y: number) {
        return !!selection_getpoint(x, y, this.selection);
    }

    add(x: number, y: number) {
        selection_setpoint(x, y, this.selection, 1);
        return this;
    }

    remove(x: number, y: number) {
        selection_setpoint(x, y, this.selection, 0);
        return this;
    }

    clone() {
        return new SpecialSelection(selection_clone(this.selection));
    }

    numPoints() {
        return selection_numpoints(this.selection);
    }

    bounds() {
        return selection_getbounds(this.selection);
    }

    negate() {
        return new SpecialSelection(selection_not(
            selection_clone(this.selection),
        ));
    }

    union(other: SpecialSelection) {
        return new SpecialSelection(selection_or(
            this.selection, other.selection,
        ));
    }

    intersect(other: SpecialSelection) {
        return new SpecialSelection(selection_and(
            this.selection, other.selection,
        ));
    }

    xor(other: SpecialSelection) {
        return new SpecialSelection(selection_xor(
            this.selection, other.selection,
        ));
    }

    subtract(other: SpecialSelection) {
        return new SpecialSelection(selection_sub(
            this.selection, other.selection,
        ));
    }

    percentage(percent: number) {
        return new SpecialSelection(selection_filter_percent(
            this.selection, percent,
        ));
    }

    filterMapCharacter(character: string, lit = -2) {
        const terrain = mapCharacterType(character);
        if (terrain == null)
            throw new Error(`unknown map character ${character}`);
        return new SpecialSelection(selection_filter_mapchar(
            this.selection, terrain, lit,
        ));
    }

    randomCoordinate(remove = false) {
        return selection_rndcoord(this.selection, remove);
    }

    floodFill(x: number, y: number, diagonals: boolean, accepts: SelectionFloodMatch) {
        selection_floodfill(this.selection, x, y, diagonals, accepts);
        return this;
    }

    grow(direction = 'all') {
        const result = selection_clone(this.selection);
        selection_do_grow(result, GROW_DIRECTIONS[direction] ?? W_ANY);
        return new SpecialSelection(result);
    }

    forEachXMajor(callback: SelectionVisitor) {
        selection_iterate(this.selection, callback);
    }

    forEachLua(callback: SelectionVisitor) {
        const bounds = selection_getbounds(this.selection);
        for (let y = bounds.ly; y <= bounds.hy; y++)
            for (let x = Math.max(1, bounds.lx); x <= bounds.hx; x++)
                if (selection_getpoint(x, y, this.selection)) callback(x, y);
    }
}

function absolute(context: SelectionArea, x: number, y: number): Coordinate {
    return {
        x: (context._room?.lx ?? context.xstart) + (x & 0xff),
        y: (context._room?.ly ?? context.ystart) + (y & 0xff),
    };
}

export function specialSelectionFillRect(context: SelectionArea, x1: number, y1: number, x2: number, y2: number) {
    const selection = selection_new();
    const start = absolute(context, x1, y1);
    const end = absolute(context, x2, y2);
    if (start.x === end.x) {
        for (let y = start.y; y <= end.y; y++)
            selection_setpoint(start.x, y, selection, 1);
    } else {
        for (let y = start.y; y <= end.y; y++)
            selection_do_line(start.x, y, end.x, y, selection);
    }
    return new SpecialSelection(selection);
}

export function specialSelectionLine(context: SelectionArea, x1: number, y1: number, x2: number, y2: number) {
    const selection = selection_new();
    const start = absolute(context, x1, y1);
    const end = absolute(context, x2, y2);
    selection_do_line(start.x, start.y, end.x, end.y, selection);
    return new SpecialSelection(selection);
}

export function specialSelectionRect(context: SelectionArea, x1: number, y1: number, x2: number, y2: number) {
    const selection = selection_new();
    const start = absolute(context, x1, y1);
    const end = absolute(context, x2, y2);
    selection_do_line(start.x, start.y, end.x, start.y, selection);
    selection_do_line(start.x, start.y, start.x, end.y, selection);
    selection_do_line(end.x, start.y, end.x, end.y, selection);
    selection_do_line(start.x, end.y, end.x, end.y, selection);
    return new SpecialSelection(selection);
}

export function specialSelectionOfTerrain(context: SelectionArea, typ: number) {
    const selection = selection_new();
    for (let x = 0; x < context.width; x++)
        for (let y = 0; y < context.height; y++)
            if (game.level?.at?.(
                context.xstart + x, context.ystart + y,
            )?.typ === typ)
                selection_setpoint(
                    context.xstart + x, context.ystart + y, selection, 1,
                );
    return new SpecialSelection(selection);
}

export function specialSelectionFloodFill(context: SelectionArea, x: number, y: number, diagonals = false) {
    const start = absolute(context, x, y);
    if (!isok(start.x, start.y)) return new SpecialSelection();
    const terrain = game.level?.at?.(start.x, start.y)?.typ;
    return new SpecialSelection().floodFill(
        start.x, start.y, diagonals,
        (nextX, nextY) => game.level?.at?.(nextX, nextY)?.typ === terrain,
    );
}

const MAP_CHAR_TYPES: Readonly<Record<string, number>> = {
    ' ': STONE,
    '#': CORR,
    '.': ROOM,
    '-': HWALL,
    '|': VWALL,
    '+': DOOR,
    A: AIR,
    C: CLOUD,
    S: SDOOR,
    H: SCORR,
    '{': FOUNTAIN,
    '\\': THRONE,
    K: SINK,
    '}': MOAT,
    P: POOL,
    L: LAVAPOOL,
    Z: LAVAWALL,
    I: ICE,
    W: WATER,
    T: TREE,
    F: IRONBARS,
    x: MAX_TYPE,
    '[': MAX_TYPE,
    ']': MAX_TYPE,
    B: CROSSWALL,
    w: MATCH_WALL,
};

export function mapCharacterType(character: string | undefined): number | undefined {
    return character === undefined ? undefined : MAP_CHAR_TYPES[character];
}

export function specialSelectionMatch(fragment: string) {
    const rows = fragment.split('\n');
    const width = Math.max(...rows.map(row => row.length));
    if (!(width % 2) || !(rows.length % 2))
        throw new Error('mapfragment needs to have odd height and width');
    const xRadius = Math.trunc(width / 2);
    const yRadius = Math.trunc(rows.length / 2);
    const center = mapCharacterType(rows[yRadius]?.[xRadius]);
    if (center === undefined || center === MAX_TYPE)
        throw new Error('mapfragment center must be valid terrain');

    const selection = selection_new();
    for (let y = 0; y <= ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            let matched = true;
            for (let offsetX = -xRadius;
                offsetX <= xRadius && matched; offsetX++) {
                for (let offsetY = -yRadius;
                    offsetY <= yRadius; offsetY++) {
                    const expected = MAP_CHAR_TYPES[
                        rows[offsetY + yRadius]?.[offsetX + xRadius] ?? ' '
                    ];
                    const actual = isok(x + offsetX, y + offsetY)
                        ? game.level?.at?.(x + offsetX, y + offsetY)?.typ
                        : STONE;
                    if (expected === undefined
                        || !match_maptyps(expected, actual ?? STONE)) {
                        matched = false;
                        break;
                    }
                }
            }
            selection_setpoint(x, y, selection, matched ? 1 : 0);
        }
    }
    selection_recalc_bounds(selection);
    return new SpecialSelection(selection);
}

export function specialSelectionRandLine(
    x1: number, y1: number, x2: number, y2: number, roughness: number, recursion = 12,
    result = new SpecialSelection(),
) {
    selection_do_randline(
        x1, y1, x2, y2, roughness, recursion, result.selection,
    );
    return result;
}
