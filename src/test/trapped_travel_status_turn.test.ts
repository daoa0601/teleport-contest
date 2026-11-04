// C refs: hack.c weight_cap() (4303-4343), polyself.c float_vs_flight()
// (131-154, the closing disp.botl = TRUE), allmain.c moveloop_core()
// (`if (flags.time && !context.run) disp.time_botl = TRUE`, 262-263, and
// the once-per-input flush, 473-479), pline.c vpline() (flush_screen()
// before the message, 273-274).
//
// A levitating hero caught in a floor trap keeps BLevitation's I_SPECIAL
// hold set.  weight_cap() clears that bit for the capacity math and
// restores it with float_vs_flight() (hack.c:4309, 4339-4343), which
// always sets disp.botl.  encumber_msg() opens every world turn and
// gethungry() runs inside it, so each turn of a travel run whose hero is
// trapped and levitating requests a full status repaint.  Travel keeps
// context.run at 8, so allmain.c:262 never sets time_botl; the repaint
// that reaches bot() comes from weight_cap()'s float_vs_flight() instead,
// and it carries the new svm.moves to the screen even at a --More-- that
// pages in the middle of the run.

import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { NOT_HUNGRY, SICK_VOMITABLE, TT_BEARTRAP } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setPropertyTerrainBlocked } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

function statusTurnText(): string {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}

void test('a trapped levitating traveler repaints the turn counter at the run\'s --More--', async () => {
    const input = freshTurnRoom({ flags: { time: true, tips: false } });
    // Food poisoning whose countdown reports "Your sickness is severe."
    // on the first world turn (j odd, i = 2), and a long bear-trap hold.
    game.u.sick = true;
    game.u.sickTurns = 5;
    game.u.sickType = SICK_VOMITABLE;
    game.u.levitationTurns = 40;
    game.u.utrap = 50;
    game.u.utraptype = TT_BEARTRAP;
    // Keep the turn counter off the leap-runmode refresh stride
    // (runmode_delay_output(), svm.moves % 7): its time_botl repaint is a
    // different C path from the weight_cap() one under test.
    game.u.uhunger = 800;
    game.u.uhs = NOT_HUNGRY;
    game.moves = 24;
    // Paint the starting status once so the row holds a turn counter.
    game.context.botl = true;
    await flush_screen(1);
    assert.match(statusTurnText(), /T:24/);

    // Travel four squares east: the destination is not adjacent, so the
    // command keeps multi and context.run at 8 while the bear trap holds
    // the hero.  The trailing space dismisses the --More-- that pages
    // during the second turn's struggle message.
    input.feed('_llll, ');
    await rhack(0);
    assert.ok((game.u.utrap ?? 0) > 0, 'the hero stays trapped');
    assert.equal(game.moves, 24, 'the travel command itself spends no turn');

    // The moveloop driver records the command's spent action after rhack().
    game.u.umovement = (game.u.umovement ?? 12) - 12;
    game._heroTimePending = true;
    await moveloop_core();

    assert.equal(game.moves, 25, 'one travel turn elapsed');
    assert.equal(game.context.run, 8, 'travel still suppresses time_botl');
    // update_topl() archived the combined line only because the second
    // struggle message did not fit next to it: that paging --More-- is
    // the boundary the C recording captures at step 798.
    assert.ok(
        (game._messageHistory ?? []).includes(
            'You are caught in a bear trap.  Your sickness is severe.'),
        'the struggle message paged inside the run');
    // C paints the new counter through weight_cap()'s float_vs_flight()
    // botl request, not through time_botl; the status row at the pager
    // boundary must show the turn the sickness message was printed on.
    assert.match(statusTurnText(), /T:25/,
        'the status line must show the charged turn counter during the run');
});

// C hack.c:3186-3190: switch_hero_terrain() sets BLevitation's FROMOUTSIDE
// bit for any hero standing in obstructed terrain, with or without a
// levitation source.  weight_cap() clears only I_SPECIAL (hack.c:4309),
// so FROMOUTSIDE never makes hack.c:4339's restore run: a terrain-blocked
// hero gets no float_vs_flight() and no disp.botl from a capacity check.
// While travel keeps context.run at 8 and suppresses time_botl, the
// status line therefore keeps its stale turn counter.
void test('a terrain-blocked hero keeps the stale turn counter during travel', async () => {
    const input = freshTurnRoom({ flags: { time: true, tips: false } });
    // BLevitation FROMOUTSIDE without any levitation source.
    setPropertyTerrainBlocked('levitation', true);
    game.u.uhunger = 800;
    game.u.uhs = NOT_HUNGRY;
    game.moves = 24;
    game.context.botl = true;
    await flush_screen(1);
    assert.match(statusTurnText(), /T:24/);
    const startX = game.u.ux;

    input.feed('_llll, ');
    await rhack(0);
    game.u.umovement = (game.u.umovement ?? 12) - 12;
    game._heroTimePending = true;
    await moveloop_core();

    assert.equal(game.u.ux, startX + 2, 'the travel run took its steps');
    assert.equal(game.moves, 25, 'one travel turn elapsed');
    assert.equal(game.context.run, 8, 'travel still suppresses time_botl');
    assert.match(statusTurnText(), /T:24/,
        'a capacity check for a terrain-blocked hero must not request a repaint');
});
