import assert from 'node:assert/strict';
import test from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { screenText } from './support/screen.js';
import { memoryStorage } from './support/memory-storage.js';
// The recorder's NOMUX shadow capture (win/tty/termcap.c) serializes the
// screen into a fixed 6144-byte buffer that the linker places directly
// in front of nomux_raw_active. The wizard-mode #terrain full map of the
// Gehennom swamp serializes past that buffer, so from the boundary that
// dismisses the getpos tip every recorded cursor is the raw-mode (0,0)
// instead of the tty map cursor, and the wizard-mode score notice at the
// end gains the blank separator row of tty_suspend_nhwindows() with the
// final cursor three rows down — the behavior the recorded sessions show.
const NETHACKRC = [
    'OPTIONS=name:Holdout,role:ranger,race:human,gender:female,align:neutral,!legacy,!tutorial,!news,symset:DECgraphics,time,!autopickup,runmode:run',
    'OPTIONS=playmode:debug,disclose:-i -a -v -g -c -o',
].join('\n');
// Deterministic wizard setup for seed 924506948: raise to experience
// level 20 (the blank runs dismiss the level-change reports), teleport
// to dungeon level 35 (its level fills with remembered dark-room and
// wall glyphs), then run #terrain's "full map" view. The tip window and
// the getpos goal message share the message line, exactly as recorded.
const SETUP = ' #levelchange\r20\r'
    + ' '.repeat(19) + '\x1635\r'
    + '   ' + '\x1635\r'
    + '#ri\rjnb';
const MOVES = SETUP + '#te\rd \x1bb'
    + ',#quit\ryn ';
const row = (screen, index) => screenText(screen).split('\n')[index] ?? '';
void test('an oversized terrain capture switches the recorded cursor to raw mode', async () => {
    const engine = await runSegment({
        seed: 924506948, datetime: '20000417080000', nethackrc: NETHACKRC,
        moves: MOVES, storage: memoryStorage(),
    });
    const cursors = engine.getCursors();
    const screens = engine.getScreens();
    const tip = screens.findIndex(s => /Tip: Farlooking/.test(row(s, 0)));
    assert.ok(tip >= 0, 'the getpos tip window must appear on the message row');
    const dismissTip = cursors[tip];
    assert.ok(dismissTip, 'the tip boundary must have a cursor');
    assert.match(row(screens[tip] ?? '', 0), /Tip: Farlooking or selecting a map location/);
    assert.deepEqual(dismissTip.slice(0, 2), [16, 8], 'the tip window keeps the tty cursor on its (end) prompt');
    const goal = cursors.at(tip + 1);
    assert.ok(goal, 'the boundary after the tip must have a cursor');
    assert.equal(row(screens[tip + 1] ?? '', 0), "(For instructions type a '?')  Move cursor to anything of interest:");
    assert.deepEqual(goal.slice(0, 2), [0, 0], 'the capture that overflows the buffer reports the raw-mode cursor');
    const browse = cursors.at(tip + 2);
    assert.ok(browse, 'the browsing boundary must have a cursor');
    assert.equal(row(screens[tip + 2] ?? '', 0), 'floor of a room');
    assert.deepEqual(browse.slice(0, 2), [0, 0], 'the raw-mode latch persists across later boundaries');
    const final = cursors.at(-1);
    assert.ok(final, 'the quit flow must produce a final cursor');
    const endRows = screenText(screens.at(-1) ?? '').split('\n');
    assert.equal(endRows[0], '');
    assert.equal(endRows[1], '');
    assert.match(endRows[2] ?? '', /^Since you were in wizard mode, the score list will not be checked\./);
    assert.deepEqual(final.slice(0, 2), [0, 3], 'the latched raw mode keeps the empty separator row and ends three rows down');
});
//# sourceMappingURL=terrain_getpos_capture_cursor.test.js.map