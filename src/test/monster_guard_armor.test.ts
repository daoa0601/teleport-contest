import test from 'node:test';
import assert from 'node:assert/strict';

import { armorBonus, armorSlotFor } from '../js/armor.js';
import { TIN_WHISTLE } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('vault guards stop receiving optional armor once their earlier armor is sufficient', async () => {
    let adequatelyArmored = 0;
    for (let seed = 1; seed <= 128; seed++) {
        freshObjectRoom({ gameplaySeed: seed });

        const guard = await createMonsterAt('guard', 13, 10);

        const earlyProtection = guard.minvent.reduce((bonus, object) => {
            const slot = armorSlotFor(object.otyp);
            return bonus + (slot === 'uarm' || slot === 'uarmh' || slot === 'uarms'
                ? armorBonus(object) : 0);
        }, -1);
        if (earlyProtection < 10) continue;
        adequatelyArmored++;
        assert.equal(guard.minvent.some(object => {
            const slot = armorSlotFor(object.otyp);
            return slot === 'uarmf' || slot === 'uarmg' || slot === 'uarmc';
        }), false, `guard received unnecessary later armor at seed ${seed}`);
    }
    assert.ok(adequatelyArmored > 0, 'births exercise the armor stopping condition');
});

void test('every equipped vault guard carries a cursed tin whistle', async () => {
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ gameplaySeed: seed });

        const guard = await createMonsterAt('guard', 13, 10);

        assert.ok(guard.minvent.some(object => object.otyp === TIN_WHISTLE && object.cursed),
            `guard lacks its cursed whistle at seed ${seed}`);
    }
});
