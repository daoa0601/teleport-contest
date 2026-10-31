import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { flush_screen, show_glyph_cell, under_water } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pline } from '../js/pline.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenCell } from './support/screen.js';
// C detect.c:reveal_terrain() ends with map_redisplay(): the hero is
// reconstrained and under_water(2) defers a full restricted reset.  The
// turn's under_water(0) then pages the pending topline with --More-- before
// it clears the whole map, rather than repairing only the old viewport.
void test('a terrain browse defers the next underwater full reset', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    for (let x = 8; x <= 18; x++)
        for (let y = 8; y <= 12; y++)
            game.level.requireAt(x, y).typ = POOL;
    game.u.uinwater = 1;
    // Open the terrain browser, take the first view, and pick the hero's
    // own square to leave the browser.
    input.feed('\x7fa,');
    await rhack(0);
    assert.equal(game.context.move, 0);
    // A glyph beyond the three-by-three viewport survives the browse.
    await show_glyph_cell(16, 10, '!');
    await flush_screen(1);
    assert.equal(requireScreenCell(15, 11).ch, '!');
    await pline('Some water gets into your sack!');
    const pages = [];
    installPagerInput(input, { expected: /Some water gets into your sack!/, limit: 1, pages });
    // The turn's restricted update performs the deferred full reset.
    await under_water(0);
    assert.equal(pages.length, 1);
    const page = pages[0];
    assert.ok(page, 'The pager page was captured');
    const mapRow = page.split('\n')[11];
    assert.ok(mapRow, 'The map row was captured');
    assert.match(page, /Some water gets into your sack!--More--/);
    // The old map is still on screen while the pager waits.
    assert.match(mapRow, /!/);
    await flush_screen(1);
    assert.equal(requireScreenCell(15, 11).ch, ' ');
});
//# sourceMappingURL=terrain_browse_deferred_reset.test.js.map