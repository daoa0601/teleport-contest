import { requireScreenRow } from './support/screen.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';

function statusText() {
    const row = requireScreenRow(23);
    assert.ok(row);
    return row.map(cell => cell.ch).join('');
}

void test('fatal injury displays zero health while retaining the actual damage', async () => {
    freshObjectRoom({ hero: { uhp: -7, uhpmax: 20 } });
    requirePlayingGame(game);

    await flush_screen(1);

    assert.match(statusText(), /HP:0\(20\)/);
    assert.equal(game.u.uhp, -7);
});

void test('the status line shows the current monster body rather than human health', async () => {
    freshObjectRoom({ hero: {
        uhp: 15, uhpmax: 20, mtimedone: 100, umonnum: 0, mh: 3, mhmax: 8,
    } });
    requirePlayingGame(game);

    await flush_screen(1);

    assert.match(statusText(), /HP:3\(8\)/);
    assert.equal(game.u.uhp, 15);
});

void test('large health and power fit the native four-digit status fields', async () => {
    freshObjectRoom({ hero: {
        uhp: 10020, uhpmax: 10030, uen: 12000, uenmax: 13000,
    } });
    requirePlayingGame(game);

    await flush_screen(1);

    assert.match(statusText(), /HP:9999\(9999\) Pw:9999\(9999\)/);
    assert.equal(game.u.uhp, 10020);
    assert.equal(game.u.uen, 12000);
});
