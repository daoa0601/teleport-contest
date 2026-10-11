import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { getHungry } from '../js/hunger.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { NOT_HUNGRY } from '../js/const.js';

void test('ordinary metabolism is suppressed for a non-eating monster form', async () => {
    freshObjectRoom({
        hero: {
            uhunger: 900, uhs: NOT_HUNGRY,
            mtimedone: 100,
            umonnum: 159, // brown mold
        },
    });
    requireFixtureGame(game);
    initRng(4500);

    await getHungry();

    assert.equal(game.u.uhunger, 900);
});

void test('ordinary human metabolism still consumes one nutrition', async () => {
    freshObjectRoom({ hero: { uhunger: 900, uhs: NOT_HUNGRY, mtimedone: 0 } });
    requireFixtureGame(game);
    initRng(4500);

    await getHungry();

    assert.equal(game.u.uhunger, 899);
});
