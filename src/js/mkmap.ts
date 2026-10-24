// mkmap.js - cave-style map generation.
// C ref: mkmap.c.

import {
    COLNO, ICE, ICED_MOAT, ICED_POOL, IS_DOOR, IS_OBSTRUCTED, IS_ROOM, IS_WALL,
    LAVAPOOL, MAXNROFROOMS, OROOM, ROOM, ROOMOFFSET, ROWNO, SDOOR, SHARED, STONE, TREE,
} from './const.js';
import { impossible } from './diagnostics.js';
import { game, requireGameLevel } from './gstate.js';
import { depth, isok } from './hacklib.js';
import { dig_corridor, wallifyMap } from './mklev.js';
import { somexy } from './mkroom.js';
import { rn2, rnd } from './rng.js';
import { isRoom } from './map_types.js';
import type { Rectangle } from './map_types.js';

export interface CaveMapOptions {
    lit: boolean | number;
    foreground?: number;
    background?: number;
    smoothed?: boolean;
    joined?: boolean;
    walled?: boolean;
    icedPools?: boolean;
}

export async function mkmap({
    lit: lighting,
    foreground = ROOM,
    background = STONE,
    smoothed = true,
    joined = true,
    walled = true,
    icedPools = false,
}: CaveMapOptions): Promise<void> {
    const lit = litstate_rnd(lighting);
    const level = requireGameLevel();
    const width = COLNO - 2;
    const height = ROWNO - 1;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.requireAt(x, y);
            loc.typ = background;
            loc.roomno = 0;
            loc.lit = false;
        }
    }

    const fillCount = Math.trunc((width * height * 2) / 5);
    let changed = 0;
    while (changed < fillCount) {
        const x = rn2(width - 1) + 2;
        const y = rnd(height - 1);
        const loc = level.requireAt(x, y);
        if (loc.typ === background) {
            loc.typ = foreground;
            changed++;
        }
    }

    const dirs = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1],
    ] as const;
    const terrainAt = (x: number, y: number): number => x <= 0 || y < 0
        || x > width || y >= height
        ? background : level.requireAt(x, y).typ;
    const neighborCount = (x: number, y: number): number => dirs.reduce((count, [dx, dy]) =>
        count + Number(terrainAt(x + dx, y + dy) === foreground), 0);

    // pass_one() mutates the level in x-major/y-minor order.
    for (let x = 2; x <= width; x++) {
        for (let y = 1; y < height; y++) {
            const count = neighborCount(x, y);
            if (count <= 2) level.requireAt(x, y).typ = background;
            else if (count >= 5) level.requireAt(x, y).typ = foreground;
        }
    }

    const applySnapshotPass = (rule: (neighborCount: number, current: number) => number): void => {
        const next = Array.from({ length: COLNO }, () =>
            Array.from({ length: ROWNO }, () => background));
        for (let x = 2; x <= width; x++) {
            const column = next[x];
            if (!column) throw new RangeError(`Missing cave column ${x}`);
            for (let y = 1; y < height; y++)
                column[y] = rule(neighborCount(x, y), terrainAt(x, y));
        }
        for (let x = 2; x <= width; x++)
            for (let y = 1; y < height; y++) {
                const terrain = next[x]?.[y];
                if (terrain === undefined) throw new RangeError(`Missing cave terrain ${x},${y}`);
                level.requireAt(x, y).typ = terrain;
            }
    };
    applySnapshotPass((count, current) => count === 5 ? background : current);
    if (smoothed) {
        applySnapshotPass((count, current) =>
            count < 3 ? background : current);
        applySnapshotPass((count, current) =>
            count < 3 ? background : current);
    }

    if (joined) {
        // join_map() discovers eight-connected foreground components in
        // x-major order. Temporary room numbers let somexy() choose a point
        // from an irregular component using the same bounds as C.
        const temporaryRooms = level.rooms.slice(0, level.nroom).map(entry => {
            if (!isRoom(entry)) throw new Error('Cave joining requires a complete room.');
            return entry;
        });
        discoverRegions: for (let x = 2; x <= width; x++) {
            for (let y = 1; y < height; y++) {
                const loc = level.requireAt(x, y);
                if (loc.typ !== foreground || loc.roomno !== 0) continue;
                const roomNumber = temporaryRooms.length + ROOMOFFSET;
                const region = flood_fill_rm(x, y, roomNumber, false, false);
                if (region.filled <= 3) {
                    for (let cx = region.lx; cx <= region.hx; cx++) {
                        for (let cy = region.ly; cy <= region.hy; cy++) {
                            const cell = level.requireAt(cx, cy);
                            if (cell.roomno !== roomNumber) continue;
                            cell.typ = background;
                            cell.roomno = 0;
                        }
                    }
                    continue;
                }
                temporaryRooms.push({
                    lx: Math.max(1, region.lx), ly: Math.max(1, region.ly),
                    hx: Math.min(COLNO - 2, region.hx), hy: Math.min(ROWNO - 2, region.hy),
                    rtype: OROOM, rlit: 0,
                    doorct: 0, fdoor: level.doorindex,
                    irregular: true, needjoining: false,
                    nsubrooms: 0, sbrooms: [],
                    roomnoidx: temporaryRooms.length,
                    needfill: 0,
                });
                if (temporaryRooms.length >= MAXNROFROOMS * 2) break discoverRegions;
            }
        }
        level.rooms = temporaryRooms;
        level.nroom = temporaryRooms.length;

        let room = temporaryRooms[0] || null;
        for (let index = 1; index < temporaryRooms.length; index++) {
            const nextRoom = temporaryRooms[index];
            if (!room || !nextRoom) throw new Error('Cave connection selected an absent component.');
            const start = { x: 0, y: 0 }, end = { x: 0, y: 0 };
            if (!somexy(room, start) || !somexy(nextRoom, end)) {
                await impossible('No start/end room loc in join_map.');
                start.x = room.lx + Math.trunc((room.hx - room.lx) / 2);
                start.y = room.ly + Math.trunc((room.hy - room.ly) / 2);
                end.x = nextRoom.lx
                    + Math.trunc((nextRoom.hx - nextRoom.lx) / 2);
                end.y = nextRoom.ly
                    + Math.trunc((nextRoom.hy - nextRoom.ly) / 2);
            }
            await dig_corridor(start, end, null, false, foreground, background);
            if (nextRoom.lx > room.hx
                || ((nextRoom.ly > room.hy || nextRoom.hy < room.ly)
                    && rn2(3)))
                room = nextRoom;
        }
        for (let x = 1; x < COLNO; x++)
            for (let y = 0; y < ROWNO; y++)
                level.requireAt(x, y).roomno = 0;
        level.rooms = [{ hx: -1 }];
        level.nroom = 0;
        level.subrooms = [];
        level.nsubroom = 0;
    }

    if (walled) wallifyMap(1, 0, COLNO - 1, ROWNO - 1);
    if (lit) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = level.requireAt(x, y);
                if ((!IS_OBSTRUCTED(foreground) && loc.typ === foreground)
                    || (!IS_OBSTRUCTED(background) && loc.typ === background)
                    || background === TREE && loc.typ === background
                    || walled && IS_WALL(loc.typ)) loc.lit = true;
            }
        }
        for (const room of level.rooms.slice(0, level.nroom)) {
            if (!isRoom(room)) throw new Error('Cave lighting requires a complete room.');
            room.rlit = 1;
        }
    }
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.requireAt(x, y);
            if (loc.typ === LAVAPOOL) loc.lit = true;
            else if (loc.typ === ICE)
                loc.icedpool = icedPools ? ICED_POOL : ICED_MOAT;
        }
    }
    if (walled && joined) {
        level.flags.is_maze_lev = false;
        level.flags.is_cavernous_lev = true;
    }
}

