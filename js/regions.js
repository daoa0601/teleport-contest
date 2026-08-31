// regions.js — Shared level-region construction.
// C ref: region.c create_region(), make_gas_cloud(), and
// create_gas_cloud_selection().

import { game } from './gstate.js';
import { IS_LAVA, IS_POOL, IS_ROOM, isok } from './const.js';
import { rn2 } from './rng.js';
import { vision_note_blocker_change } from './vision.js';

function uniqueXMajorCells(cells) {
    const points = new Map();
    for (const cell of cells || []) {
        if (!Number.isInteger(cell?.x) || !Number.isInteger(cell?.y)) continue;
        points.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
    }
    return [...points.values()].sort((left, right) =>
        left.x - right.x || left.y - right.y);
}

// Steam clouds do no damage. Poison clouds use different rules and do not
// call this function.
export function createHarmlessGasCloudSelection(
    state, cells, { ttl = -1 } = {},
) {
    if (!state?.level) return null;
    const region = {
        kind: 'gas-cloud',
        visible: true,
        damage: 0,
        ttl,
        cells: uniqueXMajorCells(cells),
    };
    (state.level.regions ||= []).push(region);
    if (state.level === game.level) {
        for (const cell of region.cells)
            vision_note_blocker_change(cell.x, cell.y);
    }
    return region;
}

function validCloudPosition(state, x, y) {
    if (!isok(x, y)) return false;
    const typ = state.level?.at(x, y)?.typ;
    return IS_ROOM(typ) || IS_POOL(typ) || IS_LAVA(typ);
}

export function createSteamCloud(
    state, x, y, cloudSize, random = rn2,
) {
    const cells = [{ x, y }];
    for (let current = 0; current < cells.length; current++) {
        if (cells.length >= cloudSize) break;
        const origin = cells[current];
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 },
            { x: -1, y: 0 }, { x: 1, y: 0 },
        ];
        for (let count = 4; count > 0; count--) {
            const swap = random(count);
            const value = directions[swap];
            directions[swap] = directions[count - 1];
            directions[count - 1] = value;
        }
        let valid = 0;
        for (const direction of directions) {
            const nextX = origin.x + direction.x;
            const nextY = origin.y + direction.y;
            if (!validCloudPosition(state, nextX, nextY)) continue;
            valid++;
            if (valid === 4 && random(2) === 0) continue;
            const newCell = !cells.some(cell =>
                cell.x === nextX && cell.y === nextY);
            if (newCell) cells.push({ x: nextX, y: nextY });
            if (cells.length >= cloudSize) break;
        }
    }
    const ttl = Math.trunc((4 + random(3)) * cloudSize / cells.length);
    return createHarmlessGasCloudSelection(state, cells, { ttl });
}
