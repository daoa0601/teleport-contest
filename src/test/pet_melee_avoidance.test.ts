import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_ARMS } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMove } from '../js/monmove.js';
import { SHIELD_OF_REFLECTION } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;

async function meleeRoom(species: string) {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    const pet = await createMonsterAt('large dog', 10, 10, BIRTH_FLAGS);
    initializePet(pet);
    pet.m_lev = 15;
    pet.mhp = pet.mhpmax = 100;
    const target = await createMonsterAt(species, 11, 10, BIRTH_FLAGS);
    target.mpeaceful = 0;
    target.mhp = target.mhpmax = 100;
    target.mcansee = 1;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return { pet, target };
}

for (const species of ['floating eye', 'gelatinous cube', 'cockatrice']) {
    void test(`a pet avoids dangerous melee contact with a ${species}`, async () => {
        const { pet, target } = await meleeRoom(species);
        requirePlayingGame(game);

        await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1), count => count, () => 1);

        assert.equal(target.mhp, 100);
        assert.equal(pet.mcanmove, 1);
        assert.ok(pet.mhp > 0);
    });
}

void test('reflection lets a pet disregard a floating eye gaze when choosing melee', async () => {
    const { pet, target } = await meleeRoom('floating eye');
    await equipMonsterObject(pet, await knownObject(SHIELD_OF_REFLECTION), W_ARMS);
    requirePlayingGame(game);

    await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1), count => count, () => 1);

    assert.ok(target.mhp < 100);
    assert.equal(pet.mcanmove, 1);
});

void test('a blind floating eye does not deter a pet melee attack', async () => {
    const { pet, target } = await meleeRoom('floating eye');
    target.mcansee = 0;
    requirePlayingGame(game);

    await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1), count => count, () => 1);

    assert.ok(target.mhp < 100);
    assert.equal(pet.mcanmove, 1);
});

void test('a pet can take the rare chance to attack a gelatinous cube', async () => {
    const { pet, target } = await meleeRoom('gelatinous cube');
    requirePlayingGame(game);

    await beginMonsterMove(pet, game, () => 0, count => count, () => 1);

    assert.ok(target.mhp < 100);
});

for (const species of ['jackal', 'Student', 'Lord Carnarvon']) {
    void test(`a pet leaves a peaceful ${species} alone when injured or protecting quest allies`, async () => {
        const { pet, target } = await meleeRoom(species);
        requirePlayingGame(game);
        target.mpeaceful = 1;
        pet.m_lev = 30;
        pet.mhp = species === 'jackal' ? 24 : 100;

        await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1), count => count, () => 1);

        assert.equal(target.mhp, 100, 'the pet must not initiate melee against this peaceful monster');
    });
}

void test('a pet at one quarter health may still attack an ordinary peaceful monster', async () => {
    const { pet, target } = await meleeRoom('jackal');
    requirePlayingGame(game);
    target.mpeaceful = 1;
    pet.m_lev = 30;
    pet.mhp = 25;

    await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1), count => count, () => 1);

    assert.ok(target.mhp < 100);
});
