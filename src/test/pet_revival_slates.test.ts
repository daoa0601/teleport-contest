import test from 'node:test';
import assert from 'node:assert/strict';
import type { Monster, PetData } from '../js/monster_types.js';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet, makePetWary } from '../js/dog.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function revivedPet(material: (dog: Monster, pet: PetData) => void) {
    freshObjectRoom({ moves: 100 });
    const dog = await createMonsterAt('little dog', 11, 10,
        MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.mtame = 5;
    material(dog, dog.edog);
    await makePetWary(dog, { wasDead: true });
    return dog;
}

async function topMessage(): Promise<string> {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map((cell: { ch: string }) => cell.ch).join('').trimEnd() ?? '';
}

void test('a revived pet keeps a lucky bond and starts a clean feeding slate', async () => {
    const dog = await revivedPet((dog, pet) => {
        pet.abuse = 1;
        pet.hungrytime = 50;
        pet.apport = 3;
        pet.droptime = 42;
        pet.dropdist = 7;
        pet.whistletime = 30;
    });

    assert.equal(dog.mtame, 5);
    assert.equal(dog.mpeaceful, 1);
    assert.ok(dog.edog);
    assert.equal(dog.edog.revivals, 1);
    assert.equal(dog.edog.killed_by_u, 0);
    assert.equal(dog.edog.abuse, 0);
    assert.equal(dog.edog.apport, 5);
    assert.equal(dog.edog.droptime, 0);
    assert.equal(dog.edog.dropdist, 10000);
    assert.equal(dog.edog.whistletime, 0);
    assert.equal(dog.edog.hungrytime, 600);
    // Resurrection is quiet: the hero learns nothing on the topline.
    assert.equal(await topMessage(), '');
});

void test('revival lifts starvation weakness before deciding the bond', async () => {
    const dog = await revivedPet((dog, pet) => {
        pet.mhpmax_penalty = 4;
        dog.mhpmax = 6;
        dog.mhp = 3;
    });

    assert.equal(dog.mhpmax, 10);
    assert.equal(dog.mhp, 7);
    assert.ok(dog.edog);
    assert.equal(dog.edog.mhpmax_penalty, 0);
});

void test('a master-killed pet returns from death untame but not vengeful', async () => {
    const dog = await revivedPet((dog, pet) => {
        pet.killed_by_u = 1;
        pet.abuse = 0;
    });

    assert.ok(!dog.mtame);
    assert.equal(dog.mpeaceful, 1);
    assert.equal(await topMessage(), '');
});

void test('an abused pet rises from death hostile without a farewell', async () => {
    freshObjectRoom({ moves: 100 });
    initRng(1n);
    const dog = await createMonsterAt('little dog', 11, 10,
        MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.mtame = 5;
    dog.edog.abuse = 5;

    await makePetWary(dog, { wasDead: true });

    assert.ok(!dog.mtame);
    assert.equal(dog.mpeaceful, 0);
    assert.equal(await topMessage(), '');
    assert.ok(!game._pending_message);
});
