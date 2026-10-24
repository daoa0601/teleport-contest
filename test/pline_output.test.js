import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, pline, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshPlayableRoom } from './support/playable-room.js';
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('oversized messages retain their beginning and final three characters', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const pages = [];
    input.beforeRead = () => {
        pages.push(visibleText());
        input.feed(' ');
    };
    await plineWithContinuation('A warning begins. ' + 'The rumble continues. '.repeat(15)
        + 'This middle detail is discarded. END');
    assert.equal(pages.length, 1);
    assert.match(pages[0] ?? '', /A warning begins\./);
    assert.match(pages[0] ?? '', /\.\.\.END--More--/);
    assert.doesNotMatch(pages[0] ?? '', /middle detail/);
});
void test('a NUL ends a native message before paging or remembering it', async () => {
    freshPlayableRoom();
    await plineWithContinuation('A bell rings.\0The hidden suffix.');
    await plineWithContinuation('A bell rings.', { noRepeat: true });
    await flush_screen(1);
    assert.match(visibleText(), /A bell rings\./);
    assert.doesNotMatch(visibleText(), /hidden suffix|A bell rings\.  A bell rings\./);
});
void test('an empty pline leaves the unread message available', async () => {
    freshPlayableRoom();
    await pline('A bell rings.');
    await pline('');
    await flush_screen(1);
    assert.match(visibleText(), /A bell rings\./);
});
//# sourceMappingURL=pline_output.test.js.map