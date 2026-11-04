import assert from 'node:assert/strict';
import test from 'node:test';
import { cmdq_add_ec, cmdq_add_int, rhack } from '../js/cmd.js';
import { CQ_CANNED, CQ_REPEAT, MENU_TRADITIONAL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { DAGGER, SPE_HEALING } from '../js/object_data.js';
import { forceLearnSpell } from '../js/spell.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { planInput } from './support/planned-input.js';
// C invent.c:1776 initializes need_more_cq to FALSE and never changes it.
// An exhausted queue reaches the live loop, which resets cnt/cntgiven
// (invent.c:1917-1918): "cnt = 0L; cntgiven = FALSE;".
void test('a queued count without an object letter falls back to a fresh drop choice', async (t) => {
    const input = freshTurnRoom();
    const daggers = await addInventoryObject(DAGGER, { quan: 4 });
    cmdq_add_ec(CQ_CANNED, 'dodrop');
    cmdq_add_int(CQ_CANNED, 2);
    planInput(input, t, [{ prompt: /What do you want to drop\?/, keys: daggers.invlet }]);
    await rhack(0);
    assert.equal(game.inventory.includes(daggers), false);
    assert.equal(daggers.where, 'floor');
    assert.equal(daggers.quan, 4, 'the live choice starts without the queued count');
    assert.equal(game.context.move, 1);
});
// C pager.c:2676-2686 asks both altmeta questions through yn_function(...,
// TRUE). Its live answer is recorded even during do-again (cmd.c:5542-5543:
// "if (addcmdq) cmdq_add_key(CQ_REPEAT, res);"). The second question then
// consumes that Escape from the repeat queue instead of reading live input.
void test('whatdoes reuses a live Escape for its altmeta question during do-again', async (t) => {
    const input = freshTurnRoom({ flags: { tips: false } });
    game.iflags.altmeta = true;
    cmdq_add_ec(CQ_REPEAT, 'dowhatdoes');
    planInput(input, t, [
        { prompt: /--More--/, keys: ' ' },
        { prompt: /What command\?/, keys: '\x1b' },
    ]);
    await rhack(1);
    assert.match(game._pending_message, /<esc>.*cancel current prompt or pending prefix/);
    assert.equal(game.context.move, 0);
});
// C spell.c:764 uses yn_function(..., TRUE) on every traditional retry.
// cmd.c:5542-5543 records a live answer unconditionally, so after the queue
// runs out, a bad live letter answers the next retry too. A queued answer
// sets "addcmdq = FALSE" (cmd.c:5509), so it is consumed only once.
void test('a traditional spell retry reuses a live answer recorded during do-again', async (t) => {
    const input = freshTurnRoom({ role: 'wizard' });
    forceLearnSpell(SPE_HEALING);
    game.flags.menu_style = MENU_TRADITIONAL;
    cmdq_add_ec(CQ_REPEAT, 'docast');
    planInput(input, t, [
        { prompt: /Cast which spell\?/, keys: 'z' },
        { prompt: /You don't know that spell\.  You don't know that spell\.--More--/, keys: ' ' },
        { prompt: /Cast which spell\?/, keys: '\x1b' },
    ]);
    await rhack(1);
    assert.match(game._pending_message, /Never mind\./);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=command_queue_prompt_fallback.test.js.map