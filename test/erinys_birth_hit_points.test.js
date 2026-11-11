import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { makemonAt } from '../js/makemon.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a strengthened erinys remains below the special-monster level threshold', async () => {
    await freshObjectRoom({ hero: { ualign: { type: 0, record: 0, abuse: 43 } }, gameplaySeed: 1n });
    const erinys = await makemonAt(MONSTER_NAME.indexOf('erinys'), 12, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(erinys);
    assert.equal(erinys.m_lev, 48, 'the capped base level adjusts down once on a shallower dungeon floor');
    assert.ok(erinys.mhp > 48 && erinys.mhp <= 48 * 8, 'normal monsters roll d8 hit points per adjusted level');
    assert.equal(erinys.mhpmax, erinys.mhp);
});
//# sourceMappingURL=erinys_birth_hit_points.test.js.map