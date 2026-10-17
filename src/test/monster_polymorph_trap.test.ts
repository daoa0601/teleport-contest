import test from 'node:test';
import assert from 'node:assert/strict';

import { POLY_TRAP, W_ARMF } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import {
    IRON_SHOES, KICKING_BOOTS,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { applyMonsterPolymorphTrap } from '../js/polymorph_trap.js';
import { createStaffedShop } from './support/shop.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { addTrap } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

void test('polymorphing monster-worn shoes in a shop angers their owner', async () => {
    const level = freshObjectRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 10 });
    const shoes = await knownObject(IRON_SHOES);
    const monster = await createMonsterAt('giant', 11, 10);
    await addObjectToMonsterInventory(monster, shoes);
    shoes.owornmask = W_ARMF;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_ARMF;
    const trap = addTrap(level, POLY_TRAP, 11, 10);

    await applyMonsterPolymorphTrap(monster, trap);

    assert.equal(monster.minvent[0]?.otyp, KICKING_BOOTS);
    assert.equal(shopkeeper.mpeaceful, 0);
    assert.equal(shopkeeper.eshk.following, 1);
});

void test("a polymorph trap changes a monster's iron shoes but leaves them worn",
    async () => {
        initRng(1n);
        const shoes = await knownObject(IRON_SHOES, {
            spe: 2,
            enchantment: 2,
            owornmask: W_ARMF,
            worn: true,
        });
        const { monster } = await freshMonsterTrapRoom(POLY_TRAP, {
            monster: {
                species: 'giant',
                inventory: [shoes],
                misc_worn_check: W_ARMF,
            },
        });
        requirePlayingGame(game);
        const originalForm = monster.mnum;

        await triggerImmediateMonsterTrap(monster, game);

        const changedShoes = monster.inventory[0];
        assert.ok(changedShoes);
        assert.equal(changedShoes.otyp, KICKING_BOOTS);
        assert.equal(changedShoes.spe, 2);
        assert.equal(changedShoes.owornmask, W_ARMF);
        assert.equal((monster.misc_worn_check ?? 0) & W_ARMF, W_ARMF);
        assert.equal(monster.mnum, originalForm);
    });

void test('magic resistance protects a monster from a polymorph trap', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(POLY_TRAP, {
        monster: { species: 'baby gray dragon' },
    });
    requirePlayingGame(game);
    const originalForm = monster.mnum;

    await triggerImmediateMonsterTrap(monster, game);

    assert.equal(monster.mnum, originalForm);
    assert.notEqual(trap.tseen, true);
});

void test('a visible monster changes form and reveals a polymorph trap', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(POLY_TRAP, {
        monster: { species: 'giant' },
    });
    requirePlayingGame(game);
    const originalForm = monster.mnum;
    const messages: string[] = [];
    initRng(1n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message: string) => messages.push(message),
    });

    assert.notEqual(monster.mnum, originalForm);
    assert.equal(trap.tseen, true);
    assert.match(messages[0] ?? '', / turns into /u);
});

void test('a polymorph trap is revealed when a Nazgul cannot change form', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(POLY_TRAP, {
        monster: { species: 'Nazgul' },
    });
    requirePlayingGame(game);
    const originalForm = monster.mnum;
    initRng(1n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async () => {},
    });

    assert.equal(monster.mnum, originalForm);
    assert.equal(trap.tseen, true);
});
