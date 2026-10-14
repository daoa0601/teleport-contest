import assert from 'node:assert/strict';
import test from 'node:test';

import { SPE_NOVEL } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a novel wish recognizes variant title spelling and preserves its title index', async () => {
    freshObjectRoom();

    const result = await readObjectName('novel named Color of Magic');

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, SPE_NOVEL);
    assert.equal(result.object.oextra?.oname, 'The Colour of Magic');
    assert.equal(result.object.novelidx, 0);
});
