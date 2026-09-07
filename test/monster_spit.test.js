import test from 'node:test';
import assert from 'node:assert/strict';

import {
    beginMonsterSpitAttack, finishHeroSpitHit, resolveMonsterSpitFlight,
} from '../js/monster_spit.js';
import {
    MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT,
} from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, HELMET } from '../js/object_data.js';
import { resolveRangedRetaliation } from '../js/dogmove.js';
import { quietMonsterActionRng } from '../js/monmove.js';
import { addInventoryObject } from './support/game-objects.js';
import { wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { freshRangedCombatRoom } from './support/ranged-combat.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT
    | NO_MINVENT;

test('a black naga can spit acid at another monster', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = await createMonsterAt(
        'black naga', 9, 10, TEST_MONSTER_FLAGS,
    );
    const target = await createMonsterAt(
        'jackal', 12, 10, TEST_MONSTER_FLAGS,
    );
    target.mhp = target.mhpmax = 12;

    const spit = beginMonsterSpitAttack(naga, target.mx, target.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(target.mhp, 10);
    assert.deepEqual([naga.mx, naga.my], [9, 10]);
});

test('acid venom does not hurt an acid-resistant monster', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = await createMonsterAt(
        'black naga', 9, 10, TEST_MONSTER_FLAGS,
    );
    const dragon = await createMonsterAt(
        'yellow dragon', 12, 10, TEST_MONSTER_FLAGS,
    );
    dragon.mhp = dragon.mhpmax = 12;

    const spit = beginMonsterSpitAttack(naga, dragon.mx, dragon.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(dragon.mhp, 12);
});

test('blinding venom cannot blind an eyeless monster', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const cobra = await createMonsterAt(
        'cobra', 9, 10, TEST_MONSTER_FLAGS,
    );
    const cube = await createMonsterAt(
        'gelatinous cube', 12, 10, TEST_MONSTER_FLAGS,
    );

    const spit = beginMonsterSpitAttack(cobra, cube.mx, cube.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(cobra, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(cube.mcansee, 1);
    assert.equal(cube.mblinded, undefined);
});

test('life saving rescues the hero from fatal acid venom', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        gameplaySeed: 1n,
    });
    const amulet = addInventoryObject(AMULET_OF_LIFE_SAVING);
    wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    const naga = await createMonsterAt(
        'black naga', 9, 10, TEST_MONSTER_FLAGS,
    );
    const spit = beginMonsterSpitAttack(
        naga, game.u.ux, game.u.uy, { random: () => 0 },
    );
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });
    pushKeys(' '.repeat(12));

    const died = await finishHeroSpitHit(spit, game);

    assert.equal(died, false);
    assert.ok(game.u.uhp > 0);
    assert.equal(game.inventory.includes(amulet), false);
});

test('a visored helmet blocks blinding venom', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        gameplaySeed: 1n,
    });
    game.objectDescriptions[HELMET] = 'visored helmet';
    wearHeroArmor(addInventoryObject(HELMET));
    const cobra = await createMonsterAt(
        'cobra', 9, 10, TEST_MONSTER_FLAGS,
    );
    const spit = beginMonsterSpitAttack(
        cobra, game.u.ux, game.u.uy, { random: () => 0 },
    );

    resolveMonsterSpitFlight(cobra, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.equal(game.u.ucreamed ?? 0, 0);
});

test('a tame black naga spits at a distant monster instead of moving',
    async () => {
        freshRangedCombatRoom();
        const naga = await createMonsterAt(
            'black naga', 9, 10, TEST_MONSTER_FLAGS,
        );
        tameMonster(naga, game);
        const target = await createMonsterAt(
            'orc-captain', 12, 10, TEST_MONSTER_FLAGS,
        );
        target.mhp = target.mhpmax = 12;
        const hungryBefore = naga.edog.hungrytime;

        const action = quietMonsterActionRng(
            naga, game,
            () => 0,
            (count, sides) => count * sides,
            () => 1,
        );
        resolveMonsterSpitFlight(naga, action.movement.spitAttack, game);

        assert.deepEqual([naga.mx, naga.my], [9, 10]);
        assert.ok(target.mhp < 12);
        assert.equal(naga.edog.hungrytime, hungryBefore - 5);
    });

test('a cobra can spit back after a ranged attack', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12, gameplaySeed: 7n });
    const pet = await createMonsterAt('orc', 9, 10, TEST_MONSTER_FLAGS);
    tameMonster(pet, game);
    const cobra = await createMonsterAt(
        'cobra', 12, 10, TEST_MONSTER_FLAGS,
    );
    cobra.mhp = cobra.mhpmax = 30;

    await resolveRangedRetaliation(pet, cobra, game, {
        publish: async () => {},
        finishMonsterKill: async () => {},
    });

    assert.equal(pet.mcansee, 0);
    assert.ok(pet.mblinded > 0);
});
