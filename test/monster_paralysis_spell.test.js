import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
for (const freeAction of [false, true]) {
    void test(`clerical paralysis preserves a longer sleep${freeAction ? ' despite free action' : ''}`, async () => {
        let cast = false;
        for (let seed = 1; seed <= 64 && !cast; seed++) {
            await prepareSpellCaster('aligned cleric', 6);
            game.u.freeAction = freeAction;
            putHeroToSleep(80);
            game.multi = -80;
            const messages = await finishSpellTurn(seed);
            if (game._helplessReason === 'paralyzed by a monster') {
                assert.ok((game._helplessTurns ?? 0) >= 79, 'A spell cannot shorten an existing involuntary delay');
                assert.doesNotMatch(messages, /stiffen briefly|frozen in place/, 'Native paralysis feedback is suppressed while already helpless');
                cast = true;
            }
        }
        assert.ok(cast, 'The cleric should cast paralysis at a sleeping hero');
    });
}
//# sourceMappingURL=monster_paralysis_spell.test.js.map