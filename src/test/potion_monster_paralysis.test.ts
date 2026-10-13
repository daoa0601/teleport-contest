import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { POT_PARALYSIS } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a potion cannot replace a monster paralysis that already prevents movement', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('dog', game.u.ux + 1, game.u.uy);
    monster.mcanmove = false;
    monster.mfrozen = 60;
    const potion = await knownObject(POT_PARALYSIS);

    await hitMonsterWithSupportedPotion({ monster, potion, publish: async () => {} });

    assert.equal(monster.mfrozen, 60);
});

