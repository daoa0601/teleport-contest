import { monsterAtPosition } from '../js/monster_location.js';
import { floorObjectsAt } from './support/level-state.js';
import type { Monster } from '../js/monster_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { MM_ANGRY, NO_MINVENT, M_AP_MONSTER, M_ATTK_MISS, STRAT_WAITMASK, W_AMUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initializePet } from '../js/dog.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { displaceMonster } from '../js/monster_displacement.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, STATUE } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function attemptDisplacement(aggressor: Monster, defender: Monster, options: Parameters<typeof displaceMonster>[3] = {}) {
    // A monster can refuse an individual attempt. Retry normal game actions,
    // without replacing the RNG or requiring a particular random sequence.
    for (let attempt = 0; attempt < 20; attempt++) {
        const result = await displaceMonster(aggressor, defender, game, options);
        if (result !== M_ATTK_MISS) return;
    }
    assert.fail('The monster refused every displacement attempt.');
}

void test('displacement swaps monsters and interrupts a quickmimic meal and sleep', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const beast = await createMonsterAt('displacer beast', 13, 10);
    const defender = await createMonsterAt('little dog', 12, 10);
    initializePet(defender, { state: game });
    defender.msleeping = 1;
    defender.meating = 5;
    defender.mundetected = 1;
    defender.m_ap_type = M_AP_MONSTER;
    defender.mappearance = MONSTER_NAME.indexOf('kitten');
    defender.mstrategy = (defender.mstrategy ?? 0) | STRAT_WAITMASK;
    pushKeys('                                        ');

    await attemptDisplacement(beast, defender);

    assert.deepEqual([beast.mx, beast.my], [12, 10]);
    assert.deepEqual([defender.mx, defender.my], [13, 10]);
    assert.equal(defender.msleeping, 0);
    assert.equal(defender.meating, 0);
    assert.equal(defender.mundetected, 0);
    assert.equal(defender.m_ap_type, 0);
    assert.equal((defender.mstrategy ?? 0) & STRAT_WAITMASK, 0);
});

void test('trying to displace a cockatrice petrifies an unprotected displacer', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const beast = await createMonsterAt('displacer beast', 13, 10);
    const cockatrice = await createMonsterAt('cockatrice', 12, 10);
    const kills = game.u.uconduct.killer ?? 0;
    pushKeys('                                        ');

    await attemptDisplacement(beast, cockatrice);

    assert.notEqual(monsterAtPosition(game.level, beast.mx, beast.my), beast);
    assert.deepEqual([cockatrice.mx, cockatrice.my], [12, 10]);
    assert.ok(floorObjectsAt(game.level, 13, 10).some(object => object.otyp === STATUE));
    assert.equal(game.u.uconduct.killer ?? 0, kills);
});

void test('life saving stops contact petrification without swapping either monster', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const beast = await createMonsterAt('displacer beast', 13, 10);
    const cockatrice = await createMonsterAt('cockatrice', 12, 10);
    const amulet = await equipMonsterObject(beast,
        await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    pushKeys('                                        ');

    await attemptDisplacement(beast, cockatrice);

    assert.ok(beast.mhp > 0);
    assert.equal(game.level.monsters.includes(beast), true);
    assert.deepEqual([beast.mx, beast.my], [13, 10]);
    assert.deepEqual([cockatrice.mx, cockatrice.my], [12, 10]);
    assert.equal(amulet.where, 'gone');
    assert.equal((game.level.objects[13]?.[10] || []).some(object => object.otyp === STATUE), false);
});

void test('a female displacer beast moves another monster out of its way', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const beast = await createMonsterAt('displacer beast', 13, 10);
    beast.female = true;
    const jackal = await createMonsterAt('jackal', 12, 10);
    const messages: string[] = [];

    await attemptDisplacement(beast, jackal, {
        publish: async (message: string) => messages.push(message),
    });

    assert.ok(messages.some(message =>
        message.includes('The displacer beast moves the jackal out of its way!')),
    messages.join('\n'));
});

void test('a Rider uses its proper name when moving another monster aside', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const rider = await createMonsterAt('Death', 13, 10);
    const jackal = await createMonsterAt('jackal', 12, 10);
    const messages: string[] = [];

    await attemptDisplacement(rider, jackal, {
        publish: async (message: string) => messages.push(message),
    });

    assert.ok(messages.some(message =>
        message.startsWith('Death moves the jackal out of the way!')),
    messages.join('\n'));
});


void test('an ordinary monster turn displaces a blocker rather than sharing its square', async () => {
    freshObjectRoom({ left: 9, right: 16, top: 10, bottom: 10,
        heroX: 10, heroY: 10, context: { mon_moving: true } });
    requirePlayingGame(game);
    const beast = await createMonsterAt('displacer beast', 13, 10, MM_ANGRY | NO_MINVENT);
    const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
    initializePet(dog, { state: game });
    pushKeys(' '.repeat(100));

    for (let attempt = 0; attempt < 20 && beast.mx === 13; attempt++)
        await takeMonsterTurn(beast, game);

    assert.deepEqual([beast.mx, beast.my], [12, 10]);
    assert.deepEqual([dog.mx, dog.my], [13, 10]);
});
