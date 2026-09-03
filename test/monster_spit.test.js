import test from 'node:test';
import assert from 'node:assert/strict';

import {
    beginMonsterSpitAttack, finishHeroSpitHit, resolveMonsterSpitFlight,
} from '../js/monster_spit.js';
import {
    MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT,
    W_AMUL, W_ARMH,
} from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { makemonAt } from '../js/mklev.js';
import { nameToMonster } from '../js/mondata.js';
import { AMULET_OF_LIFE_SAVING, HELMET } from '../js/object_data.js';
import { resolveRangedRetaliation } from '../js/dogmove.js';
import { quietMonsterActionRng } from '../js/monmove.js';
import { addInventoryObject } from './support/game-objects.js';
import { wearHeroObject } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshRangedCombatRoom } from './support/ranged-combat.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT
    | NO_MINVENT;

async function placeMonster(species, x, y) {
    const monster = await makemonAt(
        nameToMonster(species), x, y, TEST_MONSTER_FLAGS,
    );
    assert.ok(monster, `could not create ${species} at ${x},${y}`);
    return monster;
}

test('a black naga can spit acid at another monster', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = await placeMonster('black naga', 9, 10);
    const target = await placeMonster('jackal', 12, 10);
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
    const naga = await placeMonster('black naga', 9, 10);
    const dragon = await placeMonster('yellow dragon', 12, 10);
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
    const cobra = await placeMonster('cobra', 9, 10);
    const cube = await placeMonster('gelatinous cube', 12, 10);

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
    const amulet = wearHeroObject(
        addInventoryObject(AMULET_OF_LIFE_SAVING),
        'uamul',
        W_AMUL,
    );
    game.u.uhp = 1;
    const naga = await placeMonster('black naga', 9, 10);
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
    wearHeroObject(
        addInventoryObject(HELMET),
        'uarmh',
        W_ARMH,
    );
    const cobra = await placeMonster('cobra', 9, 10);
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
        const naga = await placeMonster('black naga', 9, 10);
        tameMonster(naga, game);
        const target = await placeMonster('orc-captain', 12, 10);
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
    const pet = await placeMonster('orc', 9, 10);
    tameMonster(pet, game);
    const cobra = await placeMonster('cobra', 12, 10);
    cobra.mhp = cobra.mhpmax = 30;

    await resolveRangedRetaliation(pet, cobra, game, {
        publish: async () => {},
        finishMonsterKill: async () => {},
    });

    assert.equal(pet.mcansee, 0);
    assert.ok(pet.mblinded > 0);
});
