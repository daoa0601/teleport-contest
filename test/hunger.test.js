import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { getHungry } from '../js/hunger.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';

test('ordinary metabolism is suppressed for a non-eating monster form', () => {
    freshGame({
        hero: {
            uhunger: 900,
            mtimedone: 100,
            umonnum: 159, // brown mold
        },
    });
    initRng(4500);

    getHungry();

    assert.equal(game.u.uhunger, 900);
});

test('ordinary human metabolism still consumes one nutrition', () => {
    freshGame({ hero: { uhunger: 900, mtimedone: 0 } });
    initRng(4500);

    getHungry();

    assert.equal(game.u.uhunger, 899);
});
