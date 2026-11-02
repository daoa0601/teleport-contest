import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/do_wear.js';

import { game } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { RIN_FREE_ACTION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';

for (const freeAction of [false, true]) {
    void test(`clerical paralysis preserves a longer sleep${freeAction ? ' despite free action' : ''}`, async () => {
        let cast = false;
        for (let seed = 1; seed <= 64 && !cast; seed++) {
            await prepareSpellCaster('aligned cleric', 6);
            if (freeAction) await wearHeroAccessory(await addInventoryObject(RIN_FREE_ACTION), 'uleft');
            await putHeroToSleep(80);
            game.multi = -80;

            const messages = await finishSpellTurn(seed);

            if (game._helplessReason === 'paralyzed by a monster') {
                assert.ok((game._helplessTurns ?? 0) >= 79, 'A spell cannot shorten an existing involuntary delay');
                assert.doesNotMatch(messages, /stiffen briefly|frozen in place/,
                    'Native paralysis feedback is suppressed while already helpless');
                cast = true;
            }
        }
        assert.ok(cast, 'The cleric should cast paralysis at a sleeping hero');
    });
}
