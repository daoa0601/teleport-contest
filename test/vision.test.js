import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { visibleCellsFrom, vision_reset } from '../js/vision.js';
import { freshGame } from './support/game-state.js';

test('off-hero visibility preserves C callback traversal order', () => {
    freshGame({ level: {
        at: () => ({ typ: 25 }), // ROOM
    } });
    vision_reset();

    const cells = visibleCellsFrom(40, 10, 9);
    const startRowEnd = cells.findLastIndex(cell => cell.y === 10);
    const firstLowerRow = cells.findIndex(cell => cell.y > 10);
    const firstUpperRow = cells.findIndex(cell => cell.y < 10);

    assert.ok(startRowEnd >= 0);
    assert.equal(firstLowerRow, startRowEnd + 1);
    assert.ok(firstUpperRow > firstLowerRow,
        'view_from must visit downward quadrants before upward quadrants');
});
