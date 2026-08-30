// mkmap.js - cave-style map generation.
// C ref: mkmap.c.

import {
    COLNO, ICE, ICED_MOAT, ICED_POOL, IS_OBSTRUCTED, IS_WALL, LAVAPOOL,
    OROOM, ROOM, ROOMOFFSET, ROWNO, STONE, TREE,
} from './const.js';
import { game } from './gstate.js';
import { dig_corridor, somexy, wallifyMap } from './mklev.js';
import { rn2, rnd } from './rng.js';
export function mkmap({
    lit,
    foreground = ROOM,
    background = STONE,
    smoothed = true,
    joined = true,
    walled = true,
    icedPools = false,
}) {
    const width = COLNO - 2;
    const height = ROWNO - 1;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            loc.typ = background;
            loc.roomno = 0;
            loc.edge = false;
            loc.lit = false;
        }
    }

    const fillCount = Math.trunc((width * height * 2) / 5);
    let changed = 0;
    while (changed < fillCount) {
        const x = rn2(width - 1) + 2;
        const y = rnd(height - 1);
        const loc = game.level.at(x, y);
        if (loc.typ === background) {
            loc.typ = foreground;
            changed++;
        }
    }

    const dirs = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1],
    ];
    const terrainAt = (x, y) => x <= 0 || y < 0
        || x > width || y >= height
        ? background : game.level.at(x, y).typ;
    const neighborCount = (x, y) => dirs.reduce((count, [dx, dy]) =>
        count + Number(terrainAt(x + dx, y + dy) === foreground), 0);

    // pass_one() mutates the level in x-major/y-minor order.
    for (let x = 2; x <= width; x++) {
        for (let y = 1; y < height; y++) {
            const count = neighborCount(x, y);
            if (count <= 2) game.level.at(x, y).typ = background;
            else if (count >= 5) game.level.at(x, y).typ = foreground;
        }
    }

    const applySnapshotPass = rule => {
        const next = Array.from({ length: COLNO }, () =>
            Array(ROWNO).fill(background));
        for (let x = 2; x <= width; x++) {
            for (let y = 1; y < height; y++)
                next[x][y] = rule(neighborCount(x, y), terrainAt(x, y));
        }
        for (let x = 2; x <= width; x++)
            for (let y = 1; y < height; y++)
                game.level.at(x, y).typ = next[x][y];
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
        const seen = new Set();
        const temporaryRooms = [];
        for (let x = 2; x <= width; x++) {
            for (let y = 1; y < height; y++) {
                const key = `${x},${y}`;
                if (seen.has(key)
                    || game.level.at(x, y).typ !== foreground) continue;
                const pending = [[x, y]], cells = [];
                let lx = x, hx = x, ly = y, hy = y;
                while (pending.length) {
                    const [cx, cy] = pending.pop();
                    const cellKey = `${cx},${cy}`;
                    if (cx < 1 || cx > width || cy < 0 || cy >= ROWNO
                        || seen.has(cellKey)
                        || game.level.at(cx, cy).typ !== foreground) continue;
                    seen.add(cellKey);
                    cells.push([cx, cy]);
                    lx = Math.min(lx, cx); hx = Math.max(hx, cx);
                    ly = Math.min(ly, cy); hy = Math.max(hy, cy);
                    for (const [dx, dy] of dirs)
                        pending.push([cx + dx, cy + dy]);
                }
                if (cells.length <= 3) {
                    for (const [cx, cy] of cells) {
                        game.level.at(cx, cy).typ = background;
                        game.level.at(cx, cy).roomno = 0;
                    }
                    continue;
                }
                const roomNumber = temporaryRooms.length + ROOMOFFSET;
                for (const [cx, cy] of cells)
                    game.level.at(cx, cy).roomno = roomNumber;
                temporaryRooms.push({
                    lx, ly, hx, hy,
                    rtype: OROOM, rlit: 0,
                    doorct: 0, fdoor: game.level.doorindex,
                    irregular: true, needjoining: false,
                    nsubrooms: 0, sbrooms: [],
                    roomnoidx: temporaryRooms.length,
                    needfill: 0,
                });
            }
        }
        game.level.rooms = temporaryRooms;
        game.level.nroom = temporaryRooms.length;

        let room = temporaryRooms[0] || null;
        for (let index = 1; index < temporaryRooms.length; index++) {
            const nextRoom = temporaryRooms[index];
            const start = { x: 0, y: 0 }, end = { x: 0, y: 0 };
            if (!somexy(room, start) || !somexy(nextRoom, end)) {
                start.x = room.lx + Math.trunc((room.hx - room.lx) / 2);
                start.y = room.ly + Math.trunc((room.hy - room.ly) / 2);
                end.x = nextRoom.lx
                    + Math.trunc((nextRoom.hx - nextRoom.lx) / 2);
                end.y = nextRoom.ly
                    + Math.trunc((nextRoom.hy - nextRoom.ly) / 2);
            }
            dig_corridor(start, end, null, false, foreground, background);
            if (nextRoom.lx > room.hx
                || ((nextRoom.ly > room.hy || nextRoom.hy < room.ly)
                    && rn2(3)))
                room = nextRoom;
        }
        for (let x = 1; x < COLNO; x++)
            for (let y = 0; y < ROWNO; y++)
                game.level.at(x, y).roomno = 0;
        game.level.rooms = [{ hx: -1 }];
        game.level.nroom = 0;
    }

    if (walled) wallifyMap(1, 0, COLNO - 1, ROWNO - 1);
    if (lit) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = game.level.at(x, y);
                if ((!IS_OBSTRUCTED(foreground) && loc.typ === foreground)
                    || (!IS_OBSTRUCTED(background) && loc.typ === background)
                    || background === TREE && loc.typ === background
                    || walled && IS_WALL(loc.typ)) loc.lit = true;
            }
        }
    }
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            if (loc.typ === LAVAPOOL) loc.lit = true;
            else if (loc.typ === ICE)
                loc.icedpool = icedPools ? ICED_POOL : ICED_MOAT;
        }
    }
    if (walled && joined) {
        game.level.flags.is_maze_lev = false;
        game.level.flags.is_cavernous_lev = true;
    }
}
