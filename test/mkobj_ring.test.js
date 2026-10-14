import test from 'node:test';
import assert from 'node:assert/strict';
import { mksobj } from '../js/mklev.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('generated charged rings cannot remain blessed when a negative bonus curses them', async () => {
    freshObjectRoom({ gameplaySeed: 150 });
    let negativeRings = 0;
    for (let count = 0; count < 500; count++) {
        const ring = await mksobj(OBJECT_NAMES.indexOf('gain strength'), true, false);
        if (ring.spe < 0)
            negativeRings++;
        assert.ok(!(ring.blessed && ring.cursed), `ring ${count} is both blessed and cursed`);
    }
    assert.ok(negativeRings > 0, 'the generated rings include negative bonuses');
});
//# sourceMappingURL=mkobj_ring.test.js.map