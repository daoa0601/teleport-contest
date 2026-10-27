// C refs: allmain.c:moveloop_core() end-of-command display cadence:
//   if ((!context.run || flags.runmode == RUN_TPORT)
//       && (multi && (!context.travel ? !(multi % 7) : !(moves % 7)))) {
//       if (flags.time && context.run) disp.botl = TRUE;
//       display_nhwindow(WIN_MAP, FALSE);
//   }
// With runmode:teleport, runmode_delay_output() draws nothing per step, so
// this every-7th stride is the only thing that marks the status line while
// travel runs.  The pending botl is consumed by the next iteration's
// once-per-input bot(), repainting the turn counter even though no message
// interrupted the run and context.run still suppresses time_botl.

import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { NOT_HUNGRY } from '../js/const.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('teleport-runmode travel repaints the turn counter on the seven-move stride', async () => {
    const input = freshTurnRoom({ flags: { time: true, tips: false, runmode: 'teleport' } });
    // Paint the starting status once so the row holds a turn counter;
    // hold nutrition mid-range so no hunger transition repaints the row.
    game.u.uhunger = 500;
    game.u.uhs = NOT_HUNGRY;
    game.context.botl = true;
    await flush_screen(1);
    const startX = game.u.ux;

    // Travel three steps east.  The first step runs inside the '_'
    // command's rhack() and ends on moves 6; the second step's iteration
    // ends on moves 7 — the stride — so it marks botl dirty even though
    // travel keeps running and no message is printed.
    game.moves = 6;
    input.feed('_lll.');
    await rhack(0);
    assert.equal(game.u.ux, startX + 1);
    // The moveloop driver records the command's spent action after rhack().
    game.u.umovement = (game.u.umovement ?? 12) - 12;
    game._heroTimePending = true;

    await moveloop_core();
    assert.equal(game.u.ux, startX + 2);
    assert.equal(game.context.run, 8, 'travel must still be running');

    // This invocation advances to moves 8, so its once-per-input bot()
    // paints the counter that the stride marked dirty.
    await moveloop_core();
    assert.equal(game.u.ux, startX + 3);
    const statusTurnText = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(
        statusTurnText, /T:8/,
        'the seven-move stride repaints the turn counter mid-travel');
});
