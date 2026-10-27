// C refs: insight.c show_gamelog() (`display_nhwindow(win, TRUE);
// destroy_nhwindow(win)`) and win/tty/wintty.c erase_menu_or_text(), whose
// full-width path runs docrt() + flush_screen(1).  docrt() queues botlx, so
// the closing flush paints the status line fresh — including the turn
// counter — and puts the cursor back on the hero.  A turn whose counter was
// still unpainted (allmain.c suppresses time_botl while context.run != 0)
// becomes visible at that boundary.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { recordAchievement } from '../js/achievements.js';
import { ACH_SHOP } from '../js/const.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
import { showTextWindow } from '../js/windows.js';
void test('a streaming text window keeps its page visible while producing the next page', async () => {
    const input = freshTurnRoom();
    let previousPage = '';
    async function* lines() {
        for (let line = 1; line <= 24; line++)
            yield `Help line ${line}`;
        previousPage = requireScreenRow(0).map(cell => cell.ch).join('');
        yield 'Last help line';
    }
    input.feed(' ');
    const reading = showTextWindow(lines());
    try {
        await input.waitUntilBlocked();
        assert.match(previousPage, /^Help line 1\s*$/, 'acknowledging an intermediate page must not replace it with the map');
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /^Help line 24/);
    }
    finally {
        input.feed('\x1b');
        await reading;
    }
    assert.equal(game.nhDisplay?.grid[11]?.[9]?.ch, '@', 'closing the window restores the map');
});
void test('closing the chronicle window repaints the pending turn counter', async () => {
    const input = freshTurnRoom({ flags: { time: true, tips: false }, hero: { uachieved: [] } });
    recordAchievement(game, ACH_SHOP);
    // Paint the starting status once so the row holds a turn counter.
    game.context.botl = true;
    await flush_screen(1);
    const paintedBefore = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(paintedBefore, /T:\d+/);
    // Advance the turn without a status repaint, as a travel arrival does:
    // allmain.c increments svm.moves but skips time_botl while run is 8.
    game.moves += 1;
    game.context.run = 8;
    // 'v' opens the chronicle text window; the queued space dismisses it.
    input.feed('v ');
    await rhack('v'.charCodeAt(0));
    const paintedAfter = requireScreenRow(23).map(cell => cell.ch).join('');
    const turnAfter = /T:(\d+)/.exec(paintedAfter)?.[1];
    assert.equal(turnAfter, String(game.moves), 'the closing flush paints the status with the current turn counter');
    assert.equal(game.context.botl, false);
});
//# sourceMappingURL=text_window_status.test.js.map