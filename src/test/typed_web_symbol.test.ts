import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

// C pager.c:do_screen_description() checks the object classes before the
// cmap pass, so the amulet class (defsym.h '"') matches the typed double
// quote first; add_cmap_descr() then reaches S_web with found==1 and
// appends an("web") — the "a trap" wording (pager.c:1219) applies only to
// a first match.
void test('typed look describes the double-quote symbol as an amulet or a web', async () => {
    freshObjectRoom({ flags: { tips: false, help: false } });
    game.symset = 'DECgraphics';
    const input = resetInputState();
    input.feed('/?"\n');

    await rhack(0);
    await flush_screen(1);

    const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
    assert.match(message ?? '', /^" +an amulet or a web$/);
    assert.equal(game.context.move, 0);
});
