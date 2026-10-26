import test from 'node:test';
import assert from 'node:assert/strict';

import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pickupLocationProblem } from '../js/pickup_location.js';
import { freshGameplayRoom } from './support/playable-room.js';

void test('a hero stuck above a pool bottom cannot pick up something', () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    requirePlayingGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;

    const problem = pickupLocationProblem({ objects: [], monster: null });

    assert.deepEqual(problem, {
        messages: ["You can't even see the bottom, let alone pick up something."],
        spendsTurn: false,
    });
});
