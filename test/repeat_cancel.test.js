import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { freshTurnRoom } from './support/playable-room.js';
function toplineText() {
    return (game.nhDisplay?.grid[0] ?? []).map(cell => cell.ch).join('').trimEnd();
}
// C engrave.c:doengrave() reports ECMD_CANCEL when the stylus prompt is
// refused; rhack() then clears CQ_REPEAT, so ^A cannot repeat the engraving.
void test('an escape-cancelled engraving leaves no command to repeat', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    input.feed('E\x1b');
    await moveloop_core();
    input.feed('\x01');
    await rhack(0);
    assert.match(game._pending_message ?? '', /There is no command available to repeat\./);
});
void test('the empty-repeat complaint does not repeat itself', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    input.feed('\x01');
    await rhack(0);
    input.feed('\x01');
    await rhack(0);
    const copies = (game._toplines.match(/There is no command/g) ?? []).length;
    assert.equal(copies, 1, `Norep() suppresses the second complaint, saw ${copies}`);
});
//# sourceMappingURL=repeat_cancel.test.js.map