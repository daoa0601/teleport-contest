// C win/tty/termcap.c:nomux_capture_screen(), :nomux_get_cursor(),
// :nomux_raw_emit() — the recorder's NOMUX shadow-capture state.
//
// nomux_capture_screen() serializes the 24x80 shadow into the fixed
// static buffer `char nomux_out[24 * 256]` with no bounds check. In the
// recorder binary the linker places the raw-mode cursor globals right
// behind that buffer (nm -n recorder/src/nethack):
//
//   nomux_out        0x1004e699e .. 0x1004e819d   (6144 bytes)
//   nomux_raw_active 0x1004e81a0                  (+6146)
//   nomux_raw_row    0x1004e81a4                  (+6150)
//   nomux_raw_col    0x1004e81a8                  (+6154)
//
// A captured screen that serializes to 6146 bytes or more therefore
// writes past nomux_out and clobbers nomux_raw_active (little-endian,
// one byte per serialized position, terminator NUL included), latching
// the capture into raw mode from that boundary on; 6150+ bytes clobber
// nomux_raw_row and 6154+ bytes nomux_raw_col. After the latch,
// nomux_get_cursor() reports the raw-mode (col,row) at every capture
// instead of the tty cursor — the #terrain getpos tip screen crosses the
// threshold, so every following boundary in such a session records
// cursor (0,0) — and nomux_raw_emit() stops discarding the empty
// separator print of tty_suspend_nhwindows() and keeps writing at the
// latched raw cursor, so the endgame score notice gains one leading
// blank row above it.
import { DEC_TO_UNICODE } from './terminal.js';
const RAW_ACTIVE_AT = 6146;
const RAW_ROW_AT = 6150;
const RAW_COL_AT = 6154;
function stompedByte(rawScreen, index) {
    // The serializer writes the payload bytes and then a terminating NUL
    // one past the last payload position (termcap.c `*p = '\0'`).
    return index < rawScreen.length ? rawScreen.charCodeAt(index) & 0xff : 0;
}
/** Little-endian assembly of the bytes a capture actually wrote. */
function clobberedInt(rawScreen, start, current) {
    let value = current;
    for (let offset = 0; offset < 4; offset++) {
        const index = start + offset;
        // Positions past the NUL terminator were never written; the
        // previous contents of the clobbered field survive there.
        if (index > rawScreen.length)
            break;
        const byte = stompedByte(rawScreen, index);
        const shift = offset * 8;
        value = (value & ~(0xff << shift)) | (byte << shift);
    }
    // Signed 32-bit value, like the int it clobbers.
    return value | 0;
}
/** nomux_sgr_fg(): shadow cells hold palette indices; the wire holds SGR codes. */
function sgrFgCode(color) {
    if (typeof color !== 'number')
        return 39;
    return color === 16 || color === 0 ? 90
        : color === 7 || color === 8 || color < 0 || color > 15
            ? 39 : color < 8 ? 30 + color : 90 + color - 8;
}
/**
 * C termcap.c:nomux_capture_screen() over the shadow grid: every row of
 * the fixed 24x80 buffer is visited with its separator newline, trailing
 * unstyled blanks are trimmed per row, attribute and color changes each
 * emit their own escape, and the DEC-graphics shift follows each cell.
 * The session's stored wire form compresses this byte stream; the
 * overflow it causes can only be measured on these exact bytes.
 */
