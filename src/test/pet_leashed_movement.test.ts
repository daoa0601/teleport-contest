import assert from 'node:assert/strict';
import test from 'node:test';
import { DART_TRAP, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMove, resumeDeferredPetEating } from '../js/monmove.js';
import { DAGGER, LEASH, TRIPE_RATION } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function leashDog(x = 12) {
    const level = freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', x, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.edog.whistletime = game.moves;
    dog.mleashed = 1;
    await addInventoryObject(LEASH, { leashmon: dog.m_id });
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return { dog, level };
}

void test('a leash leads a pet over a cursed item without the ordinary avoidance chance', async () => {
    const { dog } = await leashDog();
    requirePlayingGame(game);
    await floorObject(DAGGER, 11, 10, { cursed: true });

    const action = await beginMonsterMove(dog, game, limit => Math.min(1, limit - 1));

    assert.equal(dog.mx, 11);
    assert.equal(action.movement.reluctant, true);
});

void test('a leashed dog whines when its route crosses a harmful trap', async () => {
    const { dog, level } = await leashDog();
    requirePlayingGame(game);
    addTrap(level, DART_TRAP, 11, 10, { tseen: false });

    await beginMonsterMove(dog, game, limit => Math.min(1, limit - 1));

    assert.match(game._lastPlineMessage ?? '', /little dog whines\./);
    assert.equal(dog.mx, 11);
});

void test('a leashed pet finishes its meal before the leash draws it beside the hero', async () => {
    const { dog } = await leashDog(13);
    requirePlayingGame(game);
    const food = await floorObject(TRIPE_RATION, 13, 10);

    const action = await beginMonsterMove(dog, game);
    await resumeDeferredPetEating(action, game);

    assert.equal(food.where, 'gone');
    assert.deepEqual([dog.mx, dog.my], [11, 10]);
    assert.equal(dog.mleashed, 1);
});
