import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNethackrc } from '../js/cfgfiles.js';
import { addMessageTypeRule } from '../js/message_types.js';
import { luaPline } from '../js/lua/messages.js';
import { rawPrint } from '../js/input.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
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
    // nhlua.c nhl_pline() hands luaL_checkstring's bytes to pline("%s"):
    // Lua source is UTF-8, so the message holds one character per byte.
    const rules = [];
    assert.equal(addMessageTypeRule('hide "^\xC3\xA9$"', rules), null);
    game.iflags.messageTypes = rules;
    game._lastPlineMessage = 'sentinel';
    await luaPline('é');
    // The two bytes match the whole-line pattern, so the message is hidden
    // and the previous line stays the last one shown.
    assert.equal(game._lastPlineMessage, 'sentinel');
    delete game.iflags.messageTypes;
    await luaPline('é');
    assert.equal(game._lastPlineMessage, '\xC3\xA9');
    assert.equal(game._pending_message, '\xC3\xA9');
});
void test('raw output resumes over painted cells without clearing the row', () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    rawPrint('first');
    assert.equal(display.cursorRow, 1);
    // Painting continues through nomux_putch() while raw mode is active.
    display.putstr(0, display.cursorRow, 'existing tail');
    rawPrint('X');
    // nomux_raw_putch() overwrites only the cells its bytes reach: the
    // first byte replaces 'e' and the rest of the painted row survives.
    const row = display.grid[1]?.map(cell => cell.ch).join('') ?? '';
    assert.equal(row.trimEnd(), 'Xxisting tail');
});
//# sourceMappingURL=rc_bytes.test.js.map