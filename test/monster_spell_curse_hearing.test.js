import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
void test('a deaf hero cannot hear an unseen caster’s frustrated ranged curse', async () => {
    for (let seed = 1; seed <= 16; seed++) {
        const caster = await prepareSpellCaster('Asmodeus', 30);
        caster.mx = 14;
        caster.mcan = 1;
        game.u.deafTurns = 100;
        const messages = await finishSpellTurn(seed);
        assert.doesNotMatch(messages, /hear a mumbled curse/);
    }
});
//# sourceMappingURL=monster_spell_curse_hearing.test.js.map