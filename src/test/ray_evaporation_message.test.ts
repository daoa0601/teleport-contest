import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, MOAT, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { freshObjectRoom } from './support/object-room.js';

void test('cold crossing adjacent lava squares announces cooling once', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = LAVAPOOL;
    level.requireAt(12, 10).typ = LAVAPOOL;

    await applyRayFloorFeatures('cold', 11, 10);
    await applyRayFloorFeatures('cold', 12, 10);

    assert.equal(level.requireAt(11, 10).typ, ROOM);
    assert.equal(level.requireAt(12, 10).typ, ROOM);
    assert.equal(game._pending_message, 'The lava cools and solidifies.');
});

void test('fire passing back across the same moat square reports evaporation once', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = MOAT;

    await applyRayFloorFeatures('fire', 11, 10);
    await applyRayFloorFeatures('fire', 11, 10);

    assert.equal(game._pending_message, 'Some water evaporates.');
    assert.equal(level.requireAt(11, 10).typ, MOAT);
});
