import assert from 'node:assert/strict';
import test from 'node:test';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { lookAtMonster } from '../js/pager_monsters.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a named cancelled coyote retains its species before its Latin alias', async () => {
    freshObjectRoom();
    const coyote = await createMonsterAt('coyote', 11, 10);
    setMonsterGivenName(coyote, 'Runner');
    coyote.mcan = 1;
    const name = await lookAtMonster(coyote, 11, 10);
    assert.equal(name, 'coyote called Runner - Canis latrans');
});
//# sourceMappingURL=coyote_given_name.test.js.map