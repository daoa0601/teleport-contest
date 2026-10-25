import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

// C pager.c:add_cmap_descr() renders the first matching trap cmap as
// "a trap", so typing the default web symbol reports a trap after the
// amulet class while keeping "web" as the encyclopedia lookup name.
void test('typed look describes the double-quote symbol as a trap', async () => {
    freshObjectRoom({ flags: { tips: false, help: false } });
    game.symset = 'DECgraphics';
    const input = resetInputState();
    input.feed('/?"\n');

    await rhack(0);
    await flush_screen(1);

    const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
    assert.match(message ?? '', /^" +an amulet or a trap$/);
    assert.equal(game.context.move, 0);
});
