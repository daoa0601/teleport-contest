import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { getHungry } from '../js/hunger.js';
import { initRng } from '../js/rng.js';

test('ordinary metabolism is suppressed for a non-eating monster form', () => {
    initRng(4500);
    game.u = {
        uhunger: 900,
        mtimedone: 100,
        umonnum: 159, // brown mold
    };
    game.inventory = [];
    game.uleft = game.uright = game.uamul = null;
    game._helplessReason = null;

    getHungry();

    assert.equal(game.u.uhunger, 900);
});

test('ordinary human metabolism still consumes one nutrition', () => {
    initRng(4500);
    game.u = { uhunger: 900, mtimedone: 0 };
    game.inventory = [];
    game.uleft = game.uright = game.uamul = null;
    game._helplessReason = null;

    getHungry();

    assert.equal(game.u.uhunger, 899);
});
