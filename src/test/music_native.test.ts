import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MAGIC_FLUTE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('an applied magic flute puts a grabbing monster into wakeable sleep and releases its grip', async () => {
    const input = freshTurnRoom({ heroLevel: 5 });
    const owlbear = await createMonsterAt('owlbear', 11, 10);
    game.u.ustuck = owlbear;
    const flute = await addInventoryObject(MAGIC_FLUTE, { spe: 2 });
    installPagerInput(input, { expected: /playing|music|grip relaxes/, limit: 8 });
    pushKeys(`a${flute.invlet}y`);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|music|grip relaxes|^$/);

    assert.equal(flute.spe, 1);
    assert.equal(owlbear.msleeping, 1);
    assert.equal(owlbear.mcanmove, 0);
    assert.ok((owlbear.mfrozen ?? 0) > 0);
    assert.equal(game.u.ustuck, null);
});
