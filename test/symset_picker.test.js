import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { HWALL, LADDER, LA_UP, STAIRS } from '../js/const.js';
import { bot, docrt, flush_screen, map_object, newsym } from '../js/display.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from '../js/glyph_numbers.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { floorObject } from './support/game-objects.js';
import { requireScreenCell } from './support/screen.js';
import { CLR_BROWN, NO_COLOR } from '../js/terminal.js';
import { BOULDER, GOLD_PIECE } from '../js/object_data.js';
import { gotoLevel } from '../js/level_change.js';
import { applyNethackrc } from '../js/options.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { farlookText } from './support/farlook.js';
function screen() {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}
function menuRow(name) {
    for (const line of screen().split('\n')) {
        const row = line.match(/(?:^|\s)([a-zA-Z?]) [-+*#] (.*)$/);
        const key = row?.[1];
        const text = row?.[2];
        if (key && text?.startsWith(`${name} `))
            return { key, text };
    }
    return null;
}
// Opens options with 'O' (or 'mO' for the full menu), selects `option`, and interacts
// with the follow-up window: whenever its rows contain `name`, that key is
// pressed; otherwise the menu pages forward.  Every screen the follow-up
// shows is captured.  The options menu itself is dismissed afterwards.
async function driveOptionWindow(option, name, fullMenu = false) {
    const input = resetInputState();
    const pickerScreens = [];
    let stage = fullMenu ? 'prefix' : 'option';
    const selectRow = (wanted) => {
        const row = menuRow(wanted);
        if (!row)
            return false;
        input.feed(row.key);
        return true;
    };
    input.beforeRead = () => {
        if (stage === 'prefix') {
            input.feed('O');
            stage = 'option';
            return;
        }
        if (stage === 'confirm') {
            input.feed('\r');
            stage = 'target';
            return;
        }
        if (stage === 'option') {
            if (selectRow(option)) {
                stage = fullMenu ? 'confirm' : 'target';
            }
            else
                input.feed(' ');
            return;
        }
        if (stage === 'target') {
            pickerScreens.push(screen());
            if (selectRow(name))
                stage = 'done';
            else
                input.feed(' ');
            return;
        }
        input.feed('\x1b');
    };
    await rhack((fullMenu ? 'm' : 'O').charCodeAt(0));
    await flush_screen(1);
    input.beforeRead = null;
    return { pickerScreens };
}
function installLadderUp(x, y) {
    const location = game.level?.at(x, y);
    assert.ok(location, 'the room exposes the test cell');
    location.typ = LADDER;
    location.ladder = LA_UP;
    newsym(x, y);
    return { column: x - 1, row: y + 1 };
}
// symbols.c:do_symset(): picking DECgraphics from the "Select symbol set:"
// menu swaps the active set and redraws the map through the new symbols,
// exactly like switch_symbols() plus doredraw().
void test('the options-menu symset picker switches the live symbol set', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const cell = installLadderUp(12, 8);
    await flush_screen(1);
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '<');
    const { pickerScreens } = await driveOptionWindow('symset', 'DECgraphics');
    assert.ok(pickerScreens.some(view => /Select symbol set:/.test(view)));
    assert.ok(pickerScreens.some(view => view.includes("same as default symbols, except '+' for corner walls")));
    assert.ok(pickerScreens.some(view => view.includes('approximation of IBMgraphics using DECgraphics')));
    assert.ok(!pickerScreens.some(view => / [-+*#] RogueIBM /.test(view)), 'a rogue-restricted set stays out of the primary picker');
    assert.equal(game.symset, 'DECgraphics');
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '\u2264');
});
void test('choosing Default Symbols from the picker reverts the map', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.symset = 'DECgraphics';
    const cell = installLadderUp(12, 8);
    await flush_screen(1);
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '\u2264');
    await driveOptionWindow('symset', 'Default Symbols');
    assert.equal(game.symset, null);
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '<');
});
// do_symset() copies a named primary set into showsyms even on Rogue.
// Only selecting the rogue set or crossing a level boundary restores it.
for (const name of ['plain', 'DECgraphics']) {
    void test(`picking the named primary symbol set ${name} redraws the Rogue level`, async () => {
        const level = freshObjectRoom({ flags: { verbose: false, tips: false, help: false } });
        requirePlayingGame(game);
        game.rogue_level = { ...game.u.uz };
        level.requireAt(12, 8).typ = STAIRS;
        level.upstair = { x: 12, y: 8 };
        const ladder = installLadderUp(13, 8);
        level.requireAt(11, 8).typ = HWALL;
        await floorObject(GOLD_PIECE, 11, 10, { dknown: true });
        const rememberedGold = await floorObject(GOLD_PIECE, 3, 2, { dknown: true });
        map_object(rememberedGold);
        newsym(12, 8);
        newsym(11, 8);
        newsym(11, 10);
        await flush_screen(1);
        assert.equal(requireScreenCell(11, 9).ch, '%');
        assert.equal(requireScreenCell(10, 11).ch, '*');
        const { pickerScreens } = await driveOptionWindow('symset', name, true);
        assert.ok(pickerScreens.some(view => view.includes('Select symbol set:')));
        assert.equal(game.symset, name);
        assert.equal(requireScreenCell(11, 9).ch, '<', 'ordinary stairs use the primary symbols');
        assert.equal(requireScreenCell(ladder.column, ladder.row).ch, name === 'DECgraphics' ? '≤' : '<');
        assert.equal(requireScreenCell(10, 9).ch, name === 'DECgraphics' ? '─' : '-');
        assert.equal(requireScreenCell(10, 11).ch, '$', 'visible objects use the primary class symbols');
        assert.equal(requireScreenCell(2, 3).ch, '$', 'remembered objects use the primary class symbols');
        assert.equal(requireScreenCell(10, 9).color, NO_COLOR, 'Rogue level color rules still apply');
        assert.match(screen().split('\n')[23] ?? '', /\$:/, 'the status line uses the displayed coin symbol');
        const description = await farlookText('l.');
        assert.match(description, /a pile of coins\b/, description);
        await driveOptionWindow('symset', 'Default Symbols', true);
        assert.equal(requireScreenCell(11, 9).ch, '<', 'clearing the primary set leaves showsyms alone on Rogue');
        assert.equal(requireScreenCell(ladder.column, ladder.row).ch, name === 'DECgraphics' ? '≤' : '<');
        await driveOptionWindow('roguesymset', 'Default Symbols', true);
        assert.equal(requireScreenCell(11, 9).ch, '%', 'selecting rogue defaults restores Rogue symbols');
        assert.equal(requireScreenCell(ladder.column, ladder.row).ch, '<');
        assert.equal(requireScreenCell(10, 11).ch, '*');
        assert.equal(requireScreenCell(2, 3).ch, '*');
    });
}
void test('a primary symbol selection displays its boulder override while typed look uses the Rogue override', async () => {
    freshObjectRoom({ flags: { verbose: false, help: false, tips: false } });
    requirePlayingGame(game);
    applyNethackrc('BOULDER=57');
    game.rogue_level = { ...game.u.uz };
    await floorObject(BOULDER, 11, 10, { dknown: true });
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '`');
    await driveOptionWindow('symset', 'DECgraphics', true);
    assert.equal(requireScreenCell(10, 11).ch, '9');
    resetInputState().feed('/?`\n');
    await rhack(0);
    await flush_screen(1);
    assert.match(screen().split('\n')[0] ?? '', /boulder/, 'pager.c resolves boulders against the level override rather than showsyms');
});
void test('level travel restores Rogue symbols after picking a named primary symbol set', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    source.requireAt(11, 10).typ = STAIRS;
    source.upstair = { x: 11, y: 10 };
    await driveOptionWindow('symset', 'DECgraphics', true);
    assert.equal(requireScreenCell(10, 11).ch, '<');
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
    input.beforeRead = null;
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '%');
});
void test('restoring on Rogue discards the displayed primary symbol set', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    map_object(await floorObject(GOLD_PIECE, 3, 2, { dknown: true }));
    await driveOptionWindow('symset', 'DECgraphics', true);
    assert.equal(requireScreenCell(2, 3).ch, '$');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    await docrt();
    await flush_screen(1);
    assert.equal(requireScreenCell(2, 3).ch, '*');
});
for (const { name, coin } of [{ name: 'RogueEpyx', coin: '\x0f' }, { name: 'Blank', coin: '\x1a' }]) {
    void test(`restoring ${name} retains the process gold-label fallback until an options redraw`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        requirePlayingGame(game);
        game.rogue_level = { ...game.u.uz };
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const playerName = game.plname;
        freshObjectRoom({ flags: { verbose: false } });
        applyNethackrc(`OPTIONS=roguesymset:${name}`);
        assert.equal(restoreGame(playerName, storage), true);
        await docrt();
        await bot();
        await flush_screen(1);
        const restoredStatus = screen().split('\n')[23] ?? '';
        assert.ok(restoredStatus.includes(`${coin}:`), restoredStatus);
        await driveOptionWindow('roguesymset', name);
        assert.match(screen().split('\n')[23] ?? '', /\$:/, 'an options redraw refreshes check_gold_symbol()');
    });
}
// do_symset() sets nothing_to_do when the pick is dismissed.
void test('dismissing the symset picker keeps the current set', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.symset = 'DECgraphics';
    const input = resetInputState();
    const pickerViews = [];
    let pickingOption = true;
    let escapeCount = 0;
    input.beforeRead = () => {
        if (pickingOption) {
            const row = menuRow('symset');
            if (row) {
                input.feed(row.key);
                pickingOption = false;
            }
            else
                input.feed(' ');
            return;
        }
        pickerViews.push(screen());
        escapeCount++;
        input.feed('\x1b');
    };
    await rhack('O'.charCodeAt(0));
    input.beforeRead = null;
    assert.ok(pickerViews.some(view => /Select symbol set:/.test(view)), 'selecting symset opened the picker');
    assert.ok(escapeCount >= 2, 'the escape dismissed both the picker and the options menu');
    assert.equal(game.symset, 'DECgraphics');
});
// The rogue picker lists the Rogue*-restricted sets and drops the
// primary-restricted ones, with the rogue-level title.
void test('the roguesymset picker lists rogue-eligible sets', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const input = resetInputState();
    const pickerScreens = [];
    let sentPrefix = false;
    let pickingOption = true;
    let pickingTarget = false;
    input.beforeRead = () => {
        if (!sentPrefix) {
            sentPrefix = true;
            input.feed('O');
            return;
        }
        if (pickingOption) {
            const row = menuRow('roguesymset');
            if (row) {
                input.feed(row.key);
                pickingOption = false;
                pickingTarget = true;
            }
            else
                input.feed(' ');
            return;
        }
        if (pickingTarget) {
            pickerScreens.push(screen());
            const row = menuRow('RogueWindows');
            if (row) {
                input.feed(row.key);
                pickingTarget = false;
            }
            else
                input.feed(' ');
            return;
        }
        input.feed('\x1b');
    };
    await rhack('m'.charCodeAt(0));
    input.beforeRead = null;
    assert.ok(pickerScreens.some(view => /Select rogue level symbol set:/.test(view)));
    assert.ok(pickerScreens.some(view => / [-+*#] RogueIBM /.test(view)));
    assert.ok(pickerScreens.some(view => view.includes('rogue level color symbol set like Epyx Rogue')));
    assert.ok(!pickerScreens.some(view => / [-+*#] DECgraphics /.test(view)), 'a primary-restricted set stays out of the rogue picker');
    assert.equal(game.rogueSymset, 'RogueWindows');
});
// options.c:doset_simple() swaps the simple menu's symset row for the
// rogue set's while the hero is on the Rogue level.
void test('the simple options menu offers roguesymset on the Rogue level', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    game.rogueSymset = 'RogueIBM';
    const input = resetInputState();
    const views = [];
    let pickingOption = true;
    let pickingTarget = false;
    input.beforeRead = () => {
        if (pickingOption) {
            views.push(screen());
            const rogueRow = menuRow('roguesymset');
            if (rogueRow) {
                input.feed(rogueRow.key);
                pickingOption = false;
                pickingTarget = true;
            }
            else
                input.feed(' ');
            return;
        }
        if (pickingTarget) {
            const row = menuRow('RogueEpyx');
            if (row) {
                input.feed(row.key);
                pickingTarget = false;
            }
            else
                input.feed(' ');
            return;
        }
        input.feed('\x1b');
    };
    await rhack('O'.charCodeAt(0));
    input.beforeRead = null;
    delete game.rogue_level;
    assert.ok(views.some(view => / [-+*#] roguesymset +\[RogueIBM, active\]/.test(view)), 'the symset row is replaced by the active rogue set');
    assert.ok(!views.some(view => / [-+*#] symset /.test(view)), 'the primary symset row is hidden on the Rogue level');
    assert.equal(game.rogueSymset, 'RogueEpyx');
});
// clear_all_glyphmap_colors() runs before the new set's G_ wall colors are
// applied, so remembered branch walls trade their color with every switch.
void test('switching symbol sets recolors remembered branch walls', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const location = game.level?.at(3, 2);
    assert.ok(location, 'the map exposes the test cell');
    location.remembered_glyph = { ch: '-', color: NO_COLOR, decgfx: false,
        kind: 'terrain', terrainName: 'wall',
        glyph: cmapToGlyph(CmapSymbol.hwall, GlyphOffset.cmapMines) };
    const cell = { column: 2, row: 3 };
    await driveOptionWindow('symset', 'DECgraphics');
    assert.equal(requireScreenCell(cell.column, cell.row).color, CLR_BROWN);
    await driveOptionWindow('symset', 'Default Symbols');
    assert.equal(requireScreenCell(cell.column, cell.row).color, NO_COLOR);
});
// DECgraphics redraws pool, ice, lava and water glyphs too; those live in
// the cmap range after the grave, and doredraw() repaints them from the
// new showsyms.
void test('switching to DECgraphics redraws a remembered pool', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const location = game.level?.at(3, 2);
    assert.ok(location, 'the map exposes the test cell');
    location.remembered_glyph = { ch: '}', color: NO_COLOR, decgfx: false,
        kind: 'terrain', terrainName: 'water',
        glyph: cmapToGlyph(CmapSymbol.pool) };
    const cell = { column: 2, row: 3 };
    await driveOptionWindow('symset', 'DECgraphics');
    assert.equal(requireScreenCell(cell.column, cell.row).ch, '\u25c6');
    await driveOptionWindow('symset', 'Default Symbols');
    assert.equal(requireScreenCell(cell.column, cell.row).ch, '}');
});
// do_symset() leaves defindx at 0 when the current primary choice has no
// row in the picker (a rogue-restricted set like RogueEpyx), so an empty
// pick is nothing_to_do and the display keeps the Rogue symbols.
void test('an empty picker pick keeps an unlisted primary set displayed', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=symset:RogueEpyx');
    const cell = installLadderUp(12, 8);
    await flush_screen(1);
    assert.equal(requireScreenCell(cell.column, cell.row).ch, '<');
    const input = resetInputState();
    const pickerViews = [];
    let sentPrefix = false;
    let pickingOption = true;
    let submitting = false;
    let pickingTarget = false;
    input.beforeRead = () => {
        if (!sentPrefix) {
            sentPrefix = true;
            input.feed('O');
            return;
        }
        if (pickingOption) {
            const row = menuRow('symset');
            if (row) {
                input.feed(row.key);
                pickingOption = false;
                submitting = true;
            }
            else
                input.feed(' ');
            return;
        }
        if (submitting) {
            submitting = false;
            pickingTarget = true;
            input.feed('\n');
            return;
        }
        if (pickingTarget) {
            pickerViews.push(screen());
            pickingTarget = false;
            // Enter with no row picked and no preset row: nothing to do.
            input.feed('\n');
            return;
        }
        input.feed('\x1b');
    };
    await rhack('m'.charCodeAt(0));
    input.beforeRead = null;
    delete game.rogue_level;
    assert.ok(pickerViews.some(view => /Select symbol set:/.test(view)), 'selecting symset opened the picker');
    assert.equal(game.symset, 'RogueEpyx');
    assert.equal(game.shownSymbols, undefined);
    // The full-menu overlay leaves the physical screen for the next redraw.
    await docrt();
    await flush_screen(1);
    assert.equal(requireScreenCell(cell.column, cell.row).ch, '<');
});
//# sourceMappingURL=symset_picker.test.js.map