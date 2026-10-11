import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTER_NAME, monsterGrowthFamilyMatch, monsterIsNonliving, } from '../js/monster_data.js';
const monsterType = (name) => MONSTER_NAME.indexOf(name);
void test('young and grown forms belong to the same monster family', () => {
    const puppy = monsterType('little dog');
    const dog = monsterType('dog');
    const largeDog = monsterType('large dog');
    const kitten = monsterType('kitten');
    const dingo = monsterType('dingo');
    assert.equal(monsterGrowthFamilyMatch(puppy, dog), true);
    assert.equal(monsterGrowthFamilyMatch(dog, puppy), true);
    assert.equal(monsterGrowthFamilyMatch(puppy, largeDog), true);
    assert.equal(monsterGrowthFamilyMatch(largeDog, puppy), true);
    assert.equal(monsterGrowthFamilyMatch(puppy, kitten), false);
    assert.equal(monsterGrowthFamilyMatch(puppy, dingo), false);
});
void test('undead, manes, vortices, and golems are nonliving', () => {
    assert.equal(monsterIsNonliving(monsterType('kobold zombie')), true);
    assert.equal(monsterIsNonliving(monsterType('manes')), true);
    assert.equal(monsterIsNonliving(monsterType('dust vortex')), true);
    assert.equal(monsterIsNonliving(monsterType('straw golem')), true);
    assert.equal(monsterIsNonliving(monsterType('kobold')), false);
});
//# sourceMappingURL=monster_metadata.test.js.map