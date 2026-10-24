import assert from 'node:assert/strict';
import test from 'node:test';
import { CORPSTAT_INIT, NO_MINVENT } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { createCorpstatAt, mklev, saveBonesLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { CORPSE } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { init_objects } from '../js/o_init.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
function bonesRoom(storage) {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
}
void test('a unique corpse in bones loses its revival and becomes a rotting doppelganger', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    const death = await createMonsterAt('Death', 12, 10, NO_MINVENT);
    await createCorpstatAt(CORPSE, death, death.mnum, 13, 10, CORPSTAT_INIT);
    await removeMonsterFromGame(death);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    pushKeys('yn');
    await mklev();
    const corpse = floorObjects(requireGameLevel()).find(object => object.otyp === CORPSE);
    assert.ok(corpse, 'the unique corpse must remain as ordinary remains');
    assert.equal(corpse.corpsenm, MONSTER_NAME.indexOf('doppelganger'));
    assert.equal(corpse.oextra?.omonst, undefined);
    assert.equal(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON), false);
    assert.equal(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE), true);
});
void test('bones made in wizard mode retain their wizard origin on restoration', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    pushKeys('yn');
    await mklev();
    assert.equal(requireGameLevel().flags.wizard_bones, true);
});
//# sourceMappingURL=bones_reset.test.js.map