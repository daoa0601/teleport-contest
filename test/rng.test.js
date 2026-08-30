import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import { initRng, rnl } from '../js/rng.js';

function firstLuckOutcome(luck) {
    resetGame();
    game.u = { uluck: luck };
    initRng(1n);
    return rnl(20);
}

test('live rnl biases the same base draw according to current Luck', () => {
    const neutral = firstLuckOutcome(0);
    const fortunate = firstLuckOutcome(5);
    const unfortunate = firstLuckOutcome(-5);

    assert.ok(fortunate < neutral);
    assert.ok(unfortunate > neutral);
    assert.ok(fortunate >= 0);
    assert.ok(unfortunate < 20);
});
