import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOMSG } from '../js/const.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { RIN_INVISIBILITY } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a Nazgul is born carrying a cursed unenchanted ring of invisibility', async () => {
    freshObjectRoom({ gameplaySeed: 1 });
    const nazgul = await makemonAt(MONSTER_NAME.indexOf('Nazgul'), 11, 10, MM_NOMSG);
    assert.ok(nazgul);
    const ring = nazgul.minvent.find(object => object.otyp === RIN_INVISIBILITY);
    assert.ok(ring, 'Nazgul birth equipment should include its invisibility ring');
    assert.equal(ring.cursed, true);
    assert.equal(ring.blessed, false);
    assert.equal(ring.spe, 0);
    assert.equal(ring.where, 'minvent');
});
//# sourceMappingURL=nazgul_birth_inventory.test.js.map