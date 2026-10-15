import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
void test('a cancelled caster curses toward a temporarily invisible hero’s apparent position', async () => {
    let misplaced = false;
    for (let seed = 1; seed <= 32 && !misplaced; seed++) {
        const caster = await prepareSpellCaster('kobold shaman', 3);
        requirePlayingGame(game);
        caster.permspeed = MFAST;
        caster.mcan = 1;
        caster.mux = 0;
        caster.muy = 0;
        game.u.invisibleTurns = 100;
        const messages = await finishSpellTurn(seed);
        if ((caster.mux !== game.u.ux || caster.muy !== game.u.uy) && /points/.test(messages)) {
            assert.match(messages, /points and curses in your general direction\./);
            misplaced = true;
        }
    }
    assert.ok(misplaced, 'An invisible hero should sometimes evade the caster’s targeting');
});
//# sourceMappingURL=monster_spell_invisibility.test.js.map