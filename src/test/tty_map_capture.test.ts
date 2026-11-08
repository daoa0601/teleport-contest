import test from 'node:test';
import assert from 'node:assert/strict';
import { GameDisplay } from '../js/game_display.js';
import { serializeCapture } from '../js/jsmain.js';
import { CLR_BLUE, CLR_BROWN, CLR_GREEN, NO_COLOR } from '../js/terminal.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';

void test('a control glyph keeps the retained cell out of the alternate font', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, 'x', CLR_GREEN, 0, null);
    // An AmigaFont glyph such as the 0x91 door strips to the 0x11 control
    // byte; the recorder leaves the previous cell entirely unchanged.
    display.setMapCell(4, 3, '\x11', NO_COLOR, 0, null, false, true);

    const captured = serializeCapture(display);
    const row = captured.split('\n')[3] ?? '';
    assert.equal(decodeScreen(captured)[3]?.[4]?.ch, 'x');
    assert.ok(!row.includes('\x0e'),
        `the retained cell carries no alternate-font shift: ${JSON.stringify(row)}`);
});

void test('a control glyph keeps a shifted cell inside its shift', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, '\u2502', CLR_GREEN, 0, null, false, true);
    display.setMapCell(4, 3, '\x01', NO_COLOR, 0, null, false, false);

    const row = serializeCapture(display).split('\n')[3] ?? '';
    assert.ok(/\x0e[^\x0f]*x\x1b\[[0-9;]*m\x0f$/.test(row),
        `the retained wall keeps its shift, closed after the color reset: ${JSON.stringify(row)}`);
});

// termcap.c nomux_capture_screen() writes the end-of-line color/attr reset
// first and closes the alternate-font run after it (`if (in_dec) \017`).
void test('a row ending inside a shift resets its color before closing the shift', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, '\u2502', CLR_BLUE, 2, null, false, true);

    const row = serializeCapture(display).split('\n')[3] ?? '';
    assert.ok(/\x0e[^\x0f]*x\x1b\[[0-9;]*m\x0f$/.test(row),
        `the shift closes after the reset: ${JSON.stringify(row)}`);
    assert.ok(!row.includes('\x0f\x1b['),
        `no escape follows the shift close: ${JSON.stringify(row)}`);
});

void test('the tty capture records an IBM wall while the live display retains its symbol', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, '\xcd', CLR_BROWN, 0, null, true);

    const recorded = decodeScreen(serializeCapture(display));

    assert.equal(recorded[3]?.[4]?.ch, 'M');
    assert.equal(recorded[3]?.[4]?.color, CLR_BROWN);
    assert.equal(display.grid[3]?.[4]?.ch, '\xcd');
});

void test('a control glyph leaves the previous recorded terrain and color visible', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, '.', CLR_GREEN, 0, null, true);
    display.setMapCell(4, 3, '\x01', NO_COLOR, 0, null, true);

    const recorded = decodeScreen(serializeCapture(display));

    assert.equal(recorded[3]?.[4]?.ch, '.');
    assert.equal(recorded[3]?.[4]?.color, CLR_GREEN);
});

void test('erasing or writing text over a captured map cell removes its old glyph', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, '\xcd', CLR_BROWN, 0, null, true);
    display.clearRow(3);
    display.setMapCell(4, 3, '\x01', NO_COLOR, 0, null, true);
    assert.equal(decodeScreen(serializeCapture(display))[3]?.[4]?.ch, ' ');

    display.setMapCell(4, 3, '\xcd', CLR_BROWN, 0, null, true);
    display.putstr(4, 3, 'hello');
    assert.equal(decodeScreen(serializeCapture(display))[3]?.[4]?.ch, 'h');
});

void test('a browser repaint preserves recorded terrain below a control glyph until the native screen is cleared', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, '\xfa', CLR_GREEN, 0, null, true);
    display.repaintScreen();
    display.setMapCell(4, 3, '\x01', NO_COLOR, 0, null, true);
    assert.equal(decodeScreen(serializeCapture(display))[3]?.[4]?.ch, 'z');

    display.clearScreen();
    display.setMapCell(4, 3, '\x01', NO_COLOR, 0, null, true);
    assert.equal(decodeScreen(serializeCapture(display))[3]?.[4]?.ch, ' ');
});

void test('Unicode glyph output retains Latin-1 characters without byte conversion', () => {
    const display = new GameDisplay(null);
    display.setMapCell(4, 3, '\u00b7', CLR_GREEN, 0, null);

    assert.equal(decodeScreen(serializeCapture(display))[3]?.[4]?.ch, '\u00b7');
});
