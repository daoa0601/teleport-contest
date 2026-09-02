import test from 'node:test';
import assert from 'node:assert/strict';

import { POLY_TRAP, W_ARMF } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import {
    IRON_SHOES, KICKING_BOOTS,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

test("a polymorph trap changes a monster's iron shoes but leaves them worn", () => {
    initRng(1n);
    const shoes = knownObject(IRON_SHOES, {
        spe: 2,
        enchantment: 2,
        owornmask: W_ARMF,
        worn: true,
    });
    const { monster } = freshMonsterTrapRoom(POLY_TRAP, {
        monster: {
            species: 'giant',
            inventory: [shoes],
            misc_worn_check: W_ARMF,
        },
    });
    const originalForm = monster.mnum;

    triggerImmediateMonsterTrap(monster, game);

    const changedShoes = monster.inventory[0];
    assert.equal(changedShoes.otyp, KICKING_BOOTS);
    assert.equal(changedShoes.spe, 2);
    assert.equal(changedShoes.owornmask, W_ARMF);
    assert.equal(monster.misc_worn_check & W_ARMF, W_ARMF);
    assert.equal(monster.mnum, originalForm);
});

test('magic resistance protects a monster from a polymorph trap', () => {
    const { monster, trap } = freshMonsterTrapRoom(POLY_TRAP, {
        monster: { species: 'baby gray dragon' },
    });
    const originalForm = monster.mnum;

    triggerImmediateMonsterTrap(monster, game);

    assert.equal(monster.mnum, originalForm);
    assert.notEqual(trap.tseen, true);
});

test('a visible monster changes form and reveals a polymorph trap', async () => {
    const { monster, trap } = freshMonsterTrapRoom(POLY_TRAP, {
        monster: { species: 'giant' },
    });
    const originalForm = monster.mnum;
    const messages = [];
    initRng(1n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => messages.push(message),
        revealTrap: () => {},
    });

    assert.notEqual(monster.mnum, originalForm);
    assert.equal(trap.tseen, true);
    assert.match(messages[0], / turns into /u);
});

test('a polymorph trap is revealed when a Nazgul cannot change form', async () => {
    const { monster, trap } = freshMonsterTrapRoom(POLY_TRAP, {
        monster: { species: 'Nazgul' },
    });
    const originalForm = monster.mnum;
    initRng(1n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async () => {},
        revealTrap: () => {},
    });

    assert.equal(monster.mnum, originalForm);
    assert.equal(trap.tseen, true);
});
