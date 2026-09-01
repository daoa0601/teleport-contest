import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD } from '../js/const.js';
import {
    finishMonsterGrowth, growMonster,
} from '../js/monster_growth.js';

const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;
const PM_LITTLE_DOG = 16;
const PM_DOG = 18;

function monster(mnum, level, hitPoints) {
    return {
        mnum,
        m_lev: level,
        mhp: hitPoints,
        mhpmax: hitPoints,
        female: false,
    };
}

test('a young monster becomes its adult form after crossing its level limit',
    () => {
        const dog = monster(PM_LITTLE_DOG, 3, 24);
        const victim = monster(100, 7, 1);

        const growth = growMonster(dog, {
            victim,
            state: { u: {}, mvitals: [] },
            rollOne: () => 8,
            random: () => 0,
        });

        assert.equal(growth.changedSpecies, true);
        assert.equal(dog.mnum, PM_LITTLE_DOG);
        finishMonsterGrowth(dog, growth);
        assert.equal(dog.mnum, PM_DOG);
        assert.equal(dog.m_lev, 4);
        assert.equal(dog.mhpmax, 25);
    });

test('a gain-level potion can turn a killer bee into a queen bee', () => {
    const bee = monster(PM_KILLER_BEE, 8, 20);

    const growth = growMonster(bee, {
        state: { u: {}, mvitals: [] },
        rollOne: () => 4,
    });

    assert.equal(growth.changedSpecies, true);
    finishMonsterGrowth(bee, growth);
    assert.equal(bee.mnum, PM_QUEEN_BEE);
    assert.equal(bee.m_lev, 9);
    assert.equal(bee.mhp, 24);
    assert.equal(bee.mhpmax, 24);
});

test('growing into a genocided adult marks the monster for removal', () => {
    const dog = monster(PM_LITTLE_DOG, 3, 24);
    const victim = monster(100, 7, 1);
    const mvitals = [];
    mvitals[PM_DOG] = { mvflags: G_GENOD };

    const growth = growMonster(dog, {
        victim,
        state: { u: {}, mvitals },
        rollOne: () => 8,
        random: () => 0,
    });

    assert.equal(growth.genocided, true);
    assert.equal(growth.alive, false);
    assert.equal(dog.mnum, PM_LITTLE_DOG);
    finishMonsterGrowth(dog, growth);
    assert.equal(dog.mnum, PM_DOG);
});
