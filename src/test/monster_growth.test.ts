import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import {
    finishMonsterGrowth, growMonster,
} from '../js/monster_growth.js';

const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;
const PM_LITTLE_DOG = 16;
const PM_DOG = 18;

async function monster(mnum: number, level: number, hitPoints: number, x = 11) {
    const actor = await createMonsterAt(mnum, x, 10, MM_NOGRP | NO_MINVENT);
    actor.m_lev = level;
    actor.mhp = hitPoints;
    actor.mhpmax = hitPoints;
    actor.female = false;
    return actor;
}

void test('a young monster becomes its adult form after crossing its level limit',
    async () => {
        freshObjectRoom();
        const dog = await monster(PM_LITTLE_DOG, 3, 24);
        const victim = await monster(100, 7, 1, 12);

        const growth = growMonster(dog, {
            victim,
            state: game,
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

void test('a gain-level potion can turn a killer bee into a queen bee', async () => {
    freshObjectRoom();
    const bee = await monster(PM_KILLER_BEE, 8, 20);

    const growth = growMonster(bee, {
        state: game,
        rollOne: () => 4,
    });

    assert.equal(growth.changedSpecies, true);
    finishMonsterGrowth(bee, growth);
    assert.equal(bee.mnum, PM_QUEEN_BEE);
    assert.equal(bee.m_lev, 9);
    assert.equal(bee.mhp, 24);
    assert.equal(bee.mhpmax, 24);
});

void test('growing into a genocided adult marks the monster for removal', async () => {
    freshObjectRoom();
    const dog = await monster(PM_LITTLE_DOG, 3, 24);
    const victim = await monster(100, 7, 1, 12);
    assert.ok(game.mvitals);
    game.mvitals[PM_DOG] = { born: 0, died: 0, mvflags: G_GENOD };

    const growth = growMonster(dog, {
        victim,
        state: game,
        rollOne: () => 8,
        random: () => 0,
    });

    assert.equal(growth.genocided, true);
    assert.equal(growth.alive, false);
    assert.equal(dog.mnum, PM_LITTLE_DOG);
    finishMonsterGrowth(dog, growth);
    assert.equal(dog.mnum, PM_DOG);
});
