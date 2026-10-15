import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST } from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
void test('temporary see invisible reveals a monster speeding itself up', async () => {
    let hasted = false;
    for (let seed = 1; seed <= 32 && !hasted; seed++) {
        const caster = await prepareSpellCaster('kobold shaman', 3);
        caster.minvis = 1;
        game.u.seeInvisibleTurns = 100;
        const messages = await finishSpellTurn(seed);
        if (caster.permspeed === MFAST) {
            assert.match(messages, /invisible kobold shaman is suddenly moving faster/);
            hasted = true;
        }
    }
    assert.ok(hasted, 'The shaman should cast haste self');
});
//# sourceMappingURL=monster_haste_spell.test.js.map