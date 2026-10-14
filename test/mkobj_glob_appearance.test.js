import test from 'node:test';
import assert from 'node:assert/strict';
import { mksobj } from '../js/mklev.js';
import { GLOB_OF_BROWN_PUDDING } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a glob keeps its recognizable appearance when random initialization is skipped', async () => {
    freshObjectRoom();
    const glob = await mksobj(GLOB_OF_BROWN_PUDDING, false, false);
    assert.equal(glob.dknown, true);
});
//# sourceMappingURL=mkobj_glob_appearance.test.js.map