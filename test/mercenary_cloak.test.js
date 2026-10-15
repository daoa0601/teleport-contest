import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP } from '../js/const.js';
import { LEATHER_CLOAK, CLOAK_OF_PROTECTION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('ordinary soldier armor includes a leather cloak rather than magical protection', async () => {
    freshObjectRoom();
    initRng(1n);
    const soldier = await createMonsterAt('soldier', 12, 10, MM_NOGRP);
    assert.ok(soldier.minvent.some(object => object.otyp === LEATHER_CLOAK));
    assert.ok(!soldier.minvent.some(object => object.otyp === CLOAK_OF_PROTECTION));
});
//# sourceMappingURL=mercenary_cloak.test.js.map