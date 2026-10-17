import test from 'node:test';
import assert from 'node:assert/strict';

import {
    M_ATTK_AGR_DIED, M_ATTK_HIT, M_ATTK_MISS,
    MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, W_AMUL, W_ARMH,
} from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { resolveMonsterBrainAttack } from '../js/monster_brain_attack.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import type { MonsterDeathHandler } from '../js/monster_death.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, DUNCE_CAP, HELMET, STATUE } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
const maximumRoll = (sides: number) => sides;
const finishDeath: MonsterDeathHandler = (monster, options) =>
    finishEnvironmentalMonsterDeath(monster, game, options);

void test('brain drain adds pending damage without settling the defender death early', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    defender.mhp = 5;
    const messages: string[] = [];

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: true, rollOne: maximumRoll, finishDeath,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.damage, 12);
    assert.equal(result.hitFlags, M_ATTK_HIT);
    assert.equal(result.skipBrainDrain, false);
    assert.equal(defender.mhp, 5);
    assert.equal(game.level.monsters.includes(defender), true);
    assert.ok(messages.includes("The orc's last thought fades away..."));
});

void test('a cancelled mind flayer still drains a brain', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    attacker.mcan = 1;

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, rollOne: maximumRoll, finishDeath,
    });

    assert.equal(result.damage, 12);
    assert.equal(result.hitFlags, M_ATTK_HIT);
});

void test('a brain meal extends an overdue pet hunger deadline without restoring starvation HP', async () => {
    freshObjectRoom({ moves: 1000 });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    initializePet(attacker, { state: game });
    const pet = attacker.edog;
    assert.ok(pet);
    pet.hungrytime = 900;
    pet.mhpmax_penalty = 12;
    attacker.mhp = 3;
    attacker.mhpmax = 20;
    attacker.mconf = 1;
    attacker.mflee = 1;
    attacker.mfleetim = 20;

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, rollOne: maximumRoll, finishDeath,
    });

    assert.equal(result.damage, 12);
    assert.equal(pet.hungrytime, 960);
    assert.equal(attacker.mconf, 0);
    assert.equal(attacker.mhp, 3);
    assert.equal(attacker.mhpmax, 20);
    assert.equal(pet.mhpmax_penalty, 12);
    assert.equal(attacker.mfleetim, 20);
});

void test('a minion brain eater gains damage but no pet feeding effects', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    attacker.mtame = 10;
    attacker.isminion = true;
    attacker.mconf = 1;

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, rollOne: maximumRoll, finishDeath,
    });

    assert.equal(result.damage, 12);
    assert.equal(attacker.mconf, 1);
    assert.equal(attacker.edog, undefined);
});

void test('headless green slime stops the remaining brain attacks without infecting a monster attacker', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('green slime', 12, 10, TEST_MONSTER_FLAGS);

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, rollOne: maximumRoll, finishDeath,
    });

    assert.equal(result.damage, 0);
    assert.equal(result.hitFlags, M_ATTK_MISS);
    assert.equal(result.skipBrainDrain, true);
    assert.equal(attacker.mnum, MONSTER_NAME.indexOf('mind flayer'));
});

void test('a tentacle on a worm tail causes no brain or physical damage', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('long worm', 12, 10, TEST_MONSTER_FLAGS);

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, notOnHead: true, rollOne: maximumRoll, finishDeath,
    });

    assert.equal(result.damage, 0);
    assert.equal(result.skipBrainDrain, true);
});

for (const helmetType of [HELMET, DUNCE_CAP]) {
    void test(`${helmetType === HELMET ? 'a greased helmet' : 'a dunce cap'} blocks brain drain but keeps tentacle damage`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
        const defender = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
        const helmet = await equipMonsterObject(defender,
            await knownObject(helmetType, { greased: true }), W_ARMH);
        const messages: string[] = [];

        const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
            state: game, visible: true, random: () => 1, rollOne: maximumRoll, finishDeath,
            publish: async message => { messages.push(message); },
        });

        assert.equal(result.damage, 2);
        assert.equal(result.hitFlags, M_ATTK_MISS);
        assert.equal(result.skipBrainDrain, false);
        assert.equal(helmet.greased, true);
        assert.match(messages[0] ?? '', /helmet blocks the mind flayer's attack/);
    });
}

void test('a tentacle that penetrates a monster dunce cap can eat its brain', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    await equipMonsterObject(defender, await knownObject(DUNCE_CAP), W_ARMH);

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, random: () => 0, rollOne: maximumRoll, finishDeath,
    });

    assert.equal(result.damage, 12);
    assert.equal(result.hitFlags, M_ATTK_HIT);
});

