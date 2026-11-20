import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { parseNethackrc } from '../js/cfgfiles.js';
import { addMessageTypeRule } from '../js/message_types.js';
import { luaPline } from '../js/lua/messages.js';
import { pushKey, rawPrint } from '../js/input.js';
import { editExtendedCommand } from '../js/query.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { runSegment, serializeCapture } from '../js/jsmain.js';
import { ATR_INVERSE, CLR_BROWN, CLR_GREEN, NO_COLOR } from '../js/terminal.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
// The recorded harness wrote each session's .nethackrc to disk as UTF-8,
// so native NetHack parsed one byte per non-ASCII character (cfgfiles.c
// parse_conf_buf()/optfn_name() copy bytes). Those bytes reach the tty:
// nomux_putch() drops a signed high byte and leaves the cell's previous
// contents in place, and raw-printed diagnostics fill a captured row with
// bytes before the recorder decodes that row as UTF-8.
void test('a non-ASCII name is parsed as its UTF-8 bytes', () => {
    // options.c optfn_name()'s nmcpy() copies bytes: "ë" is two bytes to C.
    // cfgfiles.c cnf_line_NAME()'s strncpy() stops at PL_NSIZ-1 bytes and
    // can split a sequence; C keeps the first byte of "ë".
    const statement = parseNethackrc(`NAME=${'x'.repeat(28)}Zoë\n`);
    assert.equal(statement.name, `${'x'.repeat(28)}Zo\xC3`);
});
void test('a name ending in a non-breaking-space byte survives the option parse', () => {
    // à is C3 A0. JS trim() folds 0xA0 (NBSP) as whitespace; C's
    // isspace() in the C locale never does, so string_for_opt() and
    // nmcpy() keep both bytes of the name.
    const options = parseNethackrc('OPTIONS=name:Zoà\n');
    assert.equal(options.name, 'Zo\xC3\xA0');
});
void test('a typed extended command keeps a trailing NBSP byte', async () => {
    freshPlayableRoom();
    // getline.c tty_get_ext_cmd() runs mungspaces() — folding only ' '
    // and '\t' — and requires an exact extcmds_match(): the 0xA0 byte
    // stays in "version\xA0", so the command is unknown. JS trim()
    // would strip it and run #version.
    for (const character of 'version\xA0\n')
        pushKey(character.charCodeAt(0));
    const command = await editExtendedCommand();
    assert.equal(command, null);
});
void test('a non-ASCII name skips cells in the greeting and the status title', async () => {
    const engine = await runSegment({
        seed: 4242, datetime: '20260801120000', moves: '',
        nethackrc: 'OPTIONS=name:Zoë,role:Valkyrie,race:human,gender:female,'
            + 'align:neutral,!legacy,!tutorial,pettype:none\n',
        storage: memoryStorage(),
    });
    const rows = engine.display?.grid.map(row => row.map(cell => cell.ch).join('')) ?? [];
    // Both bytes of "ë" are signed high bytes to nomux_putch(): each cell
    // keeps its blank and the cursor advances, so the name shows as two
    // retained blanks in the topline and the status title.
    assert.match(rows[0] ?? '', /^Velkommen Zo  , welcome to NetHack!/);
    const title = rows.find(row => row.includes('the Stripling')) ?? '';
    assert.match(title, /^Zo   the Stripling/);
});
void test('raw config diagnostics fill a captured row with bytes', async () => {
    const engine = await runSegment({
        seed: 777, datetime: '20260801120000', moves: '\n',
        nethackrc: 'OPTIONS=name:Ångström,role:Tourist,race:human,gender:male,'
            + 'align:neutral,!legacy,!tutorial,pettype:none,zzïé\n',
        storage: memoryStorage(),
    });
    const rows = (engine.getScreens()[0] ?? '').split('\n');
    // The echoed statement line fills the row with 80 BYTES (Å and ö are
    // two bytes each), and the recorder decodes the captured row as UTF-8:
    // the row keeps 78 characters and ends mid-word, and the overflow is
    // dropped rather than wrapped.
    assert.equal(rows[1], 'OPTIONS=name:Ångström,role:Tourist,race:human,gender:male,align:neutral,!legac');
    // The unknown-option diagnostic quotes C's bytes; the recorder's row
    // decode merges them back into one character per non-ASCII character.
    assert.equal(rows[2], " * Line 1: Unknown option 'zzïé'.");
    // The summary line is cut by the same 80-byte row limit.
    assert.equal(rows[4]?.length, 80);
    assert.match(rows[4] ?? '', /^1 error in /);
});
void test('engine screens stay comparable for an ASCII rc', async () => {
    const engine = await runSegment({
        seed: 4242, datetime: '20260801120000', moves: '',
        nethackrc: 'OPTIONS=name:Traveler,role:Valkyrie,race:human,gender:female,'
            + 'align:neutral,!legacy,!tutorial,pettype:none\n',
        storage: memoryStorage(),
    });
    const rows = engine.display?.grid.map(row => row.map(cell => cell.ch).join('')) ?? [];
    assert.match(rows[0] ?? '', /^Velkommen Traveler, welcome to NetHack!/);
});
void test('a Lua pline message carries the source UTF-8 bytes', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    const topline = () => display.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
    const before = topline();
    // nhlua.c nhl_pline() hands luaL_checkstring's bytes to pline("%s"):
    // Lua source is UTF-8, so the message "abé" holds five bytes. Only a
    // two-byte pattern reaches the é, and the match decides visibility.
    const twoBytes = [];
    assert.equal(addMessageTypeRule('hide "^ab..$"', twoBytes), null);
    game.iflags.messageTypes = twoBytes;
    await luaPline('abé');
    assert.equal(topline(), before);
    const oneByte = [];
    assert.equal(addMessageTypeRule('hide "^ab.$"', oneByte), null);
    game.iflags.messageTypes = oneByte;
    const shown = luaPline('abé', true);
    pushKey(10);
    await shown;
    // Not matched, so the line shows and pages: 'ab' paints, both of é's
    // bytes skip their topline cells (two blanks survive), and the é
    // glyph itself never appears.
    assert.equal(topline(), 'ab  --More--');
});
void test('raw output resumes over painted cells without clearing the row', () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    rawPrint('first');
    assert.equal(display.cursorRow, 1);
    // Painting continues through nomux_putch() while raw mode is active.
    display.putstr(0, display.cursorRow, 'existing tail');
    // A one-byte raw write replaces the first byte cell; the painted tail
    // keeps its byte cells and decodes back verbatim.
    rawPrint('X');
    const resumed = display.grid[1]?.map(cell => cell.ch).join('') ?? '';
    assert.equal(resumed.trimEnd(), 'Xxisting tail');
    // "é" is two bytes to the shadow: they consume the first two byte
    // cells, and the row decode yields one character followed by the
    // tail from the third byte cell on.
    display.putstr(0, display.cursorRow, 'existing tail');
    display.setCursor(0, display.cursorRow);
    rawPrint('\xC3\xA9');
    const merged = display.grid[2]?.map(cell => cell.ch).join('') ?? '';
    assert.equal(merged.trimEnd(), 'éisting tail');
});
void test('raw output leaves a retained IBM wall glyph in the captured row', () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    rawPrint('first');
    display.setMapCell(1, 1, '\xCD', CLR_BROWN, 0, null, true);
    rawPrint('X');
    // wintty.c g_putch() strips the wall byte's high bit for the capture.
    // termcap.c nomux_raw_putch() overwrites only column 0, retaining M.
    const captured = decodeScreen(serializeCapture(display));
    assert.equal(captured[1]?.[0]?.ch, 'X');
    assert.equal(captured[1]?.[1]?.ch, 'M');
    assert.equal(captured[1]?.[1]?.color, CLR_BROWN);
    assert.equal(display.grid[1]?.[1]?.ch, '\xCD');
});
void test('raw output preserves the painted tail color, inverse video and alternate font', () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    rawPrint('first');
    display.setMapCell(1, 1, '\u2502', CLR_GREEN, ATR_INVERSE, null, false, true);
    display.setCell(2, 1, ' ', NO_COLOR, ATR_INVERSE);
    rawPrint('X');
    const captured = decodeScreen(serializeCapture(display));
    assert.equal(captured[1]?.[1]?.ch, 'x');
    assert.equal(captured[1]?.[1]?.color, CLR_GREEN);
    assert.equal(captured[1]?.[1]?.attr, ATR_INVERSE);
    assert.equal(captured[1]?.[1]?.decgfx, 1);
    assert.equal(captured[1]?.[2]?.ch, ' ');
    assert.equal(captured[1]?.[2]?.attr, ATR_INVERSE);
});
void test('raw UTF-8 moves the styled tail left without losing its cell properties', () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    rawPrint('first');
    display.setCell(2, 1, '!', CLR_GREEN, ATR_INVERSE);
    rawPrint('\xC3\xA9');
    const captured = decodeScreen(serializeCapture(display));
    assert.equal(captured[1]?.[0]?.ch, 'é');
    assert.equal(captured[1]?.[1]?.ch, '!');
    assert.equal(captured[1]?.[1]?.color, CLR_GREEN);
    assert.equal(captured[1]?.[1]?.attr, ATR_INVERSE);
});
//# sourceMappingURL=rc_bytes.test.js.map