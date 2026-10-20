import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeCapture } from '../js/jsmain.js';
import { ATR_INVERSE, NO_COLOR, Terminal } from '../js/terminal.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('an inverse blank alone on its row is recorded like the tty wire output', () => {
    freshPlayableRoom();
    const terminal = new Terminal(null, { cols: 80, rows: 24 });
    // A detected ghost is a space drawn in inverse video.
    terminal.setCell(7, 5, ' ', NO_COLOR, ATR_INVERSE);
    terminal.setCell(3, 6, '#', NO_COLOR);
    terminal.setCell(4, 6, ' ', NO_COLOR, ATR_INVERSE);
    const rows = serializeCapture(terminal).split('\n');
    assert.equal(rows[5], '\x1b[7C\x1b[7m \x1b[0m');
    assert.equal(rows[6], '   #\x1b[7m \x1b[0m', 'a trailing inverse blank stays in the row');
});
//# sourceMappingURL=capture_styled_blank.test.js.map