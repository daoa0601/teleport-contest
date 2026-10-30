import test from 'node:test';
import assert from 'node:assert/strict';
import { GameDisplay } from '../js/game_display.js';
import { serializeCapture } from '../js/jsmain.js';
import { CLR_BROWN, CLR_GREEN, NO_COLOR } from '../js/terminal.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
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
//# sourceMappingURL=tty_map_capture.test.js.map