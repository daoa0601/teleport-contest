import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, W_ARM, W_WEP } from '../js/const.js';
import { monsterHasDrainResistance } from '../js/monster_resistance.js';
import { BLACK_DRAGON_SCALES } from '../js/object_data.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('wielding Excalibur protects a living monster from life drain', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    assert.equal(monsterHasDrainResistance(monster), false);
    await equipMonsterObject(monster, await artifactObject('Excalibur'), W_WEP);
    assert.equal(monsterHasDrainResistance(monster), true);
});
void test('an adult dragon uses its own scales for life-drain defense', async () => {
    freshObjectRoom();
    const dragon = await createMonsterAt('red dragon', 12, 10, NO_MINVENT);
    await equipMonsterObject(dragon, await knownObject(BLACK_DRAGON_SCALES), W_ARM);
    assert.equal(monsterHasDrainResistance(dragon), false);
});
//# sourceMappingURL=mondata_drain.test.js.map