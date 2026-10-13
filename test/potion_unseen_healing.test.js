import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { POT_FULL_HEALING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('healing an invisible monster does not reveal its recovered health or sight', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('dog', game.u.ux + 1, game.u.uy);
    monster.minvis = true;
    monster.mhp = 2;
    monster.mhpmax = 20;
    monster.mcansee = 0;
    monster.mblinded = 10;
    const potion = await knownObject(POT_FULL_HEALING);
    const messages = [];
    await hitMonsterWithSupportedPotion({ monster, potion,
        publish: async (message) => { messages.push(message); } });
    assert.equal(monster.mhp, 20);
    assert.equal(monster.mcansee, 1);
    assert.equal(messages.some(message => /looks sound|can see again/.test(message)), false);
});
//# sourceMappingURL=potion_unseen_healing.test.js.map