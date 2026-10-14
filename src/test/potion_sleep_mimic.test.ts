import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_OBJECT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { BOULDER, POT_SLEEPING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('sleeping potion reveals a mimic even when the mimic resists sleep', async () => {
    freshObjectRoom();
    const mimic = await createMonsterAt('small mimic', game.u.ux + 1, game.u.uy);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = BOULDER;
    mimic.defendedSleep = true;
    const potion = await knownObject(POT_SLEEPING);

    await hitMonsterWithSupportedPotion({ monster: mimic, potion, publish: async () => {} });

    assert.equal(mimic.m_ap_type, 0);
    assert.equal(mimic.mappearance, 0);
    assert.equal(mimic.mcanmove, 1);
});