interface FloodFillResult extends Rectangle {
    filled: number;
}

// C ref: mkmap.c flood_fill_rm(). Bounds and the fill count are local to one
// flood instead of shared generation globals.
export function flood_fill_rm(
    sx: number, sy: number, roomNumber: number, lit: boolean, anyroom: boolean,
): FloodFillResult {
    const level = requireGameLevel();
    const result: FloodFillResult = { lx: sx, ly: sy, hx: sx, hy: sy, filled: 0 };

    function fillRun(x: number, y: number): void {
        const foreground = level.requireAt(x, y).typ;
        while (x > 0) {
            const loc = level.requireAt(x, y);
            if (!(anyroom ? IS_ROOM(loc.typ) : loc.typ === foreground)
                || loc.roomno === roomNumber) break;
            x--;
        }
        x++;
        result.lx = Math.min(result.lx, x);
        result.ly = Math.min(result.ly, y);

        let end = x;
        for (; end <= COLNO - 2 && level.requireAt(end, y).typ === foreground; end++) {
            const loc = level.requireAt(end, y);
            loc.roomno = roomNumber;
            loc.lit = lit;
            if (anyroom) markBoundary(end, y, end === x);
            result.filled++;
        }

        for (const adjacentY of [y - 1, y + 1]) {
            if (!isok(x, adjacentY)) continue;
            for (let column = x; column < end; column++) {
                if (level.requireAt(column, adjacentY).typ === foreground) {
                    fillIfUnassigned(column, adjacentY, foreground);
                } else {
                    fillIfUnassigned(column - 1, adjacentY, foreground);
                    fillIfUnassigned(column + 1, adjacentY, foreground);
                }
            }
        }
        result.hx = Math.max(result.hx, end - 1);
        result.hy = Math.max(result.hy, y);
    }

    function fillIfUnassigned(x: number, y: number, foreground: number): void {
        if (!isok(x, y)) return;
        const loc = level.requireAt(x, y);
        if (loc.typ === foreground && loc.roomno !== roomNumber) fillRun(x, y);
    }

    function markBoundary(x: number, y: number, firstInRun: boolean): void {
        for (let wallX = firstInRun ? x - 1 : x; wallX <= x + 1; wallX++) {
            for (let wallY = y - 1; wallY <= y + 1; wallY++) {
                if (!isok(wallX, wallY)) continue;
                const wall = level.requireAt(wallX, wallY);
                if (!(IS_WALL(wall.typ) || IS_DOOR(wall.typ) || wall.typ === SDOOR)) continue;
                wall.edge = true;
                if (lit) wall.lit = true;
                if (wall.roomno === 0) wall.roomno = roomNumber;
                else if (wall.roomno !== roomNumber) wall.roomno = SHARED;
            }
        }
    }

    fillRun(sx, sy);
    return result;
}

export function litstate_rnd(litstate: number | boolean): boolean {
    if (typeof litstate === 'number' && litstate < 0)
        return rnd(1 + Math.abs(depth(game.u.uz))) < 11 && rn2(77) !== 0;
    return !!litstate;
}
