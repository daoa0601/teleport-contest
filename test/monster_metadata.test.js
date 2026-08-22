import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_COLOR, MONSTER_NAME,
    MONSTER_GROWTH_TARGET, MONSTER_SOUND, MONSTER_SYMBOL,
    monsterGrowthFamilyMatch, monsterIsNonliving,
} from '../js/monster_data.js';

test('generated monster colors cover the configured permonst table', () => {
    assert.equal(MONSTER_COLOR.length, 383);
    assert.equal(MONSTER_COLOR.length, MONSTER_SYMBOL.length);

    // Big Room witnesses: large kobold, rock piercer, and iguana.
    assert.equal(MONSTER_COLOR[60], 1);
    assert.equal(MONSTER_COLOR[78], 7);
    assert.equal(MONSTER_COLOR[324], 3);
});

test('generated monster body metadata carries corpse timing inputs', () => {
    assert.equal(MONSTER_BODY_META.length, 383);
    assert.deepEqual(MONSTER_BODY_META[322], [10, 20]); // newt
});

test('generated monster sound metadata carries setmangry growl dispatch', () => {
    assert.equal(MONSTER_SOUND.length, 383);
    assert.equal(MONSTER_SOUND[103], 12); // black unicorn, MS_NEIGH
    assert.equal(MONSTER_SOUND[322], 0); // newt, MS_SILENT
});

test('generated monster attacks retain all six source slots', () => {
    assert.equal(MONSTER_ATTACKS.length, 383);
    assert.ok(MONSTER_ATTACKS.every(row => row.length === 6));
    assert.deepEqual(MONSTER_ATTACKS[12][0], [2, 0, 1, 2]); // jackal bite
    assert.deepEqual(MONSTER_ATTACKS[13][0], [2, 0, 1, 3]); // fox bite
    assert.deepEqual(MONSTER_ATTACKS[59][0], [254, 0, 1, 4]); // kobold weapon
    assert.deepEqual(MONSTER_ATTACKS[116][0], [2, 6, 1, 1]); // grid bug shock
});

test('generated neutral monster names cover the configured permonst table', () => {
    assert.equal(MONSTER_NAME.length, 383);
    assert.equal(MONSTER_NAME[13], 'fox');
    assert.equal(MONSTER_NAME[322], 'newt');
});

test('generated monster growth metadata preserves transitive families', () => {
    assert.equal(MONSTER_GROWTH_TARGET.length, 383);
    assert.equal(MONSTER_GROWTH_TARGET[16], 18); // little dog -> dog
    assert.equal(MONSTER_GROWTH_TARGET[18], 19); // dog -> large dog
    assert.equal(MONSTER_GROWTH_TARGET[32], 33); // kitten -> housecat
    assert.equal(MONSTER_GROWTH_TARGET[33], 37); // housecat -> large cat
    assert.equal(MONSTER_GROWTH_TARGET[100], 104); // pony -> horse
    assert.equal(MONSTER_GROWTH_TARGET[104], 105); // horse -> warhorse

    assert.equal(monsterGrowthFamilyMatch(16, 18), true);
    assert.equal(monsterGrowthFamilyMatch(18, 16), true);
    assert.equal(monsterGrowthFamilyMatch(16, 19), true);
    assert.equal(monsterGrowthFamilyMatch(19, 16), true);
    assert.equal(monsterGrowthFamilyMatch(16, 32), false);
    assert.equal(monsterGrowthFamilyMatch(16, 17), false);
});

test('nonliving follows undead, manes, vortex, and golem metadata', () => {
    assert.equal(monsterIsNonliving(239), true); // kobold zombie, M2_UNDEAD
    assert.equal(monsterIsNonliving(50), true); // manes
    assert.equal(monsterIsNonliving(107), true); // dust vortex
    assert.equal(monsterIsNonliving(249), true); // straw golem
    assert.equal(monsterIsNonliving(59), false); // kobold
});
