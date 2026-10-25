import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { docrt, flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
function fileErrors(rc) {
    return parseNethackrc(rc).configErrors[0]?.errors ?? [];
}
// options.c:optfn_boulder() writes the override into both symbol sets, so
// it also reaches the Rogue level; the BOULDER= statement (cfgfiles.c
// cnf_line_BOULDER()) fills the primary set only.
void test('the boulder option overrides the Rogue level boulder symbol', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=boulder:\\57');
    game.rogue_level = { ...game.u.uz };
    await floorObject(BOULDER, 11, 10, { dknown: true });
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '9');
    delete game.rogue_level;
});
void test('the BOULDER statement leaves the Rogue level boulder symbol alone', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    applyNethackrc('BOULDER=57');
    game.rogue_level = { ...game.u.uz };
    await floorObject(BOULDER, 11, 10, { dknown: true });
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '`');
    delete game.rogue_level;
    // Off the Rogue level the statement still applies.
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '9');
});
void test('the boulder option refuses clashing symbols', () => {
    assert.deepEqual(fileErrors('OPTIONS=boulder:a').map(error => error.message), ["Badoption - boulder symbol 'a' would conflict with a monster symbol"]);
    assert.deepEqual(fileErrors('OPTIONS=boulder:2').map(error => error.message), ["Badoption - boulder symbol '2' would conflict with a warning symbol"]);
    assert.deepEqual(fileErrors('OPTIONS=boulder:^A').map(error => error.message), ['boulder symbol cannot be a control character']);
    assert.deepEqual(fileErrors('OPTIONS=boulder:').map(error => error.message), ["Missing parameter for 'boulder:'"]);
    assert.deepEqual(fileErrors('OPTIONS=boulder').map(error => error.message), ["Missing parameter for 'boulder'"]);
    // string_for_opt() echoes the element as typed.
    assert.deepEqual(fileErrors('OPTIONS=BOULDER').map(error => error.message), ["Missing parameter for 'BOULDER'"]);
    // char is signed natively, so an escaped high byte is a negative
    // control character there.
    assert.deepEqual(fileErrors('OPTIONS=boulder:\\200').map(error => error.message), ['boulder symbol cannot be a control character']);
    // '0' is warning symbol zero, which the C clash test skips.
    assert.deepEqual(fileErrors('OPTIONS=boulder:0').map(error => error.message), []);
});
// pager.c resolves ROCK_CLASS against the boulder override in the typed
// look pass, so the default '`' stops meaning boulder while the override
// character gains the meaning.
void test('typed look moves the boulder meaning to the override symbol', async () => {
    freshObjectRoom({ flags: { tips: false, help: false } });
    applyNethackrc('OPTIONS=boulder:0');
    const first = resetInputState();
    first.feed('/?0\n');
    await rhack(0);
    await flush_screen(1);
    const zero = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '';
    const second = resetInputState();
    second.feed('/?`\n');
    await rhack(0);
    await flush_screen(1);
    const grave = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '';
    assert.match(zero, /^0 +a boulder or an iron ball$/, zero);
    assert.doesNotMatch(grave, /boulder/, grave);
    assert.match(grave, /^` +an engraving$/, grave);
});
function screen() {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}
// Mirrors the fullOptions() driver from options_interactive.test.ts: open
// the full menu with 'm'+'O', page to `option`, toggle it, submit with
// Enter, then answer the follow-up prompt with `response` one key at a
// time.
async function editViaFullMenu(option, response) {
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    let selecting = true;
    let picked = false;
    let answer = '';
    input.beforeRead = () => {
        const view = screen();
        if (!selecting) {
            if (!answer)
                answer = view.includes(`Set ${option} to what?`) ? response : '\x1b';
            input.feed(answer.charAt(0));
            answer = answer.slice(1);
            return;
        }
        if (picked) {
            // One pick only; the menu letters are page-local, so re-reading
            // the same page would toggle the row off again.
            selecting = false;
            input.feed('\n');
            return;
        }
        const row = view.split('\n').find(line => line.replace(/^\s*[a-zA-Z?] [-+*#] /, '').startsWith(`${option} `));
        const key = row?.match(/^\s*([a-zA-Z]) [-+] /)?.[1];
        if (key && row) {
            input.feed(key);
            picked = true;
        }
        else
            input.feed(' ');
    };
    input.feed('O');
    await command;
    input.beforeRead = null;
}
// optfn_boulder() refreshes showsyms[SYM_BOULDER] and doredraw() repaints
// every boulder glyph, so a boulder already on the map changes symbol at
// once when the option is set from the options menu.
void test('changing the boulder option mid-game redraws displayed boulders', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    // A remembered boulder outside the room: doredraw() repaints it from
    // glyph memory, not from a live projection of the floor.
    const location = game.level?.at(3, 2);
    assert.ok(location, 'the map exposes the test cell');
    location.remembered_glyph = { ch: '`', color: 7, decgfx: false,
        kind: 'object', otyp: BOULDER, glyph: GlyphOffset.object + BOULDER,
        statueGlyph: false, piletop: false };
    const cell = { column: 2, row: 3 };
    await editViaFullMenu('boulder', '9\n');
    // The full-menu overlay leaves the physical screen for the next
    // redraw; doredraw() is what repaints the boulder with its new symbol.
    await docrt();
    await flush_screen(1);
    assert.equal(game.boulderSym, '9');
    assert.equal(requireScreenCell(cell.column, cell.row).ch, '9');
});
// optfn_boulder() get_val falls back to the active set's rock-class
// symbol, which Blank replaces with \032 on the Rogue level.
void test('the options menu boulder row follows the displayed rock symbol', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=roguesymset:Blank');
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    let row = null;
    input.beforeRead = () => {
        const found = screen().split('\n').find(line => line.replace(/^\s*[a-zA-Z?] [-+*#] /, '').startsWith('boulder '));
        if (found) {
            row = found;
            input.feed('\x1b');
        }
        else
            input.feed(' ');
    };
    input.feed('O');
    await command;
    input.beforeRead = null;
    delete game.rogue_level;
    assert.ok(row, 'the full options menu offered the boulder row');
    assert.match(row, /boulder +\[\x1a\]/);
});
//# sourceMappingURL=boulder_symbol_option.test.js.map