import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { ARROW, GOLD_PIECE, POT_HEALING, TIN, TIN_OPENER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';
// C cmd.c:rhack() clears CQ_CANNED and CQ_REPEAT when a command reports
// ECMD_CANCEL or ECMD_FAIL.  dothrow.c:throw_gold() returns ECMD_CANCEL for
// a self-thrown purse, and invent.c:adjust_split() returns ECMD_CANCEL when
// the split count is dismissed, so a following ^A has nothing to repeat
// (cmd.c:do_repeat()).
void test('throwing gold at yourself leaves no command available to repeat', async () => {
    const input = freshTurnRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 33 });
    await answerPrompts(rhack('t'.charCodeAt(0)), input, [
        { prompt: /What do you want to throw\?/, keys: '$' },
        { prompt: /In what direction\?/, keys: '.' },
    ]);
    assert.equal(game._pending_message, 'You cannot throw gold at yourself.');
    assert.equal(game.context.move, 0);
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
void test('dismissing the item-actions split count leaves no command available to repeat', async () => {
    const input = freshTurnRoom();
    const arrows = await addInventoryObject(ARROW, { quan: 5, owornmask: W_WEP });
    game.uwep = arrows;
    await answerPrompts(rhack('*'.charCodeAt(0)), input, [
        { prompt: /Inventory in use/, keys: arrows.invlet ?? 'a' },
        { prompt: /Do what with /, keys: 'I' },
    ]);
    // The chosen item action runs as a queued command in its own dispatch.
    await answerPrompts(rhack(0), input, [
        { prompt: /Split off how many\?/, keys: '\x1b' },
    ]);
    assert.equal(game._pending_message, 'Never mind.');
    assert.equal(game.context.move, 0);
    assert.equal(arrows.quan, 5, 'a dismissed split must not divide the stack');
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.context.move, 0);
});
// A successful command keeps its repeat entry across the same seam.
void test('a quaffed potion stays repeatable', async () => {
    const input = freshTurnRoom();
    const potion = await addInventoryObject(POT_HEALING, { quan: 2 });
    await answerPrompts(rhack('q'.charCodeAt(0)), input, [
        { prompt: /What do you want to drink\?/, keys: potion.invlet ?? 'a' },
    ]);
    assert.equal(game.context.move, 1);
    assert.equal((potion.quan ?? potion.quantity) < 2, true);
    await answerPrompts(rhack('\x01'.charCodeAt(0)), input, []);
    assert.notEqual(game._pending_message, 'There is no command available to repeat.');
    assert.equal(game.inventory.includes(potion), false, 'the repeat drinks the second potion');
});
// eat.c:use_tin_opener() returns res|ECMD_CANCEL when the tin prompt is
// declined; res is ECMD_TIME once the opener has been wielded, and that bit
// keeps the elapsed turn despite the cancellation (cmd.c:3819).
void test('cancelling the tin prompt after wielding the opener keeps the turn and clears recall', async () => {
    const input = freshTurnRoom();
    await addInventoryObject(TIN);
    const opener = await addInventoryObject(TIN_OPENER);
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /What do you want to use or apply\?/, keys: opener.invlet ?? 'a' },
        { prompt: /You now wield/, keys: ' ' },
        { prompt: /What do you want to open\?/, keys: '\x1b' },
    ]);
    assert.equal(game.uwep, opener, 'the opener stays wielded');
    assert.equal(game.context.move, 1, 'the wield keeps its turn');
    input.feed('\x01');
    await rhack(0);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
});
//# sourceMappingURL=command_repeat_cancel_results.test.js.map