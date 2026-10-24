import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRE_TRAP, PIT } from '../js/const.js';
import { monsterKnowsTrap, monsterLearnsTrap } from '../js/trap_knowledge.js';
void test('learning all traps includes individual traps and the all-traps query', () => {
    const monster = { mtrapseen: 0 };
    monsterLearnsTrap(monster, { ttyp: -1 });
    assert.equal(monsterKnowsTrap(monster, { ttyp: PIT }), true);
    assert.equal(monsterKnowsTrap(monster, { ttyp: FIRE_TRAP }), true);
    assert.equal(monsterKnowsTrap(monster, { ttyp: -1 }), true);
    assert.equal(monsterKnowsTrap(monster, { ttyp: 0 }), false);
});
void test('forgetting all traps removes previously learned trap types', () => {
    const monster = { mtrapseen: 0 };
    monsterLearnsTrap(monster, { ttyp: PIT });
    monsterLearnsTrap(monster, { ttyp: 0 });
    assert.equal(monsterKnowsTrap(monster, { ttyp: PIT }), false);
    assert.equal(monsterKnowsTrap(monster, { ttyp: -1 }), false);
    assert.equal(monsterKnowsTrap(monster, { ttyp: 0 }), true);
});
//# sourceMappingURL=mondata_trap_knowledge.test.js.map