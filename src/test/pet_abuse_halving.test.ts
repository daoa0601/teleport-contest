import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { abusePet, initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { RIN_CONFLICT } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('conflicted abuse halves a pet\'s bond instead of shaving it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 11, 10,
        MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.mtame = 10;
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');

    assert.equal(await abusePet(dog), true);

    assert.equal(dog.mtame, 5);
    assert.equal(dog.edog.abuse, 1);
});
