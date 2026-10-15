import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { ROCK } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('scattering clears a monster caught at the blast origin', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('soldier', 14, 10);
    monster.mtrapped = 1;
    await floorObject(ROCK, 14, 10);

    await scatterFloorObjects(14, 10, 1, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
    });

    assert.equal(monster.mtrapped, 0);
});
