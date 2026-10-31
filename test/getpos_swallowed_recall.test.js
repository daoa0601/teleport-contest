import test from 'node:test';
import assert from 'node:assert/strict';
import { doprevMessage } from '../js/prevmsg.js';
import { flush_screen, newsym } from '../js/display.js';
import { pline } from '../js/pline.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenCell } from './support/screen.js';
function toplineText() {
    return (game.nhDisplay?.grid[0] ?? []).map(cell => cell.ch).join('');
}
// C getpos.c:auto_describe() -> pager.c:do_screen_description(): while
// swallowed (or submerged) every spot beyond arm's reach is
// "unreconnoitered", before any glyph lookup.  Travel's cursor shares
// this describe path, so its automatic descriptions must match farlook's.
void test('travel autodescribe beyond arm reach while swallowed reports unreconnoitered terrain', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    game._moveloopStarted = true;
    const engulfer = await createMonsterAt('trapper', game.u.ux, game.u.uy);
    game.u.uswallow = 1;
    game.u.ustuck = engulfer;
    const input = resetInputState();
    const pages = [];
    input.display = { async readKey() {
            pages.push(toplineText());
            return 27;
        } };
    input.feed('_ll');
    await moveloop_core();
    assert.ok(pages.some(page => /unreconnoitered/.test(page)), `Expected the swallowed travel description, saw: ${pages.join(' | ')}`);
    assert.ok(pages.every(page => !/interior of/.test(page)), `The swallower is not described beyond arm reach: ${pages.join(' | ')}`);
});
// C pager.c:do_screen_description() -> lookat() describes the hero only
// when canspotself() holds; invisibility without telepathy or monster
// detection leaves the terrain under the travel cursor.
void test('travel autodescribe at an invisible unsensed hero shows the floor', async () => {
    const input = freshTurnRoom({ flags: { tips: false, verbose: false } });
    game.u.invis = true;
    await newsym(game.u.ux, game.u.uy);
    const pages = [];
    input.display = { async readKey() {
            pages.push(toplineText());
            return 27;
        } };
    input.feed('_lh');
    await moveloop_core();
    assert.ok(pages.some(page => /floor of a room/.test(page)), `Expected terrain under the invisible hero, saw: ${pages.join(' | ')}`);
    assert.ok(pages.every(page => !/invisible .* called/.test(page)), `An unsensed invisible hero is not described: ${pages.join(' | ')}`);
});
// C tty topl.c:redotoplin(): recall re-prints the stored bytes through
// putsyms(), so the DECgraphics glyph char that g_putch() drew on the live
// topline comes back as its raw high-bit byte and records as a blank.
void test('previous-message recall renders an encoded glyph byte as a blank', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    await pline('\x0e\u00fe\x0f        a doorway or the floor of a room');
    await doprevMessage();
    assert.equal(requireScreenCell(0, 0).ch, ' ');
});
// The full-screen repaint at the next input boundary rebuilds row 0 from
// the pending message; the DEC shift markers are zero-width there, and the
// glyph cell stays blank once the recall repaint has run, matching the tty
// shadow's rendering of putsyms()' raw high-bit byte.
void test('screen repaint after glyph recall leaves the glyph cell blank', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    await pline('\x0e\u00fe\x0f        a doorway or the floor of a room');
    await doprevMessage();
    await flush_screen(1);
    assert.equal(requireScreenCell(0, 0).ch, ' ');
    assert.match(toplineText(), /^ {9}a doorway or the floor of a room *$/);
});
// C cmd.c:dotravel() plines the travel question and getpos() plines the
// instructions line; tty joins both into one recallable topline entry.
void test('travel prompt joins the instructions line in message recall', async () => {
    const input = freshTurnRoom({ flags: { tips: false, verbose: true } });
    input.feed('_\x1b');
    await moveloop_core();
    await doprevMessage();
    assert.match(toplineText(), /Where do you want to travel to\?  \(For instructions type a '\?'\)/);
});
// C hack.c:domove_core() runs the shared destination-monster block on
// u.ustuck: nomul(0) cancels a count prefix, so one counted attack while
// swallowed spends a single hero action.
void test('a counted attack while swallowed is cut to a single strike', async () => {
    const input = freshTurnRoom({ role: 'barbarian' });
    game.u.uhp = game.u.uhpmax = 500;
    const trapper = await createMonsterAt('trapper', game.u.ux, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    game.u.uswallow = 1;
    game.u.ustuck = trapper;
    input.display = { async readKey() { return 32; } };
    input.feed('4y');
    await moveloop_core();
    assert.equal(game.multi, 0, 'nomul(0) cancels the remaining count repeats');
    const strikes = (game._pending_message ?? '').match(/You (?:hit|smite|miss) the trapper\./g)?.length ?? 0;
    assert.equal(strikes, 1, `One strike per counted command, saw: ${game._pending_message}`);
});
//# sourceMappingURL=getpos_swallowed_recall.test.js.map