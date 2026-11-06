import assert from 'node:assert/strict';
import test from 'node:test';
import { showTextMenuOverlay } from '../js/windows.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { NO_COLOR } from '../js/terminal.js';
import { NOVEL_TITLES } from '../js/do_name.js';
import { SPE_NOVEL } from '../js/object_data.js';
import { readNovel } from '../js/spell.js';
import { addInventoryObject } from './support/game-objects.js';
import { resetInputState } from '../js/input.js';
import { freshPlayableRoom } from './support/playable-room.js';

// C wintty.c:process_text_window() renders putstr()-filled windows without
// the one-column menu padding while the window opens at column zero; only a
// nonzero window origin makes every row gain one leading space. The heading
// of the unpaid-items list ("Unpaid Comestibles") must therefore begin in the
// terminal's first column when menu_overlay is disabled.
void test('putstr windows render rows at the window origin', async () => {
    freshPlayableRoom({ flags: { menu_overlay: false } });
    const display = requireGameDisplay();
    const input = resetInputState();
    const shown = showTextMenuOverlay(['Unpaid Comestibles', ' r - an egg'], { viaPutstr: true });
    await input.waitUntilBlocked();
    const row = (display.grid[0] ?? []).map(cell => cell.ch);
    input.feed(' ');
    await shown;
    assert.equal(row[0], 'U',
        `heading starts in column zero, got ${JSON.stringify(row.slice(0, 3))}`);
    const heading = row.join('').trimEnd();
    assert.ok(heading.startsWith('Unpaid Comestibles'),
        `heading renders from the first column, got ${JSON.stringify(heading)}`);
});

// C wintty.c:tty_display_nhwindow() (H2344_BROKEN) opens a corner window at
// offx = min(min(82, cols/2), cols - maxcol - 1), where tty_putstr() has set
// maxcol = strlen(longest row) + 1; wintty.c:process_text_window() then pads
// every row with one leading space, so the text starts one column past offx.
// A window filled only with putstr() never runs tty_end_menu(), so its maxrow
// is the raw line count (wintty.c:2465); the pager row that tty_end_menu()
// adds for menus (wintty.c:2828) must not grow it, or a passage one row
// shorter than the screen loses its corner placement.
void test('reading a tribute passage draws its rows at C’s corner offset', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const display = requireGameDisplay();
    const input = resetInputState();
    const book = await addInventoryObject(SPE_NOVEL,
        { initialize: false, novelidx: NOVEL_TITLES.indexOf('Interesting Times') });
    // C files.c:choose_passage() reads context.novel; a one-passage pool
    // fixes passage 8 (23 rows, longest row 70 columns) without extra draws.
    game.context.novel = { id: book.o_id, count: 1, pasg: [8] };
    // The overlay keeps everything left of the window origin.
    display.setCell(3, 5, 'M', NO_COLOR, 0);
    const reading = readNovel(book);
    await input.waitUntilBlocked();
    const row0 = (display.grid[0] ?? []).map(cell => cell.ch);
    assert.equal(row0[9], '"',
        `passage text starts in column 9, got ${JSON.stringify(row0.slice(0, 12).join(''))}`);
    assert.equal((display.grid[5]?.[3] ?? {}).ch, 'M',
        'the columns before the window origin keep their content');
    // process_text_window() draws its pager one row past the last passage
    // row, one column past the origin (dmore(), offset 2 from column offx).
    const pager = (display.grid[23] ?? []).map(cell => cell.ch).join('');
    assert.ok(pager.startsWith(`${' '.repeat(9)}--More--`),
        `pager row 23 holds "--More--" in column 9, got ${JSON.stringify(pager)}`);
    assert.deepEqual([display.cursorCol, display.cursorRow], [17, 23]);
    input.feed(' ');
    await reading;
});

// The same rule sends a window whose longest row spans the screen width to
// full-screen mode: cols - maxcol - 1 underflows and the clamp at
// wintty.c:1965 resets offx to zero.
void test('a putstr window whose longest row spans the screen starts in column zero', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    const input = resetInputState();
    const wide = 'x'.repeat(79);
    const shown = showTextMenuOverlay([wide, 'short row'], { viaPutstr: true });
    await input.waitUntilBlocked();
    const row0 = (display.grid[0] ?? []).map(cell => cell.ch);
    assert.equal(row0[0], 'x',
        `a spanning row renders from column zero, got ${JSON.stringify(row0.slice(0, 3).join(''))}`);
    input.feed(' ');
    await shown;
});
