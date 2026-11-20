import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { ORCISH_DAGGER, SACK } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, addInventoryWeapon } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

// C win/tty/topl.c:tty_yn_function() clean_up clears the message window
// only when wins[WIN_MESSAGE]->cury is set (topl.c:555-556): a one-line
// answered question stays painted. The next pline reaches redotoplin(),
// which repaints the row in place — home(); putsyms(str); cl_end()
// (topl.c:126-137) — never blanking it first, so the cell under a high-bit
// name byte keeps the answered prompt's glyph: topl_putsym() advances the
// cursor past the byte (topl.c:331-351) while nomux_putch() rejects it as
// a signed char below 32 and leaves the cell alone (termcap.c:755-757).
test.beforeEach(() =>
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL, cmdassist: false } }));

void test('an answered stash prompt stays painted under the put-in message', async () => {
    requirePlayingGame(game);
    const sack = await addInventoryObject(SACK, {
        invlet: 'a', initialize: false, cknown: true,
    });
    if (!sack.contents) sack.contents = [];
    await addInventoryWeapon(ORCISH_DAGGER, {
        invlet: 'b', oextra: { oname: 'w\xefde' },
    });

    // 's' answers the container action prompt, 'b' the stash query.
    await applyInventoryObject(sack, 'sb');

    const message = game._pending_message ?? '';
    assert.match(message, /^You put a \+0 orcish dagger named w\xefde into the sack\.$/);
    const prompt = 'What do you want to stash? [b or ?*] ';
    const skipped = message.indexOf('\xef');
    assert.ok(skipped > 0 && skipped < prompt.length,
        'the skipped byte must land inside the answered prompt');
    const display = game.nhDisplay;
    assert.ok(display, 'the repainted topline needs the live display');
    const row = (display.grid[0] ?? []).map(cell => cell.ch).join('');
    assert.equal(row.slice(0, message.length),
        message.slice(0, skipped) + prompt.charAt(skipped) + message.slice(skipped + 1));
});
