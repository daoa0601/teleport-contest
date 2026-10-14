import test from 'node:test';
import assert from 'node:assert/strict';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { LEASH } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('leashing a named pet describes its species and its given name', async () => {
    freshPlayableRoom();
    const kitten = await createMonsterAt('kitten', game.u.ux + 1, game.u.uy);
    initializePet(kitten);
    setMonsterGivenName(kitten, 'Pip');
    const leash = await addInventoryObject(LEASH);
    await applyInventoryObject(leash, 'l');
    assert.equal(game._pending_message, 'You slip the leash around your kitten called Pip.');
    assert.equal(leash.leashmon, kitten.m_id);
});
//# sourceMappingURL=leash_named_pet.test.js.map