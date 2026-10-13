import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { buryObject } from '../js/buried_object.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopAllObjectTimers } from '../js/object_timers.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { corpseObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const quiet of [false, true]) {
    void test(`${quiet ? 'stealthy' : 'ordinary'} footsteps ${quiet ? 'leave' : 'hurry'} a nearby buried zombie`, async () => {
        const input = freshTurnRoom({ role: 'caveman' });
        if (quiet)
            grantIntrinsicProperty('stealth', 'outside');
        const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('gnome')), 12, 10);
        await buryObject(corpse);
        stopAllObjectTimers(corpse);
        const deadline = game.moves + 90;
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, deadline);
        input.feed('l');
        await moveloop_core();
        assert.equal(game.u.ux, 11);
        const timer = objectTimers(corpse).find(item => item.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
        assert.ok(timer);
        if (quiet)
            assert.equal(timer.deadline, deadline);
        else
            assert.equal(timer.deadline, deadline - 30);
    });
}
//# sourceMappingURL=hero_tread_corpses.test.js.map