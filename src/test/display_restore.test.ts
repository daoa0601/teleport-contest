import assert from 'node:assert/strict';
import test from 'node:test';
import { feel_location, flush_screen, newsym, show_glyph_cell } from '../js/display.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('restoring a level suppresses map projection and blind terrain learning', async () => {
    const level = freshObjectRoom();
    await flush_screen(1);
    const location = level.requireAt(11, 10);
    location.remembered_glyph = null;
    location.seenv = 0;
    game.program_state.restoring = true;

    newsym(11, 10);
    feel_location(11, 10);
    show_glyph_cell(11, 10, '!');
    await flush_screen(1);

    assert.equal(location.remembered_glyph, null);
    assert.equal(location.seenv, 0);
    assert.equal(requireScreenCell(10, 11).ch, '.');
});