export function nomuxCaptureBytes(grid, decGraphics) {
    const decOf = new Map(Object.entries(DEC_TO_UNICODE).map(([dec, unicode]) => [unicode, dec]));
    const rows = [];
    for (let row = 0; row < 24; row++) {
        const cells = grid[row] ?? [];
        let end = Math.min(cells.length, 80) - 1;
        while (end >= 0) {
            const cell = cells[end];
            if (!cell)
                break;
            if (cell.ch !== ' ' || cell.attr !== 0)
                break;
            const code = sgrFgCode(cell.color);
            if (code !== 39 && code !== 30)
                break;
            end--;
        }
        let line = '';
        let fg = 39, attr = 0, dec = false;
        for (let col = 0; col <= end; col++) {
            const cell = cells[col] ?? { ch: ' ', color: 7, attr: 0 };
            const nextFg = sgrFgCode(cell.color);
            const nextAttr = cell.attr | 0;
            if (nextAttr !== attr) {
                if (nextAttr & 1 && !(attr & 1))
                    line += '\x1b[7m';
                if (!(nextAttr & 1) && attr & 1)
                    line += '\x1b[27m';
                if (nextAttr & 2 && !(attr & 2))
                    line += '\x1b[1m';
                if (!(nextAttr & 2) && attr & 2)
                    line += '\x1b[22m';
                if (nextAttr & 4 && !(attr & 4))
                    line += '\x1b[4m';
                if (!(nextAttr & 4) && attr & 4)
                    line += '\x1b[24m';
                attr = nextAttr;
            }
            if (nextFg !== fg) {
                line += `\x1b[${nextFg}m`;
                fg = nextFg;
            }
            const decChar = decGraphics ? decOf.get(cell.ch) ?? null : null;
            const nextDec = decChar != null;
            if (nextDec !== dec) {
                line += nextDec ? '\x0e' : '\x0f';
                dec = nextDec;
            }
            line += decChar ?? cell.ch;
        }
        if (dec)
            line += '\x0f';
        if (attr)
            line += '\x1b[0m';
        else if (fg !== 39)
            line += '\x1b[39m';
        rows.push(line);
    }
    return rows.join('\n');
}
/**
 * C termcap.c:nomux_raw_putch() clipping for the characters of one raw
 * line: characters typed before column 0 or past the last column are
 * dropped, and the first one that fits paints at the column it reached.
 */
export function nomuxRawPaintText(text, col, cols) {
    if (col < 0)
        return { col: 0, text: text.slice(-col) };
    if (col >= cols)
        return { col, text: '' };
    return { col, text: text.slice(0, cols - col) };
}
export class NomuxCapture {
    rawActive = 0;
    rawRow = 0;
    rawCol = 0;
    /** C termcap.c:nomux_capture_screen() writing past nomux_out. */
    capture(rawScreen) {
        // Indices below RAW_ACTIVE_AT stay inside the buffer; the last
        // written index is rawScreen.length (the NUL terminator).
        if (rawScreen.length < RAW_ACTIVE_AT)
            return;
        this.rawActive = clobberedInt(rawScreen, RAW_ACTIVE_AT, this.rawActive);
        this.rawRow = clobberedInt(rawScreen, RAW_ROW_AT, this.rawRow);
        this.rawCol = clobberedInt(rawScreen, RAW_COL_AT, this.rawCol);
    }
    /** Whether the capture latch is set (nomux_raw_active != 0). */
    isLatched() {
        return this.rawActive !== 0;
    }
    /** C termcap.c:nomux_get_cursor(). */
    cursor(col, row) {
        return this.rawActive !== 0 ? [this.rawCol, this.rawRow] : [col, row];
    }
    /**
     * C termcap.c:nomux_raw_emit() for tty_suspend_nhwindows("")'s empty
     * separator: discarded only while raw mode is inactive.
     */
    suspendSeparator() {
        if (this.rawActive === 0)
            return false;
        this.rawRow++;
        this.rawCol = 0;
        return true;
    }
    /**
     * C termcap.c:nomux_raw_emit()/nomux_enter_raw_mode() for one
     * post-teardown raw line: entering raw mode resets the cursor to the
     * origin, a latched one keeps its position, and the characters then
     * run from the raw column with nomux_raw_putch()'s bounds — nothing
     * paints once the row reaches the screen height.
     */
    rawEmitLine() {
        if (this.rawActive === 0) {
            this.rawActive = 1;
            this.rawRow = 0;
            this.rawCol = 0;
        }
        const at = this.rawRow < 24 && this.rawRow >= 0
            ? { row: this.rawRow, col: this.rawCol } : null;
        this.rawRow++;
        this.rawCol = 0;
        return at;
    }
}
//# sourceMappingURL=tty_nomux.js.map