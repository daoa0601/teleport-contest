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
// separator print of tty_suspend_nhwindows(), which paints one extra
// blank row above the endgame score notice.
const RAW_ACTIVE_AT = 6146;
const RAW_ROW_AT = 6150;
const RAW_COL_AT = 6154;
const RAW_COL_END = 6158;
function stompedByte(rawScreen, index) {
    // The serializer writes the payload bytes and then a terminating NUL
    // one past the last payload position (termcap.c `*p = '\0'`).
    return index < rawScreen.length ? rawScreen.charCodeAt(index) & 0xff : 0;
}
/** Little-endian assembly of at most four adjacent clobbered bytes. */
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
    // Keep the assembled value a non-negative 32-bit quantity.
    return value | 0;
}
export class NomuxCapture {
    rawActive = 0;
    rawRow = 0;
    rawCol = 0;
    /** C termcap.c:nomux_capture_screen() writing past nomux_out. */
    captureRle(screen) {
        // The port serializes straight to the session's run-length form,
        // so the recorded space-run skips (compressAnsiLine) expand back
        // to the per-cell bytes the C serializer emitted.
        const rawScreen = screen.replace(/\x1b\[(\d+)C/g, (_, count) => ' '.repeat(Number(count)));
        // Indices below RAW_ACTIVE_AT stay inside the buffer; the last
        // written index is rawScreen.length (the NUL terminator).
        if (rawScreen.length < RAW_ACTIVE_AT)
            return;
        this.rawActive = clobberedInt(rawScreen, RAW_ACTIVE_AT, this.rawActive);
        this.rawRow = clobberedInt(rawScreen, RAW_ROW_AT, this.rawRow);
        this.rawCol = clobberedInt(rawScreen, RAW_COL_AT, this.rawCol);
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
     * C termcap.c:nomux_raw_emit()/nomux_enter_raw_mode() for the
     * post-teardown topten lines. Each print writes its characters and a
     * trailing newline, leaving the raw cursor at the next row, column 0.
     */
    rawEmitLine() {
        this.rawActive = 1;
        this.rawRow++;
        this.rawCol = 0;
    }
}
//# sourceMappingURL=tty_nomux.js.map