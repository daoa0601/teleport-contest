import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('an empty earthquake drum wakes an adjacent monster without frightening it', async () => {
    const input = freshTurnRoom();
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mpeaceful = 1;
    goblin.msleeping = 1;
    const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 0 });
    installPagerInput(input, { expected: /playing|butcher|manage|pull off|flee/, limit: 8 });
    pushKeys(`a${drum.invlet}`);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|butcher|manage|pull off|flee|^$/);

    assert.equal(goblin.msleeping, 0);
    assert.equal(Boolean(goblin.mflee), false);
});
