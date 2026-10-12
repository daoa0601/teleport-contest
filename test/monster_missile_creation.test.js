import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { objectCombatName } from '../js/objnam.js';
import { ORCISH_ARROW } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an Uruk-hai is created with poisoned orcish arrows', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const uruk = await createMonsterAt('Uruk-hai', 11, 10);
    const arrows = (uruk.minvent ?? []).find(object => object.otyp === ORCISH_ARROW);
    assert.ok(arrows, 'the uruk-hai loadout must include its bow ammunition');
    // m_initthrow() rolls rn1(12, 3) missiles and poisons every orcish arrow.
    assert.equal(arrows.opoisoned, true);
    assert.ok(arrows.quan >= 3 && arrows.quan <= 14, `quantity ${arrows.quan} outside rn1(12,3)`);
    assert.equal(arrows.owt, arrows.quan, 'each arrow weighs one unit');
    // The volley line names the stack with its poison, as mthrowu.c does.
    assert.equal(objectCombatName(arrows, { state: game }), 'poisoned crude arrows');
});
//# sourceMappingURL=monster_missile_creation.test.js.map