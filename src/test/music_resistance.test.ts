import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { pushKeys } from '../js/input.js';
import { MAGIC_FLUTE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('a drained player monster retains the hero-level defense against instrument magic', async () => {
    const input = freshTurnRoom({ heroLevel: 30 });
    const knight = await createMonsterAt('knight', 11, 10, NO_MINVENT);
    knight.m_lev = 0;
    knight.mpeaceful = 1;
    const flute = await addInventoryObject(MAGIC_FLUTE, { spe: 2 });
    installPagerInput(input, { expected: /playing|music/, limit: 8 });
    initRng(35n);
    pushKeys(`a${flute.invlet}y`);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|music|^$/);

    assert.equal(knight.msleeping, 0);
    assert.equal(knight.mcanmove, 1);
});
