import assert from 'node:assert/strict';
import test from 'node:test';
import { showTextMenuOverlay } from '../js/windows.js';
import { requireGameDisplay } from '../js/gstate.js';
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
