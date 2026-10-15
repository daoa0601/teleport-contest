import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
void test('Double Trouble announces one new Wizard before disguising him', async () => {
    let cloned = false;
    for (let seed = 1; seed <= 64 && !cloned; seed++) {
        await prepareSpellCaster('Wizard of Yendor', 19);
        requirePlayingGame(game);
        game.u.antimagic = true;
        const messages = await finishSpellTurn(seed);
        if (messages.includes('Double Trouble...')) {
            assert.equal(game.context.no_of_wizards, 2);
            assert.equal((messages.match(/Wizard of Yendor suddenly appears/g) ?? []).length, 1, `The constructor should announce the clone once: ${messages}`);
            cloned = true;
        }
    }
    assert.ok(cloned, 'The Wizard should be able to clone himself');
});
//# sourceMappingURL=wizard_clone_spell.test.js.map