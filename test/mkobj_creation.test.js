import test from 'node:test';
import assert from 'node:assert/strict';
import { mksobj } from '../js/mklev.js';
import { BELL_OF_OPENING } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a newly generated Bell of Opening has three charges', async () => {
    freshObjectRoom();
    const bell = await mksobj(BELL_OF_OPENING, true, false);
    const uninitializedBell = await mksobj(BELL_OF_OPENING, false, false);
    assert.equal(bell.spe, 3);
    assert.equal(uninitializedBell.spe, 0);
});
//# sourceMappingURL=mkobj_creation.test.js.map