// Terrain generation shared by ordinary mazes and Lua maze instructions.
// C ref: mkmaze.c:create_maze(), walkfrom(), maze_remove_deadends().
import {
    ACCESSIBLE, COLNO, CORR, HWALL, IS_DOOR, ROOM, ROWNO, STONE, isok,
} from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { rn2, rnd } from './rng.js';
import type { GameState } from './game_state.js';
import type { GameMap } from './game.js';

// mz_move() direction order: north, east, south, west.
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

export function createMaze(corridorWidth = -1, wallThickness = -1,
    removeDeadEnds = false, state: GameState = game): void {
    const level = requireGameLevel(state);
    const nativeXMax = (COLNO - 1) & ~1;
    const nativeYMax = (ROWNO - 1) & ~1;
    const width = corridorWidth === -1 ? rnd(4) : corridorWidth;
    const thickness = wallThickness === -1 ? rnd(4) - width : wallThickness;
    const corridor = Math.max(1, Math.min(5, width));
    const wall = Math.max(1, Math.min(5, thickness));
    const scale = corridor + wall;
    const mazeXMax = 2 * Math.trunc(nativeXMax / scale);
    const mazeYMax = 2 * Math.trunc(nativeYMax / scale);
    const passageType = level.flags.corrmaze ? CORR : ROOM;

    initializeMazeGrid(level, mazeXMax, mazeYMax);
    const x = 3 + 2 * rn2((mazeXMax >> 1) - 1);
    const y = 3 + 2 * rn2((mazeYMax >> 1) - 1);
    carveMazeFrom(x, y, passageType, mazeXMax, mazeYMax, state);
    if (removeDeadEnds)
        openDeadEnds(level, passageType, mazeXMax, mazeYMax);
    if (scale > 2)
        scaleMaze(level, corridor, wall, mazeXMax, mazeYMax,
            nativeXMax, nativeYMax);
}

export function carveMazeFrom(
    x: number, y: number, passageType: number, mazeXMax: number, mazeYMax: number,
    state: GameState = game,
): void {
    const level = requireGameLevel(state);
    const typ = passageType || (level.flags.corrmaze ? CORR : ROOM);
    const start = level.requireAt(x, y);
    if (!IS_DOOR(start.typ)) {
        start.typ = typ;
        start.flags = 0;
    }

    for (;;) {
        const available: Array<readonly [number, number]> = [];
        for (const direction of directions) {
            const [dx, dy] = direction;
            const nx = x + 2 * dx, ny = y + 2 * dy;
            if (nx >= 3 && ny >= 3 && nx <= mazeXMax && ny <= mazeYMax
                && level.requireAt(nx, ny).typ === STONE)
                available.push(direction);
        }
        if (!available.length) return;
        const selected = available[rn2(available.length)];
        if (!selected) throw new RangeError('Maze direction selection is out of range.');
        const [dx, dy] = selected;
        x += dx;
        y += dy;
        level.requireAt(x, y).typ = typ;
        x += dx;
        y += dy;
        carveMazeFrom(x, y, typ, mazeXMax, mazeYMax, state);
        // C resumes at the recursive child's coordinates, which mz_move()
        // already changed; restoring the parent's coordinates changes the maze.
    }
}

function initializeMazeGrid(level: GameMap, mazeXMax: number, mazeYMax: number): void {
    const corrmaze = level.flags.corrmaze;
    const lastX = corrmaze ? mazeXMax - 1 : mazeXMax;
    const lastY = corrmaze ? mazeYMax - 1 : mazeYMax;
    for (let x = 2; x <= lastX; x++) {
        for (let y = 2; y <= lastY; y++) {
            level.requireAt(x, y).typ = corrmaze || ((x % 2) && (y % 2))
                ? STONE : HWALL;
        }
    }
}

function openDeadEnds(level: GameMap, passageType: number, mazeXMax: number, mazeYMax: number): void {
    const inMaze = (x: number, y: number): boolean => x >= 2 && y >= 2
        && x < mazeXMax && y < mazeYMax && isok(x, y);
    for (let x = 2; x < mazeXMax; x++) {
        for (let y = 2; y < mazeYMax; y++) {
            if (!(x % 2) || !(y % 2) || !ACCESSIBLE(level.requireAt(x, y).typ))
                continue;
            const openings: Array<readonly [number, number]> = [];
            let blockedOrEdge = 0;
            for (const [dx, dy] of directions) {
                const nearX = x + dx, nearY = y + dy;
                const farX = x + 2 * dx, farY = y + 2 * dy;
                if (!inMaze(nearX, nearY) || !inMaze(farX, farY)) {
                    blockedOrEdge++;
                    continue;
                }
                if (!ACCESSIBLE(level.requireAt(nearX, nearY).typ)
                    && ACCESSIBLE(level.requireAt(farX, farY).typ)) {
                    openings.push([nearX, nearY]);
                    blockedOrEdge++;
                }
            }
            if (blockedOrEdge >= 3 && openings.length) {
                const opening = openings[rn2(openings.length)];
                if (!opening) throw new RangeError('Maze dead-end opening is out of range.');
                const [openX, openY] = opening;
                level.requireAt(openX, openY).typ = passageType;
            }
        }
    }
}

function scaleMaze(
    level: GameMap, corridor: number, wall: number, mazeXMax: number, mazeYMax: number,
    nativeXMax: number, nativeYMax: number,
): void {
    // Scaling copies terrain only; lighting and other cell fields stay local.
    const saved = Array.from({ length: nativeXMax }, (_, x) =>
        Array.from({ length: nativeYMax }, (_, y) => level.requireAt(x, y).typ));
    let rx = 2, x = 2;
    while (rx < nativeXMax) {
        const mx = x % 2 ? corridor : (x === 2 || x === mazeXMax) ? 1 : wall;
        let ry = 2, y = 2;
        while (ry < nativeYMax) {
            const my = y % 2 ? corridor : (y === 2 || y === mazeYMax) ? 1 : wall;
            for (let dx = 0; dx < mx; dx++) {
                for (let dy = 0; dy < my; dy++) {
                    if (rx + dx >= nativeXMax || ry + dy >= nativeYMax) break;
                    const terrain = saved[x]?.[y];
                    if (terrain === undefined) throw new RangeError(`Missing maze terrain at ${x},${y}`);
                    level.requireAt(rx + dx, ry + dy).typ = terrain;
                }
            }
            ry += my;
            y++;
        }
        rx += mx;
        x++;
    }
}
