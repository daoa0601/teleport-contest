import assert from 'node:assert/strict';
import test from 'node:test';
import { NomuxCapture, nomuxCaptureBytes, nomuxRawPaintText } from '../js/tty_nomux.js';
// The recorder's capture contract of win/tty/termcap.c: nomux_capture_
// screen() writes into a 6144-byte buffer whose overflow lands in the
// raw-mode globals at +6146/+6150/+6154, nomux_get_cursor() reports them
// once latched, and nomux_raw_putch() drops everything outside rows
// 0..23 and columns 0..79. These checks drive that pipeline over a real
// serializer output; every expected value is derived from the bytes the
// serializer itself produced, the way C clobbers them.
const cell = (ch, color, attr = 0) => ({ ch, color, attr });
// Alternating colors force one escape per cell, comfortably past the
// recorder's buffer, with known glyph bytes spread through the stream.
const grid = Array.from({ length: 24 }, (_, row) => Array.from({ length: 80 }, (_, col) => cell('x', (row + col) % 2 ? 1 : 2)));
const bytes = nomuxCaptureBytes(grid, false);
const littleEndianAt = (index) => {
    let value = 0;
    for (let offset = 0; offset < 4; offset++) {
        const byte = index + offset < bytes.length
            ? bytes.charCodeAt(index + offset) & 0xff : 0;
        value |= byte << (offset * 8);
    }
    return value | 0;
};
void test('an oversized serialization latches the raw cursor with its own bytes', () => {
    assert.ok(bytes.length > 6158, 'the alternating grid must overflow the buffer');
    const nomux = new NomuxCapture();
    assert.deepEqual(nomux.cursor(12, 7), [12, 7], 'before any latch the tty cursor passes through');
    nomux.capture(bytes);
    assert.deepEqual(nomux.cursor(12, 7), [littleEndianAt(6154), littleEndianAt(6150)], 'the clobbered raw cursor is reported instead');
    const row = littleEndianAt(6150);
    const col = littleEndianAt(6154);
    assert.deepEqual(nomux.rawEmitLine(), row >= 0 && row < 24 ? { row, col } : null, 'a raw line paints only inside nomux_raw_putch() bounds');
    assert.deepEqual(nomux.cursor(12, 7), [0, row + 1], 'the emitted line leaves column 0 on the next raw row');
});
void test('a capture under the threshold leaves the raw cursor alone', () => {
    const small = nomuxCaptureBytes([Array.from({ length: 80 }, () => cell(' ', 7))], false);
    const nomux = new NomuxCapture();
    nomux.capture(small);
    assert.deepEqual(nomux.cursor(12, 7), [12, 7]);
});
void test('raw line text clips at the shadow column bounds', () => {
    assert.deepEqual(nomuxRawPaintText('score', 0, 80), { col: 0, text: 'score' });
    assert.deepEqual(nomuxRawPaintText('score', 78, 80), { col: 78, text: 'sc' });
    assert.deepEqual(nomuxRawPaintText('score', 80, 80), { col: 80, text: '' });
    assert.deepEqual(nomuxRawPaintText('score', 125, 80), { col: 125, text: '' });
    assert.deepEqual(nomuxRawPaintText('score', -2, 80), { col: 0, text: 'ore' });
});
//# sourceMappingURL=tty_nomux_capture.test.js.map