for (const species of ['ghost', 'straw golem']) {
    void test(`${species} brains provide no extra damage or pet nutrition`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
        const defender = await createMonsterAt(species, 12, 10, TEST_MONSTER_FLAGS);
        initializePet(attacker, { state: game });
        const pet = attacker.edog;
        assert.ok(pet);
        const hungerBefore = pet.hungrytime;
        attacker.mconf = 1;

        const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
            state: game, visible: false, rollOne: maximumRoll, finishDeath,
        });

        assert.equal(result.damage, 2);
        assert.equal(result.hitFlags, M_ATTK_MISS);
        assert.equal(result.skipBrainDrain, false);
        assert.equal(pet.hungrytime, hungerBefore);
        assert.equal(attacker.mconf, 1);
    });
}

void test('a mind flayer killed by an earlier contact does not continue eating brains', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    await finishEnvironmentalMonsterDeath(attacker, game, { noCorpse: true });

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, rollOne: maximumRoll, finishDeath,
    });

    assert.equal(result.damage, 2);
    assert.equal(result.hitFlags, M_ATTK_AGR_DIED);
});

void test('eating Medusa brain leaves a real statue containing the attacker inventory', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('Medusa', 12, 10, TEST_MONSTER_FLAGS);
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(attacker, dagger);
    const killsBefore = game.u.uconduct.killer ?? 0;
    const messages: string[] = [];

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: true, rollOne: maximumRoll, finishDeath,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.damage, 2, 'Petrification leaves only pending tentacle damage');
    assert.equal(result.hitFlags, M_ATTK_AGR_DIED);
    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.includes(attacker), false);
    const statue = floorObjectsAt(level, 11, 10).find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(statue.corpsenm, MONSTER_NAME.indexOf('mind flayer'));
    assert.ok(statue.contents?.includes(dagger));
    assert.equal(dagger.where, 'contained');
    assert.equal(game.u.uconduct.killer ?? 0, killsBefore);
    assert.ok(messages.includes('The mind flayer turns to stone!'));
});

void test('life saving stops a Medusa brain meal before extra damage and statue creation', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('Medusa', 12, 10, TEST_MONSTER_FLAGS);
    const amulet = await equipMonsterObject(attacker,
        await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const input = resetInputState();

    const result = await answerPrompts(resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: true, rollOne: maximumRoll, finishDeath, publish: async () => {},
    }), input, [
        { prompt: /But wait\.\.\.  .*medallion begins to glow.*--More--/, keys: ' ' },
    ]);

    assert.equal(result.damage, 2);
    assert.equal(result.hitFlags, M_ATTK_MISS);
    assert.ok(attacker.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(level.monsters.includes(attacker), true);
    assert.equal(floorObjectsAt(level, 11, 10).some(object => object.otyp === STATUE), false);
});

void test('unseen Medusa brain petrification gives the distinct lost-pet thought', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('Medusa', 12, 10, TEST_MONSTER_FLAGS);
    initializePet(attacker, { state: game });
    await makeBlinded(10, { talk: false });
    const messages: string[] = [];

    const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
        state: game, visible: false, rollOne: maximumRoll, finishDeath,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.hitFlags, M_ATTK_AGR_DIED);
    assert.ok(messages.includes('You have a sad thought for a moment, then it passes.'));
    assert.ok(messages.every(message => !/brain is eaten|turns to stone/.test(message)));
});

for (const lifeSaving of [false, true]) {
    void test(`a Rider brain meal ${lifeSaving ? 'life-saves' : 'kills'} its eater but still adds damage to the Rider`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const attacker = await createMonsterAt('mind flayer', 11, 10, TEST_MONSTER_FLAGS);
        const defender = await createMonsterAt('Death', 12, 10, TEST_MONSTER_FLAGS);
        const amulet = lifeSaving ? await equipMonsterObject(attacker,
            await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL) : null;
        await makeBlinded(10, { talk: false });

        const result = await resolveMonsterBrainAttack(attacker, defender, 2, {
            state: game, visible: false, rollOne: maximumRoll, finishDeath,
        });

        assert.equal(result.damage, 12);
        assert.equal(result.hitFlags, lifeSaving ? M_ATTK_HIT : M_ATTK_AGR_DIED);
        assert.equal(attacker.mhp > 0, lifeSaving);
        assert.equal(level.monsters.includes(attacker), lifeSaving);
        if (amulet) assert.equal(amulet.where, 'gone');
        assert.equal(result.skipBrainDrain, false);
    });
}
