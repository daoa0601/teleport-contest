import assert from 'node:assert/strict';
import test from 'node:test';

import { GRAY_DRAGON_SCALES, YELLOW_DRAGON_SCALES } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';

void test('dragon scales wishes can select different colors despite zero generation probabilities', async () => {
    const selected = new Set<number>();
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ gameplaySeed: seed });

        const result = await readObjectName('dragon scales', { wizardWish: true });

        assert.ok(result && !result.noWish, 'A dragon scales wish should produce a set');
        assert.ok(result.object.otyp >= GRAY_DRAGON_SCALES && result.object.otyp <= YELLOW_DRAGON_SCALES);
        selected.add(result.object.otyp);
    }
    assert.ok(selected.size > 1, 'All colors must participate in a zero-probability subrange');
});
