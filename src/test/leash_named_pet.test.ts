import { inventoryActionForObject } from '../js/iactions.js';
import { resetInputState } from '../js/input.js';
import { planInput } from './support/planned-input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { setMonsterGivenName } from '../js/do_name.js';
import { LEASH } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('leashing a named pet describes its species and its given name', async t => {
    freshPlayableRoom();
    const kitten = await createMonsterAt('kitten', game.u.ux + 1, game.u.uy);
    initializePet(kitten);
    setMonsterGivenName(kitten, 'Pip');
    const leash = await addInventoryObject(LEASH);

    planInput(resetInputState(), t, [{ prompt: /Attach this leash to a pet/, keys: '\x1b' }]);
    await inventoryActionForObject(leash);

    await applyInventoryObject(leash, 'l');

    assert.equal(game._pending_message, 'You slip the leash around your kitten called Pip.');
    assert.equal(leash.leashmon, kitten.m_id);
    planInput(resetInputState(), t, [
        { prompt: /You slip the leash around your kitten called Pip.*--More--/, keys: ' ' },
        { prompt: /Detach this leash from Pip/, keys: '\x1b' },
    ]);
    await inventoryActionForObject(leash);
});
