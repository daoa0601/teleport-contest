import test from 'node:test';
import assert from 'node:assert/strict';
import { buryObject } from '../js/buried_object.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { set_corpsenm } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { EGG } from '../js/object_data.js';
import { objectTimers, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('changing a buried egg species preserves its organic rot deadline', async () => {
    freshObjectRoom({ gameplaySeed: 170 });
    const egg = placeCreatedObject(await knownObject(EGG, { initialize: false }), 12, 10);
    await buryObject(egg);
    const rot = objectTimers(egg).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_ORGANIC);
    assert.ok(rot, 'a buried organic egg has a decay timer');
    set_corpsenm(egg, MONSTER_NAME.indexOf('newt'));
    assert.equal(objectTimers(egg).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_ORGANIC)?.deadline, rot.deadline);
});
//# sourceMappingURL=mkobj_egg_species.test.js.map