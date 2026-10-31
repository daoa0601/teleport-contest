import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MENU_FULL } from '../js/const.js';
import { APPLE, FOOD_RATION, SACK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C cmd.c:act_on_act() runs a here-command menu's "Pick up items" entry as
// a queued dopickup() (CQ_CANNED), so parse() and its flush_screen(1) are
// skipped.  pickup.c:pickup() then builds the "Pick up what?" menu through
// query_objlist(), which does not flush either: the hallucination redraws
// that the moveloop boundary buffers into the glyph map (allmain.c:
// moveloop_core()'s see_monsters()/see_objects() pass) stay invisible while
// the menu waits.  A pickup typed directly as ',' differs: parse() runs and
// flushes before the command.

void test('a queued pickup menu leaves buffered hallucination redraws unpainted', async () => {
    const level = await freshObjectRoom({
        hero: { hallucinationTurns: 99 },
        flags: { menu_style: MENU_FULL },
    });
    game._moveloopStarted = true;
    game.u.umovement = 12;
    // A pile under the hero gives the here-command menu its "Pick up
    // items" entry; the lone pile beside the hero is the cell the
    // once-per-input hallucination pass re-rolls.
    await floorObject(APPLE, 10, 10);
    await floorObject(FOOD_RATION, 10, 10);
    await floorObject(SACK, 11, 10);
    await flush_screen(1);

    const display = requireGameDisplay(game);
    const paintedBefore = display.grid[11]?.[10]?.ch;
    const cell = level.requireAt(11, 10);
    const bufferedBefore = cell.disp_ch;

    const input = resetInputState();
    pushKeys('herecmdmenu\n');
    const menu = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(requireGameDisplay(game).grid[0]?.map(c => c.ch).join('') ?? '',
        /What do you want to do\?/);
    input.feed('a');
    await menu;
    // The queued dopickup runs in the next command iteration, behind the
    // moveloop boundary's hallucination pass.
    const loop = moveloop_core();
    await input.waitUntilBlocked();

    const screen = requireGameDisplay(game).grid.map(row => row.map(c => c.ch).join('')).join('\n');
    assert.match(screen, /Pick up what\?/);
    // The once-per-input hallucination pass must have redrawn the cell in
    // the glyph buffer (C see_objects() newsym()s every pile top).
    assert.notEqual(cell.disp_ch, bufferedBefore,
        'the moveloop boundary should have re-rolled the hallucinated pile glyph');
    // Neither the queued dopickup() nor query_objlist() flushes, so the
    // painted map keeps the old glyph while the menu is open.
    assert.equal(requireGameDisplay(game).grid[11]?.[10]?.ch, paintedBefore,
        'the pickup menu must not paint pending hallucination redraws');

    input.feed('\x1b');
    await loop;
    await flush_screen(1);
    assert.equal(requireGameDisplay(game).grid[11]?.[10]?.ch, cell.disp_ch,
        'a later flush paints the buffered redraw');
});
