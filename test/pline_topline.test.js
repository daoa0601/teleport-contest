import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { pline, plineWithContinuation } from '../js/pline.js';
import { doprevMessage } from '../js/prevmsg.js';
import { displayMessageWindow } from '../js/tty_topline.js';
import { promptKey } from '../js/tty_prompts.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
function topline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('repeated individual messages stay suppressed after tty joins earlier prose', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    await pline('The door opens.');
    await pline('A bell rings.');
    await plineWithContinuation('A bell rings.', { noRepeat: true });
    await flush_screen(1);
    assert.equal(topline(), 'The door opens.  A bell rings.');
    const acknowledgment = displayMessageWindow();
    try {
        await input.waitUntilBlocked();
        assert.equal(topline(), 'The door opens.  A bell rings.--More--');
    }
    finally {
        input.feed(' ');
        await acknowledgment;
    }
    await pline('The echo fades.');
    await flush_screen(1);
    assert.equal(topline(), 'The echo fades.');
    await doprevMessage();
    await doprevMessage();
    assert.equal(topline(), 'The door opens.  A bell rings.');
});
void test('recall keeps joined prose and the answered prompt in their display order', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    await pline('The door opens.');
    await pline('A bell rings.');
    const answer = promptKey('In what direction? ');
    try {
        await input.waitUntilBlocked();
        assert.equal(topline(), 'In what direction?');
    }
    finally {
        input.feed('l');
        await answer;
    }
    await pline('The wand glows.');
    await flush_screen(1);
    assert.equal(topline(), 'The wand glows.');
    await doprevMessage();
    await doprevMessage();
    assert.equal(topline(), 'In what direction? l');
    await doprevMessage();
    assert.equal(topline(), 'The door opens.  A bell rings.');
    await doprevMessage();
    assert.equal(topline(), 'The wand glows.');
});
//# sourceMappingURL=pline_topline.test.js.map