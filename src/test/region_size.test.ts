import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { createPoisonGasCloud } from '../js/regions.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an oversized gas cloud stops at the native maximum area', async () => {
    freshObjectRoom({ left: 1, right: 79, top: 0, bottom: 20, heroX: 40, heroY: 10 });
    pushKeys(' '.repeat(12));

    const cloud = await createPoisonGasCloud(game, 40, 10, 160, 0, () => 0, async () => {});

    assert.equal(cloud?.cells.length, 150);
    assert.equal(cloud?.ttl, 4);
});
