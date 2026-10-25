import assert from 'node:assert/strict';
import test from 'node:test';

import { COLNO, LR_UPTELE, PANICLOG, ROWNO, STONE } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { place_lregion } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';

// C mkmaze.c:place_lregion() exhausts 200 random attempts, then a full
// deterministic scan, and only then reports the placement failure. A map
// with no room, corridor, or air terrain gives every location a
// bad_location() verdict, so nothing may be placed and the hero stays put.
void test('a region with no legal location is reported and places nothing', async () => {
    const level = freshPlayableRoom({ hero: {
        uz: { dnum: 0, dlevel: 2 }, ux: 10, uy: 10,
    } });
    for (let x = 0; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const cell = level.at(x, y);
            if (cell) cell.typ = STONE;
        }
    game.nhDisplay = new GameDisplay(null);
    game.storage = memoryStorage();
    const input = resetInputState();
    initRng(11n);

    const generation = place_lregion(10, 5, 40, 15, -1, -1, -1, -1,
        LR_UPTELE, null);
    try {
        assert.equal(await Promise.race([
            input.waitUntilBlocked().then(() => 'waiting'),
            generation.then(() => 'finished'),
        ]), 'waiting', 'the exhaustion diagnostic must wait for acknowledgment');
        const visible = game.nhDisplay.grid.map(row =>
            row.map(cell => cell.ch).join('')).join('\n');
        assert.match(visible, /Couldn't place lregion type 5!/);
        assert.match(game.storage.getItem(PANICLOG) ?? '',
            /Couldn't place lregion/);
    } finally {
        input.beforeRead = () => input.feed(' ');
        input.feed(' ');
        await generation;
    }

    assert.equal(game.u.ux, 10, 'the hero must not move to a refused region');
    assert.equal(game.u.uy, 10);
    assert.equal(level.traps.length, 0);
    assert.equal(game.stairs, null, 'no stairs may be invented');
});
