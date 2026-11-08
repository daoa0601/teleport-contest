// selvar.js — map selections used by the Lua level API.
// C refs: src/selvar.c. The nhlsel.c Lua entry points live in lua/nhlsel.ts.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { newsym_force } from './display.js';
import { NethackLuaError } from './lua/errors.js';
import { COLNO, ROWNO, ROOMOFFSET, STONE, CORR, ROOM, HWALL, VWALL, DOOR, AIR, CLOUD, SDOOR, SCORR, FOUNTAIN, THRONE, SINK, MOAT, POOL, LAVAPOOL, LAVAWALL, ICE, WATER, TREE, IRONBARS, CROSSWALL, MAX_TYPE, MATCH_WALL, INVALID_TYPE, MAP_Y_LIM, W_RANDOM, W_NORTH, W_SOUTH, W_EAST, W_WEST, W_ANY, IS_STWALL } from './const.js';
import { isok } from './cmd.js';
import { match_maptyps, random_wdir } from './sp_lev.js';
import { mapCharacterType } from './lua/lifecycle.js';

import type { Room } from './map_types.js';
import { impossible } from './pline.js';

export interface Coordinate { x: number; y: number }
export interface SelectionBounds { lx: number; ly: number; hx: number; hy: number }
export interface Selection {
    wid: number;
    hei: number;
    bounds_dirty: boolean;
    bounds: SelectionBounds;
    map: Int8Array;
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

// C selvar.c:selection_new().
export function selection_new(): Selection {
    return {
        wid: COLNO,
        hei: ROWNO,
        bounds_dirty: false,
        bounds: { lx: COLNO, ly: ROWNO, hx: 0, hy: 0 },
        map: new Int8Array(COLNO * ROWNO).fill(1),
    };
}

// C selvar.c:selection_clear().
export function selection_clear(selection: Selection, value: number) {
    selection.map.fill(1 + value);
    selection.bounds = value
        ? { lx: 0, ly: 0, hx: COLNO - 1, hy: ROWNO - 1 }
        : { lx: COLNO, ly: ROWNO, hx: 0, hy: 0 };
    selection.bounds_dirty = false;
}

// C selvar.c:selection_clone().
export function selection_clone(selection: Selection): Selection {
    return {
        wid: selection.wid,
        hei: selection.hei,
        bounds_dirty: selection.bounds_dirty,
        bounds: { ...selection.bounds },
        map: selection.map.slice(),
    };
}

// C selvar.c:selection_getpoint().
export function selection_getpoint(x: number, y: number, selection: Selection | null | undefined): number {
    if (!selection?.map || x < 0 || y < 0
        || x >= selection.wid || y >= selection.hei) return 0;
    const encoded = selection.map[selection.wid * y + x];
    if (encoded === undefined)
        throw new RangeError('Selection storage is smaller than its dimensions.');
    return encoded - 1;
}

// C selvar.c:selection_setpoint().
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

// C selvar.c:selection_recalc_bounds().
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

// C selvar.c:selection_getbounds().
export function selection_getbounds(selection: Selection): SelectionBounds {
    selection_recalc_bounds(selection);
    return selection.bounds.lx >= selection.wid
        ? { lx: 0, ly: 0, hx: COLNO - 1, hy: ROWNO - 1 }
        : { ...selection.bounds };
}

// C selvar.c:selection_not().
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

// C selvar.c:selection_filter_percent().
export function selection_filter_percent(selection: Selection, percent: number): Selection;
// C selvar.c:selection_filter_percent().
export function selection_filter_percent(selection: null, percent: number): null;
// C selvar.c:selection_filter_percent().
export function selection_filter_percent(selection: Selection | null, percent: number): Selection | null;
// C selvar.c:selection_filter_percent().
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

// C selvar.c:selection_filter_mapchar().
export function selection_filter_mapchar(selection: Selection, typ: number, lit?: number): Selection;
// C selvar.c:selection_filter_mapchar().
export function selection_filter_mapchar(selection: null, typ: number, lit?: number): null;
// C selvar.c:selection_filter_mapchar().
export function selection_filter_mapchar(selection: Selection | null, typ: number, lit?: number): Selection | null;
// C selvar.c:selection_filter_mapchar().
export function selection_filter_mapchar(selection: Selection | null, typ: number, lit = -2): Selection | null {
    if (!selection) return null;
    const result = selection_new();
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++) {
        for (let y = bounds.ly; y <= bounds.hy; y++) {
            const location = game.level?.at?.(x, y);
            if (!selection_getpoint(x, y, selection)
                || !location || !match_maptyps(typ, location.typ)) continue;
            switch (lit) {
            case -1:
                selection_setpoint(x, y, result, rn2(2));
                break;
            case 0:
            case 1:
                if (Number(location.lit) === lit)
                    selection_setpoint(x, y, result, 1);
                break;
            default:
                selection_setpoint(x, y, result, 1);
            }
        }
    }
    return result;
}

