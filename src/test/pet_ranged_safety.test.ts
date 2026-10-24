import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { bestPetRangedTarget } from '../js/dogmove.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { createMonsterAt } from './support/monsters.js';
import { freshRangedCombatRoom } from './support/ranged-combat.js';

const BIRTH_FLAGS = MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;

async function rangedRoom() {
    freshRangedCombatRoom({ recalculateVision: true });
    const pet = await createMonsterAt('winter wolf', 10, 10, BIRTH_FLAGS);
    initializePet(pet);
    const target = await createMonsterAt('orc-captain', 13, 10, BIRTH_FLAGS);
    target.mpeaceful = 0;
    target.mhp = target.mhpmax = 100;
    return { pet, target };
}

void test('a pet avoids a ranged target with an allied long-worm tail behind it', async () => {
    const { pet } = await rangedRoom();
    requirePlayingGame(game);
    const friend = await createMonsterAt('long worm', 16, 11, BIRTH_FLAGS);
    initializePet(friend);
    initializeMonsterWormBody(friend, { segmentCount: 0 });
    friend.wormSegments = [{ x: 15, y: 10 }, { x: 16, y: 10 }];

    assert.equal(bestPetRangedTarget(pet, game), null);
});

void test('a hostile long-worm tail does not hide a ranged target farther along the line', async () => {
    const { pet, target } = await rangedRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 12, 11, BIRTH_FLAGS);
    worm.mpeaceful = 0;
    initializeMonsterWormBody(worm, { segmentCount: 0 });
    worm.wormSegments = [{ x: 11, y: 10 }, { x: 12, y: 10 }];

    assert.equal(bestPetRangedTarget(pet, game), target);
});

for (const { description, tame, invisible, protects } of [
    { description: 'protects a visible untamed guardian', tame: false, invisible: false, protects: true },
    { description: 'protects an invisible untamed guardian', tame: false, invisible: true, protects: true },
    { description: 'protects a visible tame guardian', tame: true, invisible: false, protects: true },
    { description: 'overlooks an invisible tame guardian', tame: true, invisible: true, protects: false },
]) {
    void test(`a pet ${description} behind its ranged target`, async () => {
        const { pet, target } = await rangedRoom();
        requirePlayingGame(game);
        const guardian = await createMonsterAt('Student', 15, 10, BIRTH_FLAGS);
        if (tame) initializePet(guardian);
        guardian.minvis = invisible;

        assert.equal(bestPetRangedTarget(pet, game), protects ? null : target);
    });
}
