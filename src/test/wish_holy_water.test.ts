import assert from 'node:assert/strict';
import test from 'node:test';

import { POT_WATER } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [adjective, blessed, cursed] of [['holy', true, false], ['unholy', false, true]] as const) {
    void test(`a potion of ${adjective} water wish specifies water and its beatitude`, async () => {
        freshObjectRoom();

        const result = await readObjectName(`potion of ${adjective} water`, { wizardWish: true });

        assert.ok(result && !result.noWish);
        assert.equal(result.object.otyp, POT_WATER);
        assert.equal(result.object.blessed, blessed);
        assert.equal(result.object.cursed, cursed);
    });
}
