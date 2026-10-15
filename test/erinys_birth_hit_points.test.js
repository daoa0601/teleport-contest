import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an erinys strengthened to native level fifty uses the fixed special-monster hit points', async () => {
    freshObjectRoom({ hero: { ualign: { type: 0, record: 0, abuse: 43 } }, gameplaySeed: 1n });
    const erinys = await makemonAt(MONSTER_NAME.indexOf('erinys'), 12, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(erinys);
    assert.equal(erinys.mhp, 88);
    assert.equal(erinys.mhpmax, 88);
    assert.equal(erinys.m_lev, 22, 'special-monster levels are approximated from their fixed HP');
});
//# sourceMappingURL=erinys_birth_hit_points.test.js.map