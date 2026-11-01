import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { movePet } from '../js/dogmove.js';
import { TRIPE_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// Every monster random draw takes a nonzero value so candidate selection is
// driven by distance alone, as C's do/while in dog_move() would mostly be.
const neverZero = (limit: number) => (limit > 1 ? 1 : 0);

// C dogmove.c:dog_goal()/dog_move(): preferred food (dogfood() == DOGFOOD)
// owns the movement goal, so a content pet walks to a tripe ration even
// though that takes it away from its master.
void test('a content pet walks toward preferred food and away from its master', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 14, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.edog.hungrytime = game.moves + 1000;
    await floorObject(TRIPE_RATION, 11, 10);

    const movement = await movePet(dog, game, neverZero, () => 0, () => 1, []);

    assert.equal(movement.moved, true);
    assert.equal(dog.mx, 13, 'the dog advances one square toward the tripe ration');
    assert.equal(dog.my, 10);
    assert.equal(movement.x, 13);
    assert.equal(movement.y, 10);
});

// C dogmove.c:dog_invent(): a pet standing on preferred food starts eating it
// instead of moving; the meal is deferred behind the turn driver.
void test('a pet standing on a tripe ration starts eating it', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 13, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    const tripe = await floorObject(TRIPE_RATION, 13, 10);

    const movement = await movePet(dog, game, neverZero, () => 0, () => 1, []);

    assert.equal(movement.moved, false);
    assert.equal(dog.mx, 13);
    assert.equal(dog.my, 10);
    assert.equal(tripe.where, 'gone');
    assert.equal(dog.meating, 2);
});
