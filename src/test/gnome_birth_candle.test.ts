import test from 'node:test';
import assert from 'node:assert/strict';

import { MM_NOMSG } from '../js/const.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { TALLOW_CANDLE, WAX_CANDLE } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { freshObjectRoom } from './support/object-room.js';

for (const lit of [false, true]) {
    void test(`a gnome born on ${lit ? 'lit' : 'dark'} terrain has a ${lit ? 'stored' : 'burning'} candle`, async () => {
        for (let seed = 1; seed <= 256; seed++) {
            const level = freshObjectRoom({ gameplaySeed: seed });
            level.requireAt(12, 10).lit = lit;

            const gnome = await makemonAt(MONSTER_NAME.indexOf('gnome'), 12, 10, MM_NOMSG);

            assert.ok(gnome);
            const candle = gnome.minvent.find(item => [TALLOW_CANDLE, WAX_CANDLE].includes(item.otyp));
            if (!candle) continue;
            assert.equal(candle.quan, 1);
            assert.equal(candle.owt, 2);
            assert.equal(!!candle.lamplit, !lit);
            assert.equal(objectTimers(candle).some(timer => timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT), !lit,
                'a burning birth candle must consume fuel through the normal burn timer');
            return;
        }
        assert.fail('a gnome should sometimes carry a candle');
    });
}
