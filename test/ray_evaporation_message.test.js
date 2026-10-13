import assert from 'node:assert/strict';
import test from 'node:test';
import { MOAT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { freshObjectRoom } from './support/object-room.js';
void test('fire passing back across the same moat square reports evaporation once', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = MOAT;
    await applyRayFloorFeatures('fire', 11, 10);
    await applyRayFloorFeatures('fire', 11, 10);
    assert.equal(game._pending_message, 'Some water evaporates.');
    assert.equal(level.requireAt(11, 10).typ, MOAT);
});
//# sourceMappingURL=ray_evaporation_message.test.js.map