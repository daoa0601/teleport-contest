import assert from 'node:assert/strict';
import test from 'node:test';
import { MENU_FULL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPE_FORCE_BOLT, SPE_HEALING } from '../js/object_data.js';
import { forceLearnSpell } from '../js/spell.js';
import { selectSpellToCast } from '../js/spell.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a queued spell letter selects its memorized spell in full menu mode', async () => {
    await freshObjectRoom({ role: 'wizard', moves: 1 });
    forceLearnSpell(SPE_FORCE_BOLT);
    forceLearnSpell(SPE_HEALING);
    game.flags.menu_style = MENU_FULL;
    const input = resetInputState();
    input.queueCommandKeys('b');
    input.feed('\x1b');
    const spell = await selectSpellToCast();
    assert.equal(spell?.otyp, SPE_HEALING);
});
void test('a queued direction cancels spell selection and preserves the following choice', async () => {
    await freshObjectRoom({ role: 'wizard', moves: 1 });
    forceLearnSpell(SPE_FORCE_BOLT);
    const input = resetInputState();
    input.queueCommandResponses([{ dx: 1, dy: 0, dz: 0 }, 97]);
    input.feed('\x1b');
    const spell = await selectSpellToCast();
    assert.equal(spell, null);
    assert.equal(input.takeCommandResponse(), 97);
});
void test('a queued command cancels spell selection and leaves its bundled answer', async () => {
    await freshObjectRoom({ role: 'wizard', moves: 1 });
    forceLearnSpell(SPE_FORCE_BOLT);
    game._cannedCommands = [{ kind: 'wield', invlet: 'q' }];
    const input = resetInputState();
    input.feed('\x1b');
    const spell = await selectSpellToCast();
    assert.equal(spell, null);
    assert.equal(input.takeCommandResponse(), 'q'.charCodeAt(0));
    assert.equal(game._cannedCommands.length, 0);
});
//# sourceMappingURL=spell_canned_selection.test.js.map