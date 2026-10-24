import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMonsterName, resolveMonsterNamePrefix } from '../js/mondata.js';
import { MONSTER_NAME } from '../js/monster_data.js';
void test('old priest names select the cleric species and retain their named sex', () => {
    assert.deepEqual(resolveMonsterName('aligned priest'), {
        mnum: MONSTER_NAME.indexOf('aligned cleric'), gender: 0,
    });
    assert.deepEqual(resolveMonsterName('aligned priestess'), {
        mnum: MONSTER_NAME.indexOf('aligned cleric'), gender: 1,
    });
    const highPriest = resolveMonsterNamePrefix('high priestess corpse');
    assert.ok(highPriest);
    assert.equal(highPriest.gender, 1);
    assert.equal(highPriest.overridesGender, true);
    assert.equal(highPriest.remainder, ' corpse');
});
//# sourceMappingURL=mondata_names.test.js.map