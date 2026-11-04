import { monsterHasNoLimbs } from '../js/mondata.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { MONSTER_FLAGS1, MONSTER_NAME } from '../js/monster_data.js';

void test('a body needs both missing arms and missing legs to count as limbless', () => {
    const species = MONSTER_NAME.indexOf('human');
    const original = Object.getOwnPropertyDescriptor(MONSTER_FLAGS1, species);
    assert.ok(original);
    try {
        // mons[] is mutable in C. Neither half of M1_NOLIMBS alone is enough.
        Object.defineProperty(MONSTER_FLAGS1, species, { value: 0x4000 });
        assert.equal(monsterHasNoLimbs(species), false, 'a body with arms still has limbs');
        Object.defineProperty(MONSTER_FLAGS1, species, { value: 0x2000 });
        assert.equal(monsterHasNoLimbs(species), false, 'a body with legs still has limbs');
        Object.defineProperty(MONSTER_FLAGS1, species, { value: 0x6000 });
        assert.equal(monsterHasNoLimbs(species), true);
    } finally {
        Object.defineProperty(MONSTER_FLAGS1, species, original);
    }
});
