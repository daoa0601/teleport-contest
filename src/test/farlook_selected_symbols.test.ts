import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { ALTAR } from '../js/const.js';
import { captureRunmodeDelay } from '../js/hack.js';
import { showUnrememberedTopline } from '../js/topl.js';
import { displaySelf, flush_screen, newsym } from '../js/display.js';
import { wearHeroArmor } from '../js/do_wear.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { serializeCapture } from '../js/jsmain.js';
import { applyNethackrc } from '../js/cfgfiles.js';
import { showDisclosureOverlay } from '../js/windows.js';
import { NO_COLOR } from '../js/terminal.js';
import { POT_HEALING, SMALL_SHIELD } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { farlookText } from './support/farlook.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('farlook identifies the potion class through the RogueIBM symbol', async () => {
    await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=roguesymset:RogueIBM');
    await floorObject(POT_HEALING, 11, 10, { dknown: true });
    await newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '\xad');

    const text = await farlookText('l.');

    assert.match(text, /a potion \(/, text);
});

void test('farlook identifies the human class through the RogueEpyx hero symbol', async () => {
    await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=roguesymset:RogueEpyx');
    await displaySelf();
    await flush_screen(1);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '\x01');

    const text = await farlookText('.');

    assert.match(text, /a human or elf/, text);
});

// win/tty/topl.c's putmixed kludge keeps the leading glyph on the physical
// row through g_putch(), so a full-screen rebuild (_buildScreenOutput)
// repaints the message row with the DEC glyph still inside its shift.
void test('a flushed DEC farlook description keeps its glyph shift on the message row', async () => {
    const level = await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    level.requireAt(11, 10).typ = ALTAR;
    await newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '\u03c0', 'the altar shows the DEC glyph');

    const input = resetInputState();
    input.feed('l.');
    input.display = { async readKey() { return ' '.charCodeAt(0); } };
    await rhack(';'.charCodeAt(0));
    await flush_screen(1);

    const row = serializeCapture(requireGameDisplay()).split('\n')[0] ?? '';
    assert.ok(row.includes('\x0e{\x0f'),
        `the message-row glyph keeps its alternate-font shift: ${JSON.stringify(row)}`);
});

// wintty.c:docorner() repaints the uncovered map from the glyph buffer, so
// every glyph below a dismissed menu replays through g_putch() with its own
// shift; the underlay snapshot must carry that per-cell state (the takeoff
// category menu restores its underlay directly, without a later map flush
// before the screen is read).
void test('a dismissed takeoff menu restores DEC map glyphs with their shifts', async () => {
    const level = await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    level.requireAt(11, 9).typ = ALTAR;
    await newsym(11, 9);
    await flush_screen(1);
    const shiftedAltar = /\x0e[^\x0f]*\{/;
    const altarRow = () => serializeCapture(requireGameDisplay()).split('\n')[10] ?? '';
    assert.ok(shiftedAltar.test(altarRow()), 'the altar records its shift');

    const shield = await addInventoryObject(SMALL_SHIELD);
    await wearHeroArmor(shield);
    const input = resetInputState();
    input.feed('\x1b');
    await rhack('A'.charCodeAt(0));

    assert.ok(shiftedAltar.test(altarRow()),
        `the restored altar keeps its shift: ${JSON.stringify(altarRow().slice(0, 48))}`);
});

// process_text_window() restores the covered map cells when its corner is
// dismissed; each restored glyph replays its g_putch() shift.
void test('a dismissed corner disclosure restores DEC map glyphs with their shifts', async () => {
    const level = await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    level.requireAt(11, 9).typ = ALTAR;
    await newsym(11, 9);
    await flush_screen(1);
    const shiftedAltar = /\x0e[^\x0f]*\{/;
    const altarRow = () => serializeCapture(requireGameDisplay()).split('\n')[10] ?? '';
    assert.ok(shiftedAltar.test(altarRow()), 'the altar records its shift');

    const input = resetInputState();
    input.feed(' ');
    const key = await showDisclosureOverlay(['a short disclosure line'], { restoreUnderlay: true });

    assert.equal(key, ' '.charCodeAt(0));
    assert.ok(shiftedAltar.test(altarRow()),
        `the restored altar keeps its shift: ${JSON.stringify(altarRow().slice(0, 48))}`);
});

// hack.c:runmode_delay_output() keeps the physical top line through its
// frames; a retained DEC glyph there replays the shift it was drawn with,
// whatever the live screen shows during the delay.
void test('a retained top line keeps its own shift through runmode delay frames', async () => {
    await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    showUnrememberedTopline('plain text');
    game._pending_message = '';
    const frames: string[] = [];
    game.animationFrame = async () => {
        frames.push(serializeCapture(requireGameDisplay()).split('\n')[0] ?? '');
    };

    await captureRunmodeDelay(game, true, 7, {
        preservePhysicalTopline: true,
        retainedTopline: [{ ch: '\u03c0', color: NO_COLOR, attr: 0, altFont: true }],
    });

    delete game.animationFrame;
    assert.ok(frames.some(frame => frame.includes('\x0e{')),
        `the retained DEC glyph keeps its shift: ${JSON.stringify(frames[0])}`);
});
