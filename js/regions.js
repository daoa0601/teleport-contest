// regions.js — Shared level-region construction.
// C ref: region.c create_region(), make_gas_cloud(), and
// create_gas_cloud_selection().

import { game } from './gstate.js';
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

// This owner is deliberately harmless-only.  Poisonous gas adds blindness,
// coughing, resistance, damage, anger, and death callbacks which must not be
// implied by accepting a nonzero damage field here.
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
