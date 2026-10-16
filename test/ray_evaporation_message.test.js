import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, MOAT, ROOM } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { runRay } from '../js/ray.js';
import { requireScreenCell } from './support/screen.js';
import { game } from '../js/gstate.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { freshObjectRoom } from './support/object-room.js';
void test('freezing lava keeps an ongoing beam visible across the hero', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = LAVAPOOL;
    let observedBeam = '';
    await runRay({
        direction: 'l', range: 3, beamType: 2, originX: 9, originY: 10,
        onCell: async ({ x, y }) => {
            await applyRayFloorFeatures('cold', x, y);
            if (x === 12) {
                await plineWithContinuation('The blast of frost misses.');
                observedBeam = requireScreenCell(9, 11).ch;
            }
        },
    });
    assert.equal(level.requireAt(11, 10).typ, ROOM);
    assert.equal(observedBeam, '-');
});
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
void test('repeated fire across a moat does not repeat the steam envelope announcement', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = MOAT;
    await applyRayFloorFeatures('fire', 11, 10);
    await applyRayFloorFeatures('fire', 11, 10);
    assert.equal(game._pending_message, 'You are enveloped in a cloud of steam!');
    assert.equal(level.requireAt(11, 10).typ, MOAT);
});
//# sourceMappingURL=ray_evaporation_message.test.js.map