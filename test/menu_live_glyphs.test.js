import assert from 'node:assert/strict';
import test from 'node:test';
import { NHW_MENU, PICK_ONE } from '../js/const.js';
import { flush_screen, glyphAt, newsym } from '../js/display.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from '../js/tty_menu.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('dismissing a corner menu paints the current hallucinated glyph beneath it', async () => {
    await freshObjectRoom({ left: 45, right: 65, heroX: 50, hero: { hallucinationTurns: 20 } });
    await createMonsterAt('lichen', 54, 7);
    await newsym(54, 7);
    await flush_screen(1);
    const previous = glyphAt(54, 7);
    assert.ok(previous?.kind === 'monster');
    const input = resetInputState();
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    for (let choice = 0; choice < 10; choice++) {
        tty_add_menu(window, { identifier: choice,
            text: `Choose one of these available actions ${choice}` });
    }
    tty_end_menu(window, 'Choose an action');
    const selecting = tty_select_menu(window, PICK_ONE);
    await input.waitUntilBlocked();
    // The logical map can change while the window covers its physical cells.
    await newsym(54, 7);
    const current = glyphAt(54, 7);
    const currentCharacter = requireGameLevel().requireAt(54, 7).disp_ch;
    input.feed('\x1b');
    await selecting;
    await tty_destroy_nhwindow(window);
    assert.ok(current?.kind === 'monster');
    assert.notEqual(current.mnum, previous.mnum, 'the hallucinated appearance changes');
    assert.equal(requireScreenCell(53, 8).ch, currentCharacter);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=menu_live_glyphs.test.js.map