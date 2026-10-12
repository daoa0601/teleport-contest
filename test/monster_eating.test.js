import test from 'node:test';
import assert from 'node:assert/strict';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { M_AP_MONSTER } from '../js/const.js';
import { paralyzeMonster } from '../js/mon.js';
import { cancelMonster } from '../js/monster_cancellation.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('paralysis interrupts a quickmimic meal and preserves the borrowed appearance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 12, 10);
    initializePet(pet, { state: game });
    pet.meating = 5;
    pet.m_ap_type = M_AP_MONSTER;
    pet.mappearance = MONSTER_NAME.indexOf('kitten');
    paralyzeMonster(pet, 3);
    assert.equal(pet.mcanmove, 0);
    assert.equal(pet.mfrozen, 3);
    assert.equal(pet.meating, 0);
    assert.equal(pet.m_ap_type, M_AP_MONSTER);
    assert.equal(pet.mappearance, MONSTER_NAME.indexOf('kitten'));
});
void test('cancellation ends a non-mimic meal and its borrowed appearance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 12, 10);
    initializePet(pet, { state: game });
    pet.meating = 5;
    pet.m_ap_type = M_AP_MONSTER;
    pet.mappearance = MONSTER_NAME.indexOf('kitten');
    await cancelMonster(pet, { attackLevel: 20 });
    assert.equal(pet.mcan, 1);
    assert.equal(pet.meating, 0);
    assert.equal(pet.m_ap_type, 0);
});
//# sourceMappingURL=monster_eating.test.js.map