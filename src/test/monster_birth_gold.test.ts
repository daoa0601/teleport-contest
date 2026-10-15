import test from 'node:test';
import assert from 'node:assert/strict';

import { MM_NOMSG } from '../js/const.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a leprechaun birth gives its gold stack the weight of all its coins', async () => {
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ gameplaySeed: seed });

        const leprechaun = await makemonAt(MONSTER_NAME.indexOf('leprechaun'), 12, 10, MM_NOMSG);

        assert.ok(leprechaun);
        const gold = leprechaun.minvent.find(item => item.otyp === GOLD_PIECE);
        assert.ok(gold);
        assert.ok(gold.quan >= 8 && gold.quan <= 240);
        assert.equal(gold.owt, Math.max(1, Math.trunc((gold.quan + 50) / 100)),
            `${gold.quan} coins need their full stack weight`);
    }
});
