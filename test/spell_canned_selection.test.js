import assert from 'node:assert/strict';
import test from 'node:test';
import { CMDQ_KEY, CQ_CANNED, MENU_FULL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { cmdq_add_ec, cmdq_add_key, cmdq_clear, cmdq_pop } from '../js/cmd.js';
import { SPE_FORCE_BOLT, SPE_HEALING } from '../js/object_data.js';
import { forceLearnSpell } from '../js/spell.js';
import { selectSpellToCast } from '../js/spell.js';
import { freshObjectRoom } from './support/object-room.js';
import { queueCannedDir, queueCannedKeys } from './support/canned-input.js';
void test('a queued spell letter selects its memorized spell in full menu mode', async () => {
    await freshObjectRoom({ role: 'wizard', moves: 1 });
    forceLearnSpell(SPE_FORCE_BOLT);
    forceLearnSpell(SPE_HEALING);
    game.flags.menu_style = MENU_FULL;
    const input = resetInputState();
    queueCannedKeys('b');
    input.feed('\x1b');
    const spell = await selectSpellToCast();
    assert.equal(spell?.otyp, SPE_HEALING);
});
void test('a queued direction cancels spell selection and preserves the following choice', async () => {
    await freshObjectRoom({ role: 'wizard', moves: 1 });
    forceLearnSpell(SPE_FORCE_BOLT);
    const input = resetInputState();
    queueCannedDir(1, 0);
    queueCannedKeys('a');
    input.feed('\x1b');
    const spell = await selectSpellToCast();
    assert.equal(spell, null);
    const leftover = cmdq_pop();
    assert.equal(leftover?.typ === CMDQ_KEY ? leftover.key : undefined, 'a'.charCodeAt(0));
});
void test('a queued command cancels spell selection and leaves its bundled answer', async () => {
    await freshObjectRoom({ role: 'wizard', moves: 1 });
    forceLearnSpell(SPE_FORCE_BOLT);
    cmdq_clear(CQ_CANNED);
    cmdq_add_ec(CQ_CANNED, 'dowield');
    cmdq_add_key(CQ_CANNED, 'q'.charCodeAt(0));
    const input = resetInputState();
    input.feed('\x1b');
    const spell = await selectSpellToCast();
    assert.equal(spell, null);
    const leftover = cmdq_pop();
    assert.equal(leftover?.typ === CMDQ_KEY ? leftover.key : undefined, 'q'.charCodeAt(0));
    assert.equal(game.command_queue[CQ_CANNED].length, 0);
});
//# sourceMappingURL=spell_canned_selection.test.js.map