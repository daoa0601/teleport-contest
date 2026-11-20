// game_display.js — NetHack-specific display wrapper around Terminal.
// Edit freely; the contest only freezes isaac64.js and terminal.js.
//
// Adds game-specific display state (status retention, the stopped topline)
// and delegates all terminal operations to the wrapped Terminal instance.
//
// Usage:
//   const terminal = new Terminal('game-container');
//   const display = new GameDisplay(terminal);
//   // display.setCell, display.readKey etc. all delegate to terminal
import { Terminal, CLR_GRAY, NO_COLOR, ATR_INVERSE } from './terminal.js';
import { StatusHighlights } from './botl.js';
export class GameDisplay {
    terminal;
    mapFrameCells = new Set();
    // wintty.c:g_putch() records byte glyphs with their high bit cleared.
    // termcap.c:nomux_putch() leaves a cell alone for control characters.
    capturedMapCells = new Map();
    // win/tty/wintty.c:g_putch() (3758-3763) shifts every high-bit glyph
    // byte into the terminal's alternate font — graph_on()/SO before the
    // byte with its high bit stripped, graph_off()/SI when the run ends —
    // whichever symbol set produced it.  Map cells carry that shift through
    // loc.disp_decgfx and topline cells through their \x0e markers; the
    // serializer reverses it per cell from this provenance set.
    altFontCells = new Set();
    // update_topl() keeps accepting logical text while WIN_STOP hides output.
    stoppedTopline = null;
    // Displaying an empty WIN_MESSAGE can leave its answered question painted.
    preserveEmptyMessageRow = false;
    // WIN_STATUS retains its fields independently of map and message redraws.
    statusLines = null;
    statusHighlights = new StatusHighlights();
    statusLine2Fields = null;
    statusCapacityBlank = false;
    // Tty keeps the replacement prefix until BL_LEVELDESC changes.
    statusLevelPrefixChanged = false;
    // docorner() of a corner window erases the physical top line past its
    // left edge; nothing repaints it until a new message replaces it.
    toplineClipColumn = null;
    statusVisible = true;
    constructor(terminalOrContainerId = null) {
        // A supplied terminal permits headless use; a container ID creates the browser surface.
        if (terminalOrContainerId instanceof Terminal) {
            this.terminal = terminalOrContainerId;
        }
        else {
            this.terminal = new Terminal(terminalOrContainerId != null ? terminalOrContainerId : null, { rows: 24, cols: 80 });
        }
    }
    // --- Delegate all Terminal properties and methods ---
    get rows() { return this.terminal.rows; }
    get cols() { return this.terminal.cols; }
    get grid() { return this.terminal.grid; }
    get captureGrid() {
        if (this.capturedMapCells.size === 0)
            return this.grid;
        return this.grid.map((cells, row) => cells.map((cell, col) => this.capturedMapCells.get(row * this.cols + col) ?? cell));
    }
    // True when the cell's glyph byte reached g_putch() with its high bit
    // set, so the recorded stream wraps it in the alternate-font shift.
    altFontAt(col, row) {
        return this.altFontCells.has(row * this.cols + col);
    }
    get cursorCol() { return this.terminal.cursorCol; }
    set cursorCol(v) { this.terminal.cursorCol = v; }
    get cursorRow() { return this.terminal.cursorRow; }
    set cursorRow(v) { this.terminal.cursorRow = v; }
    get cursorVisible() { return this.terminal.cursorVisible; }
    set cursorVisible(v) { this.terminal.cursorVisible = v; }
    get spans() { return this.terminal.spans; }
    get container() { return this.terminal.container; }
    get flags() { return this.terminal.flags; }
    set flags(v) { this.terminal.flags = v; }
    // Display methods
    // Text reaches the recorded tty frame through nomux_putch(char), whose
    // `ch < 32` guard also rejects a signed byte with the high bit set: the
    // cell keeps its previous character, color, and font.  Map glyphs come
    // through g_putch(), which strips that bit first (setMapCell below).
    setCell(col, row, ch, color, attr, altFont = false) {
        if (!altFont && ch.charCodeAt(0) >= 0x80)
            return;
        this.setFrameCell(col, row, ch, color, attr, altFont);
    }
    // Store a cell exactly: repainting a saved cell, and tty_raw_print(),
    // whose shadow writer takes the byte as unsigned char
    // (nomux_raw_putch((int)(unsigned char)*p)) and so keeps high-bit bytes.
    setFrameCell(col, row, ch, color, attr, altFont = false) {
        const index = row * this.cols + col;
        this.capturedMapCells.delete(index);
        if (altFont)
            this.altFontCells.add(index);
        else
            this.altFontCells.delete(index);
        this.clearMapFrames(col, row, 1);
        this.terminal.setCell(col, row, ch, color, attr);
    }
    // The terminal adapter stores foregrounds and text attributes. Map frame
    // colors belong to the map window and take precedence over pet/inverse
    // highlighting, as tty_print_glyph() does.
    setMapCell(col, row, ch, color, attr, frameColor, byteGlyph = false, altFont = false) {
        const index = row * this.cols + col;
        const current = this.capturedMapCells.get(index) ?? this.grid[row]?.[col];
        const previous = current ? { ...current } : undefined;
        const code = byteGlyph ? ch.charCodeAt(0) & 0x7f : ch.charCodeAt(0);
        // A control glyph leaves the recorded cell exactly as the previous
        // write left it: its character and its alternate-font shift both
        // stay, so the incoming glyph's own font flag must not touch the
        // retained cell.
        const retainsPreviousCell = code < 32 && !!previous;
        this.setFrameCell(col, row, ch, color, frameColor === null ? attr : 0, retainsPreviousCell ? this.altFontCells.has(index) : altFont);
        if (retainsPreviousCell) {
            this.capturedMapCells.set(index, previous);
        }
        else if (byteGlyph) {
            this.capturedMapCells.set(index, {
                ch: String.fromCharCode(code), color, attr: frameColor === null ? attr : 0,
            });
        }
        const span = this.spans?.[row]?.[col];
        if (!span)
            return;
        if (frameColor !== null) {
            span.style.backgroundColor = this.colorToCss(frameColor % 8);
            this.mapFrameCells.add(span);
        }
        else
            span.style.backgroundColor = attr & ATR_INVERSE ? this.colorToCss(color) : '';
    }
    putstr(col, row, str, color, attr) {
        for (let i = 0; i < str.length && col + i < this.cols; i++)
            this.setCell(col + i, row, str.charAt(i), color ?? CLR_GRAY, attr);
    }
    setCursor(col, row) { return this.terminal.setCursor(col, row); }
    clearScreen() {
        this.rawRowBytes = [];
        this.rawRowTailOffset = 0;
        this.capturedMapCells.clear();
        this.repaintScreen();
    }
    // The browser rebuilds its grid on each flush; the tty recorder only
    // changes cells that g_putch() actually writes during that repaint.
    repaintScreen() {
        this.preserveEmptyMessageRow = false;
        for (const span of this.mapFrameCells)
            span.style.backgroundColor = '';
        this.mapFrameCells.clear();
        this.terminal.clearScreen();
    }
    // Port only: repaint every row below the message line, leaving row 0 to
    // the topline writers. C's screen flush never touches the physical top
    // line: redotoplin()/addtopl() paint over the old cells and cl_end()
    // only the tail (topl.c:136-137, 199-200), so a cell under a high-bit
    // byte that nomux_putch() skips survives every later flush.
    repaintRowsBelowTopline() {
        this.preserveEmptyMessageRow = false;
        for (let row = 1; row < this.rows; row++)
            this.repaintRow(row);
        this.terminal.setCursor(0, 0);
    }
    // C win/tty/topl.c:putsyms() followed by cl_end() — redotoplin()'s
    // home(); putsyms(str); cl_end() (topl.c:126, 136-137) and addtopl()'s
    // putsyms(s); cl_end() (topl.c:199-200): paint the cells over whatever
    // the row already holds — nomux_putch() skips a text byte with the high
    // bit set, so that cell keeps its previous contents — then clear only
    // the tail after the last cell. Rows the text wraps onto are cleared
    // from column 0 by topl_putsym('\n') before their text (topl.c:322-323,
    // 339-340); callers repaint those rows wholesale. The tty cursor stays
    // where it was.
    writeToplineText(row, cells) {
        const [cursorCol, cursorRow] = [this.terminal.cursorCol, this.terminal.cursorRow];
        for (const [column, cell] of cells.entries()) {
            if (column >= this.cols)
                break;
            this.setCell(column, row, cell.ch, NO_COLOR, 0, cell.altFont);
        }
        this.setCursor(Math.min(cells.length, this.cols), row);
        this.clearToEol();
        this.setCursor(cursorCol, cursorRow);
    }
    clearRow(row) {
        this.rawRowBytes = [];
        this.rawRowTailOffset = 0;
        this.clearCapturedMapCells(0, row, this.cols);
        this.repaintRow(row);
    }
    repaintRow(row) {
        if (row === 0)
            this.preserveEmptyMessageRow = false;
        this.clearMapFrames(0, row, this.cols);
        this.terminal.clearRow(row);
    }
    scrollUp() {
        this.rawRowBytes = [];
        this.rawRowTailOffset = 0;
        this.terminal.scrollUp();
        this.mapFrameCells.clear();
        const movedCells = [...this.capturedMapCells];
        this.capturedMapCells.clear();
        for (const [index, cell] of movedCells) {
            if (index >= this.cols)
                this.capturedMapCells.set(index - this.cols, cell);
        }
        const movedAltFont = [...this.altFontCells];
        this.altFontCells.clear();
        for (const index of movedAltFont) {
            if (index >= this.cols)
                this.altFontCells.add(index - this.cols);
        }
    }
    moveCursor(x, y) { return this.terminal.moveCursor(x, y); }
    putChar(x, y, ch, attr) {
        this.setCell(x - 1, y - 1, ch, CLR_GRAY, attr);
    }
    getChar(x, y) { return this.terminal.getChar(x, y); }
    putString(str) {
        for (let i = 0; i < str.length; i++)
            this.putCharAtCursor(str.charAt(i));
    }
    putCharAtCursor(ch) {
        if (ch.charCodeAt(0) >= 0x80) {
            this.cursorCol++;
            return;
        }
        this.clearCapturedMapCells(this.cursorCol, this.cursorRow, 1);
        this.clearMapFrames(this.cursorCol, this.cursorRow, 1);
        this.terminal.putCharAtCursor(ch);
    }
    clearToEol() {
        this.clearCapturedMapCells(this.cursorCol, this.cursorRow, this.cols - this.cursorCol);
        this.clearMapFrames(this.cursorCol, this.cursorRow, this.cols - this.cursorCol);
        this.terminal.clearToEol();
    }
    cursSet(visibility) { return this.terminal.cursSet(visibility); }
    flush() { return this.terminal.flush?.(); }
    getPreElement() { return this.terminal.getPreElement(); }
    getCanvas() { return this.terminal.getCanvas?.(); }
    colorToCss(color) { return this.terminal.colorToCss(color); }
    captureForShell() { return this.terminal.captureForShell(); }
    // termcap.c:nomux_raw_putch()/nomux_raw_emit(): tty_raw_print() writes
    // its bytes to the shadow buffer as unsigned characters — one byte per
    // cell, dropping everything at or past column 80 and row 24 with no
    // wrap and no scroll — while the cursor counters keep counting. The
    // recorder decodes each captured row as UTF-8, so a multi-byte
    // sequence written raw occupies one recorded cell and everything
    // after it shifts left; an invalid or split sequence decodes as
    // U+FFFD, exactly as the recorder's TextDecoder does.
    //
    // Raw bytes replace physical cells, including their attributes. The
    // retained tail keeps both its browser glyph and its captured glyph:
    // an IBM wall, for example, has already passed through g_putch().
    // Only the raw prefix needs UTF-8 decoding; retained text and glyphs
    // have already been rendered. A multi-byte prefix consumes its byte
    // count from the tail before the decoded cells are joined to it.
    rawRowBytes = [];
    // Where the tail begins in the grid relative to the raw byte count:
    // decoded length minus byte length of the last materialization (0
    // until one runs), so a multi-byte merge shifts the tail left and a
    // later write consumes from the right place.
    rawRowTailOffset = 0;
    // termcap.c:nomux_enter_raw_mode()/nomux_get_cursor(): raw output runs
    // on its own row/column counters from a cleared shadow buffer, and no
    // code ever leaves raw mode — later tty painting continues through
    // nomux_putch() while the capture keeps reporting the frozen raw
    // counters.
    rawModeActive = false;
    rawCol = 0;
    rawRow = 0;
    writeRawText(text) {
        if (!this.rawModeActive) {
            this.rawModeActive = true;
            this.rawCol = 0;
            this.rawRow = 0;
            this.clearScreen();
        }
        for (const character of text) {
            if (character === '\n') {
                this.rawRowBytes = [];
                this.rawRowTailOffset = 0;
                this.rawCol = 0;
                this.rawRow++;
                continue;
            }
            const code = character.codePointAt(0) ?? 0;
            if (code < 32) {
                // nomux_raw_putch() rejects every character below 32 before
                // its column counter moves: the shadow buffer never sees
                // tty_raw_print()'s tabs or carriage returns, and the bytes
                // after one continue at the current column.
                continue;
            }
            const bytes = code <= 0xFF ? [code]
                : new TextEncoder().encode(character);
            for (const byte of bytes) {
                // The shadow writer drops bytes at or past the last column;
                // its column counter still advances.
                if (this.rawCol < this.cols)
                    this.rawRowBytes.push(byte);
                this.rawCol++;
            }
            this.materializeRawRow();
        }
        this.setCursor(this.rawCol, this.rawRow);
        this.flush();
    }
    // The row's cells as they stand now — one shadow buffer in C: painting
    // between raw writes is part of the row the raw prefix joins. Keep the
    // capture's g_putch() result and every cell property, including styled
    // blanks.
    liveRawRowCells() {
        const captured = this.captureGrid[this.rawRow] ?? [];
        return captured.map((cell, column) => ({
            ...cell,
            ch: this.grid[this.rawRow]?.[column]?.ch ?? cell.ch,
            capturedCh: cell.ch,
            altFont: this.altFontAt(column, this.rawRow),
        }));
    }
    materializeRawRow() {
        if (this.rawRow < 0 || this.rawRow >= this.rows)
            return;
        const decoded = new TextDecoder().decode(Uint8Array.from(this.rawRowBytes));
        const prefix = Array.from(decoded, ch => ({
            ch, capturedCh: ch, color: NO_COLOR, attr: 0, altFont: false,
        }));
        // The tail starts where the last materialization left it, advanced
        // by the bytes written since: painting between raw writes is part
        // of the row (one shadow buffer), and a merge consumes tail cells.
        const tail = this.liveRawRowCells()
            .slice(this.rawRowTailOffset + this.rawRowBytes.length);
        const cells = [...prefix, ...tail];
        // prefix counts code points; decoded.length would count UTF-16
        // units and drop an astral character's second unit from the shift.
        this.rawRowTailOffset = prefix.length - this.rawRowBytes.length;
        this.clearCapturedMapCells(0, this.rawRow, this.cols);
        this.repaintRow(this.rawRow);
        for (const [column, cell] of cells.entries()) {
            if (column >= this.cols)
                break;
            this.setFrameCell(column, this.rawRow, cell.ch, cell.color, cell.attr, cell.altFont);
            if (cell.capturedCh !== cell.ch) {
                this.capturedMapCells.set(this.rawRow * this.cols + column, {
                    ch: cell.capturedCh, color: cell.color, attr: cell.attr,
                });
            }
        }
    }
    // The cursor the recorder reports (nomux_get_cursor()).
    get captureCursorCol() {
        return this.rawModeActive ? this.rawCol : this.terminal.cursorCol;
    }
    get captureCursorRow() {
        return this.rawModeActive ? this.rawRow : this.terminal.cursorRow;
    }
    clearCapturedMapCells(col, row, length) {
        for (let c = Math.max(0, col); c < Math.min(this.cols, col + length); c++) {
            const index = row * this.cols + c;
            this.capturedMapCells.delete(index);
            this.altFontCells.delete(index);
        }
    }
    clearMapFrames(col, row, length) {
        // Frame colors are outside the frozen terminal's cell cache. Erase
        // them even when it skips writing unchanged text, such as help blanks.
        if (this.mapFrameCells.size === 0)
            return;
        for (let c = Math.max(0, col); c < Math.min(this.cols, col + length); c++) {
            const span = this.spans?.[row]?.[c];
            if (span && this.mapFrameCells.delete(span))
                span.style.backgroundColor = '';
        }
    }
    // Input methods — delegate to terminal with NetHack-specific defaults
    pushKey(code) { return this.terminal.pushKey(code); }
    clearInputQueue() { return this.terminal.clearInputQueue(); }
    get isWaitingForInput() { return this.terminal.isWaitingForInput; }
    get inputQueueLength() { return this.terminal.inputQueueLength; }
    get waitEpoch() { return this.terminal.waitEpoch; }
    /**
     * Read a key with NetHack-specific options bundled.
     * Apps set keyMapper and onInterrupt on GameDisplay;
     * these are passed through to terminal.readKey on every call.
     */
    readKey(extraOptions) {
        return this.terminal.readKey({
            keyMapper: this.keyMapper,
            onInterrupt: this.onInterrupt,
            onEmptyQueue: this.onEmptyQueue,
            ...extraOptions,
        });
    }
    /** NetHack key mapper — converts browser keys to game codes. */
    keyMapper = null;
    /** Ctrl-C handler. */
    onInterrupt = null;
    /** Scripted-input hook for reads that find the queue empty. */
    onEmptyQueue = null;
    // --- NetHack-specific methods ---
    moveCursorTo(col, row = 0) {
        this.setCursor(col, row);
    }
}
//# sourceMappingURL=game_display.js.map