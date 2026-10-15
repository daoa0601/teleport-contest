import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an explicitly angry shopkeeper is born hostile', async () => {
    freshObjectRoom();
    const keeper = await createMonsterAt('shopkeeper', 12, 10, MM_ANGRY | NO_MINVENT);
    assert.equal(keeper.mpeaceful, 0);
    assert.equal(keeper.malign, 15, 'an always-peaceful species born hostile has renegade alignment');
});
//# sourceMappingURL=shopkeeper_birth.test.js.map