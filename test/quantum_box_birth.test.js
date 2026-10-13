import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, LARGE_BOX } from '../js/object_data.js';
import { objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { objectWeight } from '../js/weight.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a quantum mechanic carries a sealed box owning a correctly weighted, undecayed cat', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    initRng(37n);
    const mechanic = await createMonsterAt('quantum mechanic', 12, 10);
    const box = mechanic.minvent.find(object => object.otyp === LARGE_BOX && object.spe === 1);
    assert.ok(box, 'this birth must give the quantum mechanic a sealed cat box');
    const cat = box.contents?.[0];
    assert.ok(cat);
    assert.equal(cat.otyp, CORPSE);
    assert.equal(cat.corpsenm, MONSTER_NAME.indexOf('housecat'));
    assert.equal(cat.owt, objectWeight(cat));
    assert.equal(cat.where, 'contained');
    assert.equal(cat.container === box, true);
    assert.equal(objectTimers(cat).length, 0);
    assert.equal(box.owt, objectWeight(box));
});
//# sourceMappingURL=quantum_box_birth.test.js.map