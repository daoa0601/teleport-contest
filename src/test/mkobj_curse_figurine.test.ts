import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { curseObject, uncurseObjectState } from '../js/object_state.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { FIGURINE } from '../js/object_data.js';
import { objectTimers, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('cursing a carried figurine starts transformation, and uncursing stops it', async () => {
    freshObjectRoom();
    const figurine = await addInventoryObject(FIGURINE, {
        corpsenm: MONSTER_NAME.indexOf('newt'), cursed: false,
    });

    await curseObject(figurine);

    const timer = objectTimers(figurine).find(timer => timer.kind === OBJECT_TIMER_KIND.FIG_TRANSFORM);
    assert.ok(timer, 'cursing the figurine starts its transformation timer');
    assert.ok(timer.deadline >= game.moves + 201 && timer.deadline <= game.moves + 9200);
    uncurseObjectState(figurine);
    assert.equal(objectTimers(figurine).length, 0);
});
