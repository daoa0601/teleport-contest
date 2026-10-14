import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { POT_ENLIGHTENMENT } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an enlightenment bottle shatters against a monster without a magical effect', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('dog', game.u.ux + 1, game.u.uy);
    const potion = await knownObject(POT_ENLIGHTENMENT);
    const hp = monster.mhp;

    await hitMonsterWithSupportedPotion({ monster, potion, publish: async () => {} });

    assert.equal(potion.where, 'gone');
    assert.ok(monster.mhp === hp || monster.mhp === hp - 1);
});

