import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { SCR_IDENTIFY } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { burnFloorObjectsAt } from '../js/zap.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('burning unidentified floor scrolls describes their labels instead of revealing their type', async () => {
    freshObjectRoom();
    const scrolls = await floorObject(SCR_IDENTIFY, 12, 10, { quan: 20, typeKnown: false });
    initRng(1n);
    const burned = await burnFloorObjectsAt(12, 10, { giveFeedback: true });
    assert.ok(burned > 1);
    assert.equal(scrolls.quan, 20 - burned);
    assert.match(game._pending_message, /^\d+ scrolls labeled .+ burn\.$/);
    assert.ok(!game._knownObjectTypes?.has(SCR_IDENTIFY));
});
//# sourceMappingURL=zap_burn_floor_names.test.js.map