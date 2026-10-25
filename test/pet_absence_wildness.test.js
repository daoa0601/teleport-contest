import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { catchUpMonster } from '../js/monster_migration.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function separatedPet({ tame, moves, seed }) {
    freshObjectRoom({ moves: 100 });
    initRng(seed);
    const dog = await createMonsterAt('little dog', 11, 10, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.edog.hungrytime = game.moves; // keep the starvation rules out of this.
    dog.mtame = tame;
    catchUpMonster(dog, moves, game);
    return dog;
}
void test('a pet whose absence matches its bond goes untame yet stays peaceful', async () => {
    // Three tameness against three missed taming intervals: the pet cannot
    // out-roll its own wildness, so only the bond is lost.
    const dog = await separatedPet({ tame: 3, moves: 450, seed: 1n });
    assert.ok(!dog.mtame);
    assert.equal(dog.mpeaceful, 1);
});
const dog = await separatedPet({ tame: 1, moves: 1500, seed: 1n });
void test('a weakly bonded pet abandoned for long enough usually turns hostile', async () => {
    const dog = await separatedPet({ tame: 1, moves: 1500, seed: 1n });
    assert.ok(!dog.mtame);
    assert.equal(dog.mpeaceful, 0);
});
void test('a lucky wildness roll leaves a long-abandoned pet merely untame', async () => {
    const dog = await separatedPet({ tame: 1, moves: 1500, seed: 21n });
    assert.ok(!dog.mtame);
    assert.equal(dog.mpeaceful, 1);
});
void test('tameness erodes by one per hundred and fifty missed moves', async () => {
    const dog = await separatedPet({ tame: 10, moves: 450, seed: 1n });
    assert.equal(dog.mtame, 7);
    assert.equal(dog.mpeaceful, 1);
});
//# sourceMappingURL=pet_absence_wildness.test.js.map