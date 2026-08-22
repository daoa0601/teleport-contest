import test from 'node:test';
import assert from 'node:assert/strict';

import {
    awardMonsterExperience, loseExperienceLevel, monsterExperience,
    newExperienceThreshold,
} from '../js/exper.js';
import { MONSTER_EXPERIENCE_META } from '../js/monster_data.js';

test('generated monster experience metadata covers the configured table', () => {
    assert.equal(MONSTER_EXPERIENCE_META.length, 383);
    assert.deepEqual(MONSTER_EXPERIENCE_META[59], [10, 5, 0, 0, 0]);
    assert.deepEqual(MONSTER_EXPERIENCE_META[158], [9, 3, 1, 0, 0]);
});

test('experience includes source attack bonuses for early hostiles', () => {
    assert.equal(monsterExperience({ mnum: 59, m_lev: 0 }), 6); // kobold
    assert.equal(monsterExperience({ mnum: 116, m_lev: 0 }), 1); // grid bug
    assert.equal(monsterExperience({ mnum: 12, m_lev: 0 }), 1); // jackal
    assert.equal(monsterExperience({ mnum: 158, m_lev: 0 }), 4); // lichen
});

test('revived monster awards use the source repeated-kill bands', () => {
    assert.equal(monsterExperience({ mnum: 59, m_lev: 0, mrevived: 1 }, {
        killCount: 20,
    }), 6);
    assert.equal(monsterExperience({ mnum: 59, m_lev: 0, mrevived: 1 }, {
        killCount: 21,
    }), 3);
});

test('more_experienced adds experience and fourfold score', () => {
    const state = { u: { uexp: 2, urexp: 8 } };
    assert.equal(awardMonsterExperience({ mnum: 158, m_lev: 0 }, {
        state,
    }), 4);
    assert.deepEqual(state.u, { uexp: 6, urexp: 24 });
});

test('losexp removes the exact retained level HP and power increments', () => {
    const state = {
        u: {
            ulevel: 20,
            uhp: 10, uhpmax: 99,
            uen: 213, uenmax: 213,
            uexp: newExperienceThreshold(19),
            uhpinc: Array(30).fill(0),
            ueninc: Array(30).fill(0),
        },
    };
    state.u.uhpinc[19] = 2;
    state.u.ueninc[19] = 14;

    assert.deepEqual(loseExperienceLevel(state), {
        oldLevel: 20, newLevel: 19, hpLoss: 2, energyLoss: 14,
    });
    assert.deepEqual({
        level: state.u.ulevel,
        hp: state.u.uhp, hpmax: state.u.uhpmax,
        energy: state.u.uen, energymax: state.u.uenmax,
        experience: state.u.uexp,
    }, {
        level: 19,
        hp: 8, hpmax: 97,
        energy: 199, energymax: 199,
        experience: newExperienceThreshold(19) - 1,
    });
});

test('losexp preserves the source maximum-HP floor', () => {
    const state = {
        u: {
            ulevel: 2, uhp: 3, uhpmax: 12, uen: 4, uenmax: 4,
            uexp: 40,
            uhpinc: [0, 9], ueninc: [0, 6],
        },
    };

    loseExperienceLevel(state);
    assert.deepEqual([
        state.u.ulevel, state.u.uhp, state.u.uhpmax,
        state.u.uen, state.u.uenmax,
    ], [1, 1, 10, 0, 0]);
});
