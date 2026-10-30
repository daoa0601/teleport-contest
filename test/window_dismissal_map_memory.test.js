import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { M_AP_FURNITURE, M_AP_TYPE, MM_ANGRY, NO_MINVENT, DOOR, D_NODOOR } from '../js/const.js';
import { flush_screen, map_background, newsym } from '../js/display.js';
import { deleteEngraving, makeEngravingAt } from '../js/engrave.js';
import { recordGameLogEvent } from '../js/gamelog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { prepareMapPositionHighlights } from '../js/getpos.js';
import { resetInputState } from '../js/input.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
// A wiped-out engraving leaves a stale glyph in hero memory until the hero
// sees the square again.  Corner menus repaint that memory untouched
// (erase_menu_or_text() -> docorner()), while a full-screen NHW_TEXT
// window's dismissal runs docrt() and recomputes it.
async function rememberWipedEngraving() {
    const engraving = makeEngravingAt(11, 10, 'old writing');
    assert.ok(engraving);
    await newsym(11, 10);
    deleteEngraving(engraving);
}
void test('dismissing the naming menu keeps a stale remembered engraving glyph', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    await rememberWipedEngraving();
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '`');
    const input = resetInputState();
    input.feed('name\r');
    input.beforeRead = () => input.feed('\u001b');
    await rhack('#'.charCodeAt(0));
    assert.equal(requireScreenCell(10, 11).ch, '`');
});
void test('closing the chronicle window recomputes a stale remembered engraving glyph', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    await rememberWipedEngraving();
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '`');
    recordGameLogEvent('entered the dungeon');
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await rhack('v'.charCodeAt(0));
    assert.equal(requireScreenCell(10, 11).ch, '.');
});
void test('a corner-menu dismissal rests the cursor on its last cleared row', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('name\r');
    input.beforeRead = () => input.feed('\u001b');
    await rhack('#'.charCodeAt(0));
    const display = game.nhDisplay;
    assert.ok(display);
    // docorner() moves the cursor to each cleared row start and stops at
    // the final one: the menu's left column, one row below its content.
    assert.equal(display.cursorCol, 30);
    assert.equal(display.cursorRow, 7);
});
void test('a corner-menu dismissal rests the cursor past the glyphs it reprints', async () => {
    // row_refresh() reprints the mapped floor right of the menu edge on its
    // final row, so print_glyph() leaves the cursor just past that floor.
    await freshObjectRoom({ right: 50 });
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('name\r');
    input.beforeRead = () => input.feed('\u001b');
    await rhack('#'.charCodeAt(0));
    const display = game.nhDisplay;
    assert.ok(display);
    assert.equal(display.cursorCol, 50);
    assert.equal(display.cursorRow, 7);
});
void test('a corner-menu dismissal advances past mapped stone drawn as a blank', async () => {
    await freshObjectRoom({ right: 50 });
    requirePlayingGame(game);
    await map_background(51, 6);
    await flush_screen(1);
    assert.equal(requireScreenCell(50, 7).ch, ' ');
    const input = resetInputState();
    input.feed('name\r');
    input.beforeRead = () => input.feed('\u001b');
    await rhack('#'.charCodeAt(0));
    const display = game.nhDisplay;
    assert.ok(display);
    assert.equal(display.cursorCol, 51, 'reprinting explored stone advances the cursor too');
    assert.equal(display.cursorRow, 7);
});
for (const color of [true, false]) {
    void test(`a corner-menu dismissal advances past a framed unexplored square with color ${color ? 'on' : 'off'}`, async () => {
        await freshObjectRoom({ flags: { color } });
        requirePlayingGame(game);
        await prepareMapPositionHighlights((x, y) => x === 60 && y === 6);
        const input = resetInputState();
        input.feed('name\r');
        input.beforeRead = () => input.feed('\u001b');
        await rhack('#'.charCodeAt(0));
        const display = game.nhDisplay;
        assert.ok(display);
        assert.equal(display.cursorCol, 60, 'row_refresh reprints framed squares even if unexplored');
        assert.equal(display.cursorRow, 7);
    });
}
void test('running into a disguised door mimic reveals it and takes the turn', async () => {
    const level = await freshObjectRoom();
    const doorway = level.requireAt(9, 9);
    doorway.typ = DOOR;
    doorway.doormask = D_NODOOR;
    const mimic = await createMonsterAt('small mimic', 9, 9, MM_ANGRY | NO_MINVENT);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = CmapSymbol.vcdoor;
    mimic.msleeping = 0;
    await newsym(9, 9);
    await rhack('Y'.charCodeAt(0));
    assert.equal(M_AP_TYPE(mimic), 0);
    assert.match(game._pending_message, /That closed door actually is a small mimic!/);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=window_dismissal_map_memory.test.js.map