import assert from 'node:assert/strict';
import test from 'node:test';

import { COLNO, PANICLOG, ROWNO } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { u_on_upstairs } from '../js/mklev.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [x, y] of [[-1, 10], [COLNO, 10], [10, -1], [10, ROWNO]] as const) {
    void test(`stair arrival outside the map at ${x},${y} panics before moving the hero`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.stairs = {
            sx: x, sy: y, up: true, isladder: false, u_traversed: false,
            tolev: { dnum: 0, dlevel: 1 }, next: null,
        };
        resetInputState().feed(' '.repeat(20));

        await assert.rejects(u_on_upstairs(), {
            name: 'PanicTermination',
            message: `u_on_newpos: trying to place hero off map <${x},${y}>`,
        });

        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
    });
}

void test('stair arrival in column zero reports an impossible position and continues', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.stairs = {
        sx: 0, sy: 10, up: true, isladder: false, u_traversed: false,
        tolev: { dnum: 0, dlevel: 1 }, next: null,
    };
    resetInputState().feed(' '.repeat(20));

    await u_on_upstairs();

    assert.match(game.storage.getItem(PANICLOG) ?? '',
        /u_on_newpos: trying to place hero off map <0,10>/);
    assert.equal(game.u.ux, 0);
    assert.equal(game.u.uy, 10);
});
