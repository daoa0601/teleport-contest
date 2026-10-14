import assert from 'node:assert/strict';
import test from 'node:test';
import { breakFloorObject } from '../js/object_breakage.js';
import { POT_HEALING } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a visible potion shatter describes its known blessing', async () => {
    freshObjectRoom();
    const potion = await floorObject(POT_HEALING, 11, 10, { blessed: true, bknown: true, dknown: true });
    const messages = [];
    await breakFloorObject(potion, { random: () => 99, publish: text => { messages.push(text); } });
    assert.match(messages[0] ?? '', /^A blessed .*potion(?: of [^!]+)? shatters!$/);
});
//# sourceMappingURL=pool_breakage_name.test.js.map