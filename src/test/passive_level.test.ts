import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { applyHeroContactPassive } from '../js/monster_passive.js';
import { applyMonsterContactPassive } from '../js/monster_contact_passive.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an experienced floating eye freezes the hero for its current level', async () => {
    freshObjectRoom();
    const eye = await createMonsterAt('floating eye', 11, 10);
    eye.m_lev = 12;

    await applyHeroContactPassive(eye, {
        hit: true, random: () => 1, rollDice: count => count, publish: () => {},
    });

    assert.equal(game._helplessTurns, 13);
});

void test('a floating eye uses its species level when freezing another monster', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('soldier', 10, 10);
    const eye = await createMonsterAt('floating eye', 11, 10);
    eye.m_lev = 12;

    await applyMonsterContactPassive(attacker, eye, {
        hit: true, random: () => 1, rollDice: count => count, publish: () => {},
    });

    assert.equal(attacker.mfrozen, 3);
    assert.equal(attacker.mcanmove, 0);
});
