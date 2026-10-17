import assert from 'node:assert/strict';
import test from 'node:test';

// C makemon.c:newmonhp() gives a monster whose hit dice all rolled 1 one more
// hit point, so a Knight's level-two pony never starts with fewer than three.

import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { makedog } from '../js/u_init.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a Knight\'s starting pony has at least three hit points', async () => {
    let lowest = Infinity;
    for (let seed = 1n; seed <= 400n; seed++) {
        freshObjectRoom({ role: 'knight', hero: { uz: { dnum: 0, dlevel: 1 }, ulevel: 1 } });
        initRng(seed);
        const pet = await makedog();
        assert.ok(pet);
        assert.equal(pet.m_lev, 2);
        assert.equal(pet.mhp, pet.mhpmax);
        lowest = Math.min(lowest, pet.mhp);
    }
    assert.equal(lowest, 3);
});
