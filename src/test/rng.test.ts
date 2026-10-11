import test from 'node:test';
import assert from 'node:assert/strict';

import { initRng, rnl } from '../js/rng.js';
import { LUCKSTONE } from '../js/object_data.js';
import { freshGame } from './support/game-state.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function firstLuckOutcome(luck: number) {
    freshGame({ hero: { uluck: luck } });
    initRng(1n);
    return rnl(20);
}

void test('live rnl biases the same base draw according to current Luck', () => {
    const neutral = firstLuckOutcome(0);
    const fortunate = firstLuckOutcome(5);
    const unfortunate = firstLuckOutcome(-5);

    assert.ok(fortunate < neutral);
    assert.ok(unfortunate > neutral);
    assert.ok(fortunate >= 0);
    assert.ok(unfortunate < 20);
});

void test('a carried luckstone improves luck-sensitive decisions', async () => {
    freshObjectRoom({ hero: { uluck: 0 } });
    initRng(1n);
    const withoutStone = rnl(20);

    await addInventoryObject(LUCKSTONE, { blessed: true });
    initRng(1n);
    const withStone = rnl(20);

    assert.ok(withStone < withoutStone);
});
