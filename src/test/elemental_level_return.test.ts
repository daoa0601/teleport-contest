import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, ROWNO, WATER, AIR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createSpecialLevel } from './support/topology.js';

// getlev() restores bubbles through mv_bubble(..., TRUE), then goto_level()
// moves them once. A restored bubble touching the west edge reverses its
// westward direction before that first drift, so it always moves east.
for (const seed of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]) {
    void test(`returning to a Water plane carries the hero east in a border bubble (seed ${seed})`, async () => {
        const { destination } = freshConnectedLevels();
        requirePlayingGame(game);
        game.water_level = createSpecialLevel({ dnum: 0, dlevel: 2 });
        destination.flags.waterlevel = true;
        destination.flags.hero_memory = false;
        for (let x = 1; x < COLNO; x++)
            for (let y = 0; y < ROWNO; y++) destination.requireAt(x, y).typ = WATER;
        destination.elementalBubbles = [{
            x: 4, y: 10, dx: -1, dy: 0, width: 2, height: 1, rows: [3],
        }];
        destination.requireAt(4, 10).typ = AIR;
        destination.requireAt(5, 10).typ = AIR;
        destination.downTeleportRegion = { lx: 4, ly: 10, hx: 4, hy: 10 };
        initRng(seed);

        await gotoLevel({ dnum: 0, dlevel: 2 });

        const display = game.nhDisplay;
        assert.ok(display);
        const heroRow = display.grid.find(row => row.some(cell => cell.ch === '@'));
        assert.ok(heroRow, 'the returned hero must be visible on the map');
        assert.equal(heroRow.findIndex(cell => cell.ch === '@'), 4,
            'the first drift carries the hero one column east from the arrival square');
    });
}
