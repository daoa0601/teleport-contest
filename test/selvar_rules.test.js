import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { SpecialSelection, selection_force_newsyms, selection_do_gradient, selection_new, selection_getpoint, selection_numpoints, } from '../js/selvar.js';
import { resetInputState } from '../js/input.js';
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
void test('an unknown gradient type reports its fallback and draws a radial selection', async () => {
    freshObjectRoom();
    const display = requireGameDisplay(game);
    let reportedFallback = false;
    const input = resetInputState();
    input.beforeRead = () => {
        const top = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
        if (top.includes('Unrecognized gradient type! Defaulting to radial...'))
            reportedFallback = true;
        input.feed(' ');
    };
    const selection = selection_new();
    await selection_do_gradient(selection, 10, 10, 10, 10, 99, 0, 0);
    assert.equal(reportedFallback, true);
    assert.equal(selection_numpoints(selection), 1);
    assert.equal(selection_getpoint(10, 10, selection), 1);
});
//# sourceMappingURL=selvar_rules.test.js.map