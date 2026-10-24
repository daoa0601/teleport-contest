import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { SpecialSelection, selection_force_newsyms } from '../js/selvar.js';
import { freshObjectRoom } from './support/object-room.js';

void test('selection redraw moves the flush cursor even when the selected glyph has not changed', async () => {
    freshObjectRoom();
    newsym(11, 10);
    newsym(12, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(0, 0);

    selection_force_newsyms(new SpecialSelection().add(11, 10).selection);
    await flush_screen(0);

    assert.equal(display.cursorCol, 11, 'printing advances past the selected square');
    assert.equal(display.cursorRow, 11);
});
