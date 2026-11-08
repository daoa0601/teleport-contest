import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline, moreUntilDismissed } from '../js/topl.js';
import { paintGetposCursor } from '../js/getpos.js';
import { flush_screen } from '../js/display.js';
import { pline } from '../js/pline.js';
import { game } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
const toplText = () => requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
// C update_topl() with WIN_STOP (topl.c: the !(WIN_STOP|WIN_NOSTOP) guard
// around redotoplin()) advances gt.toplines and the recall history but
// never repaints, so timeout prose arriving after the player pressed
// Escape at a --More-- stays off the screen until the next input.
void test('suppressed timeout prose stays off the top line', async () => {
    await freshObjectRoom();
    const input = resetInputState();
    input.feed('\x1b');
    await moreUntilDismissed('You hear a jackal barking in the corridor.');
    assert.equal(game._suppressMessagesUntilInput, true, 'Escape must suppress output');
    await pline('You feel less confused now.');
    await flush_screen(1);
    assert.equal(toplText(), '', 'WIN_STOP keeps the hidden line off the screen');
    assert.ok(game._toplines.includes('You feel less confused now.'), 'the history still records the hidden prose');
    input.feed(' ');
    await nhgetch();
    await pline('The kitten drops a rock.');
    await flush_screen(1);
    assert.equal(toplText(), 'The kitten drops a rock.', 'the next input lifts the suppression');
});
void test('death after Escape preserves the death line and suppressed prose in recall', async () => {
    await freshObjectRoom({ iflags: { prevmsg_window: 's' } });
    const input = resetInputState();
    await pline('A bell rings.');
    input.feed('\x1b');
    await flushPendingTopline();
    await pline('The giant hits!');
    await pline('You die...');
    await pline('But wait...');
    await flush_screen(1);
    assert.equal(toplText(), 'You die...  But wait...', 'death resumes output and later prose joins the death line');
    await rhack(16);
    assert.equal(toplText(), 'You die...  But wait...', 'the newest recall entry keeps death and its follow-up');
    await rhack(16);
    assert.equal(toplText(), 'A bell rings.  The giant hits!', 'the previous entry includes the hit suppressed after Escape');
});
// C win/tty/topl.c:show_topl() (topl.c:150-153): the WIN_STOP gate covers
// SUPPRESS_HISTORY output too — getpos autodescribe goes through
// tty_putstr's remember_topl() + show_topl() pair, so after Escape at a
// --More-- the unremembered line also stays off the screen.
void test('suppressed autodescribe prose stays off the top line', async () => {
    await freshObjectRoom();
    const input = resetInputState();
    input.feed('\x1b');
    await moreUntilDismissed('You hear a jackal barking in the corridor.');
    assert.equal(game._suppressMessagesUntilInput, true, 'Escape must suppress output');
    await paintGetposCursor({ x: 5, y: 5 }, 'a boulder named blort', null, { flushPending: true });
    await flush_screen(1);
    assert.equal(toplText(), '', 'show_topl keeps SUPPRESS_HISTORY lines hidden under WIN_STOP');
    input.feed(' ');
    await nhgetch();
    await paintGetposCursor({ x: 5, y: 5 }, 'a boulder named blort', null, { flushPending: true });
    await flush_screen(1);
    assert.equal(toplText(), 'a boulder named blort', 'the unremembered line shows again once input resumes');
});
//# sourceMappingURL=topline_suppression.test.js.map