import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CORPSE, ICE_BOX } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers, stopAllObjectTimers } from '../js/object_timers.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('removing a corpse initially stored in an ice box restores its actual age and rot timer', async () => {
    freshPlayableRoom();
    const box = await addInventoryObject(ICE_BOX, {
        invlet: 'a', initialize: false, olocked: false, cknown: true,
    });
    const corpse = await knownObject(CORPSE, { where: 'contained', container: box, corpsenm: 0, age: 7 });
    stopAllObjectTimers(corpse);
    box.contents = [corpse];
    game.moves = 100;

    await applyInventoryObject(box, 'oa\n');

    assert.equal(corpse.age, 93);
    assert.equal(corpse.norevive, true);
    assert.ok(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
});
