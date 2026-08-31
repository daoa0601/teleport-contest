import test from 'node:test';
import assert from 'node:assert/strict';

import {
    awardMonsterExperience, gainExperienceLevel, loseExperienceLevel,
    monsterExperience, newExperienceThreshold,
} from '../js/exper.js';
import { A_CON, A_WIS } from '../js/const.js';
import { game, resetGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';

const monster = (name, state = {}) => ({
    mnum: MONSTER_NAME.indexOf(name),
    m_lev: 0,
    ...state,
});

test('experience includes source attack bonuses for early hostiles', () => {
    assert.equal(monsterExperience(monster('kobold')), 6);
    assert.equal(monsterExperience(monster('grid bug')), 1);
    assert.equal(monsterExperience(monster('jackal')), 1);
    assert.equal(monsterExperience(monster('lichen')), 4);
});

test('revived monster awards use the source repeated-kill bands', () => {
    assert.equal(monsterExperience(monster('kobold', { mrevived: 1 }), {
        killCount: 20,
    }), 6);
    assert.equal(monsterExperience(monster('kobold', { mrevived: 1 }), {
        killCount: 21,
    }), 3);
});

test('more_experienced adds experience and fourfold score', () => {
    const state = { u: { uexp: 2, urexp: 8 } };
    assert.equal(awardMonsterExperience(monster('lichen'), {
        state,
    }), 4);
    assert.deepEqual(state.u, { uexp: 6, urexp: 24 });
});

test('a gained level retains the HP and power that losing it removes', () => {
    resetGame();
    initRng(712n);
    const attributes = Array(6).fill(10);
    attributes[A_CON] = 14;
    attributes[A_WIS] = 12;
    game.flags = { female: false };
    game.urole = {
        key: 'archeologist', name: { m: 'Archeologist' }, xlev: 10,
        title: [{ m: 'Digger' }],
        hpadv: { lofix: 2, lornd: 0 },
        enadv: { lofix: 1, lornd: 0 },
    };
    game.urace = {
        hpadv: { lofix: 0, lornd: 0 },
        enadv: { lofix: 0, lornd: 0 },
    };
    game.u = {
        ulevel: 1, ulevelmax: 1,
        uhp: 10, uhpmax: 10, uhppeak: 10,
        uen: 5, uenmax: 5, uenpeak: 5,
        uexp: 19,
        acurr: { a: attributes },
    };

    gainExperienceLevel();
    const hpGain = game.u.uhpinc[1];
    const powerGain = game.u.ueninc[1];
    assert.equal(game.u.ulevel, 2);
    assert.equal(game.u.uhpmax, 10 + hpGain);
    assert.equal(game.u.uenmax, 5 + powerGain);

    loseExperienceLevel();
    assert.equal(game.u.ulevel, 1);
    assert.equal(game.u.uhpmax, 10);
    assert.equal(game.u.uenmax, 5);
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
