import assert from 'node:assert/strict';
import test from 'node:test';
import { monsterLocomotion, monsterStagger, nameToMonster } from '../js/mondata.js';
void test('jackals use their legs to walk and stagger', () => {
    const jackal = nameToMonster('jackal');
    assert.equal(monsterLocomotion(jackal, 'walk'), 'walk');
    assert.equal(monsterStagger(jackal, 'stagger'), 'stagger');
});
//# sourceMappingURL=monster_flag_predicates.test.js.map