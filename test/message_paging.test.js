import test from 'node:test';
import assert from 'node:assert/strict';
import { flushPendingTopline, flush_screen, moreUntilDismissed, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshPlayableRoom } from './support/playable-room.js';
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('a forced message pause wraps long text without clipping its pager', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    const paging = moreUntilDismissed('A distant rumble grows louder as the ceiling cracks. '.repeat(2));
    try {
        await input.waitUntilBlocked();
        const display = requireGameDisplay();
        const rows = display.grid.map(row => row.map(cell => cell.ch).join(''));
        const markerRow = rows.findIndex(row => row.includes('--More--'));
        assert.ok(markerRow > 0, 'A complete pager must follow the wrapped warning');
        assert.equal(display.cursorRow, markerRow);
        assert.ok(display.cursorCol < display.cols, 'The pager cursor must stay inside the terminal');
    }
    finally {
        input.feed(' ');
        await paging;
    }
});
void test('More moves to its own row when it would reach the final terminal column', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('The passage ends here.'.padEnd(72, '.'));
    const paging = flushPendingTopline();
    try {
        await input.waitUntilBlocked();
        assert.equal(requireGameDisplay().grid[1]?.slice(0, 8).map(cell => cell.ch).join(''), '--More--');
        assert.equal(requireGameDisplay().cursorCol, 8);
        assert.equal(requireGameDisplay().cursorRow, 1);
    }
    finally {
        input.feed(' ');
        await paging;
    }
});
void test('an explicit newline owns a message acknowledgment even when the text is short', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    const writing = plineWithContinuation('Beware.\nThe floor is weak.');
    try {
        const state = await Promise.race([
            input.waitUntilBlocked().then(() => 'waiting'),
            writing.then(() => 'finished'),
        ]);
        assert.equal(state, 'waiting');
        assert.match(visibleText(), /The floor is weak\.--More--/);
    }
    finally {
        input.feed(' ');
        await writing;
    }
});
void test('an oversized word wraps before the terminal final column', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    const writing = plineWithContinuation('M'.repeat(90));
    try {
        await input.waitUntilBlocked();
        const rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trimEnd());
        assert.equal(rows[0]?.length, 79);
        assert.equal(rows[1], 'M'.repeat(11) + '--More--');
    }
    finally {
        input.feed(' ');
        await writing;
    }
});
void test('an urgent message ends Escape suppression and clears the old topline', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('A distant bell rings.');
    input.feed('\x1b');
    await flushPendingTopline();
    await plineWithContinuation('An ordinary sound follows.');
    await plineWithContinuation('The dungeon is collapsing!', { urgent: true });
    await plineWithContinuation('Run!');
    await flush_screen(1);
    assert.match(visibleText(), /The dungeon is collapsing!  Run!/);
    assert.doesNotMatch(visibleText(), /A distant bell|An ordinary sound/);
});
void test('Escape at the previous message pager cannot suppress an urgent message or its follow-up', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('The warning echoes through every room and corridor in the dungeon.');
    input.feed('\x1b');
    await plineWithContinuation('The dungeon is collapsing!', { urgent: true });
    await plineWithContinuation('Run!');
    await flush_screen(1);
    assert.match(visibleText(), /The dungeon is collapsing!  Run!/);
});
void test('Escape at a wrapped urgent message does not suppress the next message', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('\x1b');
    await plineWithContinuation('The warning echoes through every room and corridor in the dungeon. The ceiling is falling!', { urgent: true });
    await plineWithContinuation('Run for the stairs!');
    await flush_screen(1);
    assert.match(visibleText(), /Run for the stairs!/);
});
void test('urgent output bypasses no-repeat suppression', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    await plineWithContinuation('Run!');
    await plineWithContinuation('Run!', { noRepeat: true, urgent: true });
    await flush_screen(1);
    assert.match(visibleText(), /Run!  Run!/);
});
void test('ordinary messages still stop after Escape at More', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('A distant bell rings.');
    input.feed('\x1b');
    await flushPendingTopline();
    await plineWithContinuation('An ordinary sound follows.');
    await flush_screen(1);
    assert.doesNotMatch(visibleText(), /An ordinary sound follows/);
});
void test('an urgent message can page both old text and its own wrapped text after Escape', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('The warning echoes through every room and corridor in the dungeon.');
    const pages = [];
    input.beforeRead = () => {
        pages.push(visibleText());
        input.feed('\x1b');
    };
    await plineWithContinuation('The ceiling is falling! Huge stones crash into every room and corridor throughout the dungeon.', { urgent: true });
    await plineWithContinuation('Run for the stairs!');
    await flush_screen(1);
    assert.ok(pages.some(page => page.includes('The warning echoes') && page.includes('--More--')));
    assert.ok(pages.some(page => page.includes('The ceiling is falling!') && page.includes('--More--')));
    assert.match(visibleText(), /Run for the stairs!/);
});
void test('empty urgent output does not end Escape suppression', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('A distant bell rings.');
    input.feed('\x1b');
    await flushPendingTopline();
    await plineWithContinuation('', { urgent: true });
    await plineWithContinuation('An ordinary sound follows.');
    await flush_screen(1);
    assert.doesNotMatch(visibleText(), /An ordinary sound follows/);
});
//# sourceMappingURL=message_paging.test.js.map