// C selvar.c:selection_rndcoord().
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

// C selvar.c:selection_do_grow().
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

// C selvar.c:selection_floodfill().
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

// C selvar.c:selection_do_ellipse().
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

// C selvar.c:line_dist_coord().
function line_dist_coord(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number {
    const px = x2 - x1, py = y2 - y1;
    const squared = px * px + py * py;
    if (!squared) return (x1 - x3) ** 2 + (y1 - y3) ** 2;
    // Native float rounding happens before conversion back to integer coordinates.
    const numerator = Math.fround((x3 - x1) * px + (y3 - y1) * py);
    const projection = Math.fround(numerator / Math.fround(squared));
    const proportion = Math.max(0, Math.min(1, projection));
    const x = Math.trunc(Math.fround(x1 + Math.fround(proportion * px)));
    const y = Math.trunc(Math.fround(y1 + Math.fround(proportion * py)));
    return (x - x3) ** 2 + (y - y3) ** 2;
}

// C selvar.c:selection_do_gradient().
export async function selection_do_gradient(
    selection: Selection, x1: number, y1: number, x2: number, y2: number,
    type: number, minDistance: number, maxDistance: number,
) {
    if (minDistance > maxDistance)
        [minDistance, maxDistance] = [maxDistance, minDistance];
    const minSquared = minDistance * minDistance;
    const maxSquared = maxDistance * maxDistance;
    const spread = Math.max(1, maxSquared - minSquared);
    if (type !== SEL_GRADIENT_RADIAL && type !== SEL_GRADIENT_SQUARE)
        await impossible('Unrecognized gradient type! Defaulting to radial...');
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

// C selvar.c:selection_do_line().
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

// C selvar.c:selection_do_randline().
export function selection_do_randline(
    x1: number, y1: number, x2: number, y2: number,
    roughness: number, recursion: number, selection: Selection,
) {
    roughness = (roughness << 24) >> 24;
    recursion = (recursion << 24) >> 24;
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

// C selvar.c:selection_iterate().
export function selection_iterate(selection: Selection | null, callback: SelectionVisitor) {
    if (!selection) return;
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection))
                callback(x, y);
}

// C selvar.c:selection_is_irregular().
export function selection_is_irregular(selection: Selection): boolean {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && !selection_getpoint(x, y, selection))
                return true;
    return false;
}

// C selvar.c:selection_size_description().
export function selection_size_description(selection: Selection): string {
    const bounds = selection_getbounds(selection);
    const width = bounds.hx - bounds.lx + 1;
    const height = bounds.hy - bounds.ly + 1;
    const shape = selection_is_irregular(selection)
        ? 'irregularly shaped' : width === height ? 'square' : 'rectangular';
    return `${shape} ${width} by ${height}`;
}

// C selvar.c:selection_from_mkroom().
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

// C selvar.c:selection_force_newsyms().
export async function selection_force_newsyms(selection: Selection) {
    for (let x = 1; x < selection.wid; x++)
        for (let y = 0; y < selection.hei; y++)
            if (selection_getpoint(x, y, selection)) await newsym_force(x, y);
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

    bounds() {
        return selection_getbounds(this.selection);
    }

    negate() {
        return new SpecialSelection(selection_not(
            selection_clone(this.selection),
        ));
    }

    // C selvar.c:selection_filter_percent().
    percentageFilter(percent: number) {
        return new SpecialSelection(selection_filter_percent(
            this.selection, percent,
        ));
    }

    filterMapCharacter(character: string, lit = -2) {
        const terrain = mapCharacterType(character);
        if (terrain == null)
            throw new NethackLuaError('Erroneous map char');
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

