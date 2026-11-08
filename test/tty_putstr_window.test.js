import assert from 'node:assert/strict';
import test from 'node:test';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { showTextWindow } from '../js/wintty.js';
import { freshPlayableRoom } from './support/playable-room.js';
function rowText(index) {
    const row = requireGameDisplay().grid[index];
    return (row ?? []).map(cell => cell.ch).join('');
}
// wintty.c:tty_putstr() buffers every row of an NHW_TEXT window, empty
// rows included, and flushes a page once it holds terminal-height minus
// one rows — so a trailing blank can own a page of its own.
void test('a trailing blank row owns its own text-window page', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const pageSize = requireGameDisplay().grid.length - 1;
    const lines = Array.from({ length: pageSize }, (_, index) => `Line ${index + 1}`);
    const window = showTextWindow([...lines, '']);
    try {
        await input.waitUntilBlocked();
        assert.match(rowText(0), /^Line 1\s*$/, 'the first page starts with its first row');
        assert.match(rowText(pageSize), /--More--/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(rowText(0).trimEnd(), '', 'the blank row leads the second page');
        assert.match(rowText(pageSize), /--More--/);
    }
    finally {
        input.feed(' ');
        await window;
    }
});
// tty_putstr() pages a window that the reader escaped, but the producer
// still runs to completion: pager.c's look lists keep applying their
// observation side effects while the window ignores further rows.
void test('an escaped text window still drains its producer', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    let produced = 0;
    function* lines() {
        for (let index = 0; index < 40; index++) {
            produced++;
            yield `Line ${index + 1}`;
        }
    }
    const window = showTextWindow(lines());
    await input.waitUntilBlocked();
    input.feed('\x1b');
    assert.equal(await window, 27);
    assert.equal(produced, 40, 'every producer row is consumed after Escape');
});
//# sourceMappingURL=tty_putstr_window.test.js.map