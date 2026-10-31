// C refs: hack.c findtravelpath() arrival (nomul(0) then run=8),
// allmain.c moveloop_core() (`if (flags.time && !context.run)
// disp.time_botl = TRUE`), and win/tty/wintty.c erase_menu_or_text() →
// docorner().  Travel ends with context.run still 8, so the turn a
// following command spends does not set time_botl and bot() never runs;
// a corner menu's dismissal repaints no status row at all.  The recorded
// tty therefore keeps showing the pre-travel turn counter after both the
// travel and a no-time lookup command, even though svm.moves advanced.

import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { continueRun } from '../js/hack.js';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

function statusTurnText(): string {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}

void test('a whatis lookup after travel leaves the stale turn counter on the status line', async () => {
    const input = freshTurnRoom({ flags: { time: true, tips: false } });
    // Paint the starting status once so the row holds a turn counter.
    game.context.botl = true;
    await flush_screen(1);
    const startX = game.u.ux;

    // Two travel steps whose charges land on turn 7, a multiple of the
    // leap-runmode refresh stride: runmode_delay_output() then flushes the
    // arrival step's nomul(0) botl early (flush_screen() runs bot() with
    // the still-uncharged counter), so after the run ends at context.run 8
    // no status flag is pending any more.
    game.moves = 6;
    input.feed('_ll.');
    await rhack(0);
    assert.equal(game.u.ux, startX + 1);
    // The moveloop driver records the command's spent action after rhack().
    game.u.umovement = (game.u.umovement ?? 12) - 12;
    game._heroTimePending = true;

    input.feed('/e');
    await moveloop_core();
    assert.equal(game.u.ux, startX + 2);
    assert.equal(game.context.run, 8);
    const afterTravel = statusTurnText();
    assert.match(afterTravel, /T:7/, 'the leap refresh paints the charged counter');
    // The second maintenance pass charges the arrival step while run is
    // still 8 (no time_botl), and rhack() runs the '/' lookup: the corner
    // menu's docorner() dismissal repaints no status row, so tty keeps
    // showing T:7 even though svm.moves is now 8.
    await moveloop_core();
    assert.ok(game.moves > 7, 'the arrival step must spend a turn');
    assert.equal(
        statusTurnText(), afterTravel,
        'a corner-menu dismissal must keep the last painted turn counter');
});
