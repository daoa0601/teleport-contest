import test from 'node:test';
import assert from 'node:assert/strict';

import {
    beginMonsterSpitAttack, resolveMonsterSpitFlight,
} from '../js/monster_spit.js';
import { game } from '../js/gstate.js';
import { resolveRangedRetaliation } from '../js/dogmove.js';
import { quietMonsterActionRng } from '../js/monmove.js';
import { freshObjectRoom } from './support/object-room.js';
import { addMonster, addMonsterToLevel, addPet } from './support/monsters.js';
import {
    freshRangedCombatRoom, rangedPet, rangedTarget,
} from './support/ranged-combat.js';

test('a black naga can spit acid at another monster', () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = addMonster({
        species: 'black naga',
        x: 9,
        y: 10,
        hitPoints: 30,
        level: 8,
    });
    const target = addMonster({
        species: 'jackal',
        x: 12,
        y: 10,
        hitPoints: 12,
    });

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

test('acid venom does not hurt an acid-resistant monster', () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = addMonster({
        species: 'black naga',
        x: 9,
        y: 10,
        hitPoints: 30,
        level: 8,
    });
    const dragon = addMonster({
        species: 'yellow dragon',
        x: 12,
        y: 10,
        hitPoints: 12,
    });

    const spit = beginMonsterSpitAttack(naga, dragon.mx, dragon.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(dragon.mhp, 12);
});

test('blinding venom cannot blind an eyeless monster', () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const cobra = addMonster({
        species: 'cobra',
        x: 9,
        y: 10,
        hitPoints: 30,
        level: 8,
    });
    const cube = addMonster({
        species: 'gelatinous cube',
        x: 12,
        y: 10,
        hitPoints: 12,
    });

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

test('a tame black naga spits at a distant monster instead of moving', () => {
    freshRangedCombatRoom({ gameplaySeed: 3n });
    const naga = addMonsterToLevel(rangedPet('black naga'));
    const target = addMonsterToLevel(rangedTarget());

    const action = quietMonsterActionRng(naga, game);
    resolveMonsterSpitFlight(naga, action.movement.spitAttack, game);

    assert.deepEqual([naga.mx, naga.my], [9, 10]);
    assert.ok(target.mhp < 12);
    assert.equal(naga.edog.hungrytime, 995);
});

test('a cobra can spit back after a ranged attack', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12, gameplaySeed: 7n });
    const pet = addPet({
        species: 'orc',
        x: 9,
        y: 10,
        hitPoints: 30,
        level: 8,
    });
    const cobra = addMonster({
        species: 'cobra',
        x: 12,
        y: 10,
        hitPoints: 30,
        level: 8,
    });

    await resolveRangedRetaliation(pet, cobra, game, {
        publish: async () => {},
        finishMonsterKill: async () => {},
    });

    assert.equal(pet.mcansee, 0);
    assert.ok(pet.mblinded > 0);
});
