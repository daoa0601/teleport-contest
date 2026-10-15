import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT, BEAR_TRAP, PIT, STONE } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const seen of [false, true]) {
    void test(`a pet caught in a ${seen ? 'known' : 'hidden'} bear trap cannot swap places`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        const dog = await createMonsterAt('little dog', 11, 10, MM_NOGRP | NO_MINVENT);
        initializePet(dog);
        dog.mtrapped = 1;
        const trap = addTrap(level, BEAR_TRAP, 11, 10, { tseen: seen });
        initRng(1n);
        pushKeys(' '.repeat(20));

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, dog.mx], [10, 11]);
        assert.equal(game.context.move, 1);
        assert.equal(dog.mtrapped, 1);
        assert.equal(trap.tseen, true);
        assert.equal(game._pending_message,
            `You stop.  Your little dog can't move out of ${seen ? 'that' : 'a'} bear trap.`);
    });
}

void test('a grid bug pet cannot swap places diagonally', async () => {
    freshObjectRoom();
    const bug = await createMonsterAt('grid bug', 11, 9, MM_NOGRP | NO_MINVENT);
    initializePet(bug);
    initRng(1n);
        pushKeys(' '.repeat(20));

    await rhack('u'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy, bug.mx, bug.my], [10, 10, 11, 9]);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, "You stop.  Your grid bug can't move diagonally.");
});

void test('a large pet cannot squeeze diagonally between two rock shoulders', async () => {
    const level = freshObjectRoom();
    const horse = await createMonsterAt('horse', 11, 9, MM_NOGRP | NO_MINVENT);
    initializePet(horse);
    level.requireAt(10, 9).typ = STONE;
    level.requireAt(11, 10).typ = STONE;
    initRng(1n);
        pushKeys(' '.repeat(20));

    await rhack('u'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy, horse.mx, horse.my], [10, 10, 11, 9]);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, "You stop.  Your horse won't fit through.");
});

for (const species of ['Oracle', 'aligned cleric']) {
    void test(`the peaceful ${species} refuses displacement`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
        monster.mpeaceful = 1;
        if (species === 'aligned cleric') monster.ispriest = 1;
        initRng(2n);
        pushKeys(' '.repeat(20));

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, monster.mx], [10, 11]);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /doesn't want to swap places\./);
    });
}

void test('a pet with a stale trapped flag can swap places when its trap is gone', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10, MM_NOGRP | NO_MINVENT);
    initializePet(dog);
    dog.mtrapped = 1;
    initRng(1n);
        pushKeys(' '.repeat(20));
    pushKeys(' '.repeat(5));

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, dog.mx], [11, 10]);
    assert.equal(dog.mtrapped, 0);
});

void test('a pet refuses to move onto a trap under the hero', async () => {
    const level = freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10, MM_NOGRP | NO_MINVENT);
    initializePet(dog);
    addTrap(level, PIT, 10, 10, { tseen: true });
    initRng(1n);
        pushKeys(' '.repeat(20));

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, dog.mx], [10, 11]);
    assert.match(game._pending_message, /doesn't want to swap places\./);
});
