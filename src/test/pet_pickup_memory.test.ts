import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { commitPetPickup } from '../js/monmove.js';
import { POT_HEALING } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('completing a visible pet pickup removes the object from remembered terrain', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
    initializePet(dog);
    const potion = await floorObject(POT_HEALING, 12, 10);
    newsym(12, 10);

    await commitPetPickup(dog, { pickedUp: potion, pickupPending: true }, game);
    assert.ok(dog.minvent.includes(potion), 'the pet must pick up the visible potion');
    await makeBlinded(5, { talk: false });
    await flush_screen(1);

    assert.equal(dog.mx, 12);
    assert.equal(dog.my, 10);
    assert.notEqual(requireScreenCell(11, 11).ch, '!');
});
