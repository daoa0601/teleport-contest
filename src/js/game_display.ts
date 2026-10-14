// game_display.js — NetHack-specific display wrapper around Terminal.
// Edit freely; the contest only freezes isaac64.js and terminal.js.
//
// Adds game state properties (topMessage, toplines, toplin) and
// message window handling. Delegates all terminal operations to
// the wrapped Terminal instance.
//
// Usage:
//   const terminal = new Terminal('game-container');
//   const display = new GameDisplay(terminal);
//   // display.setCell, display.readKey etc. all delegate to terminal
//   // display.topMessage, display.putstr_message are NetHack-specific

import { Terminal, CLR_GRAY } from './terminal.js';
import type { StatusLine2Fields } from './status_layout.js';
import type { KeyMapper, InterruptHandler, TerminalReadKeyOptions, TerminalColor, TerminalFlags } from './terminal.js';

const TOPLINE_EMPTY = 0;
const TOPLINE_NEED_MORE = 1;

export class GameDisplay {
    readonly terminal: Terminal;
    topMessage: string | null;
    toplines: string;
    readonly messages: string[];
    toplin: number;
    messageWinFlags: number;
    // WIN_STATUS retains its fields independently of map and message redraws.
    statusLines: readonly [string, string] | null = null;
    statusLine2Fields: StatusLine2Fields | null = null;
    statusCapacityBlank = false;
    // Tty keeps the replacement prefix until BL_LEVELDESC changes.
    statusLevelPrefixChanged = false;
    statusVisible = true;

    constructor(terminalOrContainerId: Terminal | string | HTMLElement | null = null) {
        // A supplied terminal permits headless use; a container ID creates the browser surface.
        if (terminalOrContainerId instanceof Terminal) {
            this.terminal = terminalOrContainerId;
        } else {
            this.terminal = new Terminal(
                terminalOrContainerId != null ? terminalOrContainerId : null,
                { rows: 24, cols: 80 }
            );
        }

        // NetHack-specific message state
        this.topMessage = null;
        this.toplines = '';
        this.messages = [];
        this.toplin = TOPLINE_EMPTY;
        this.messageWinFlags = 0;
    }

    // --- Delegate all Terminal properties and methods ---

    get rows() { return this.terminal.rows; }
    get cols() { return this.terminal.cols; }
    get grid() { return this.terminal.grid; }
    get cursorCol() { return this.terminal.cursorCol; }
    set cursorCol(v: number) { this.terminal.cursorCol = v; }
    get cursorRow() { return this.terminal.cursorRow; }
    set cursorRow(v: number) { this.terminal.cursorRow = v; }
    get cursorVisible() { return this.terminal.cursorVisible; }
    set cursorVisible(v: number) { this.terminal.cursorVisible = v; }
    get spans() { return this.terminal.spans; }
    get container() { return this.terminal.container; }
    get flags() { return this.terminal.flags; }
    set flags(v: TerminalFlags | undefined) { this.terminal.flags = v; }

    // Display methods
    setCell(col: number, row: number, ch: string, color: TerminalColor, attr?: number) { return this.terminal.setCell(col, row, ch, color, attr); }
    putstr(col: number, row: number, str: string, color?: TerminalColor, attr?: number) { return this.terminal.putstr(col, row, str, color, attr); }
    setCursor(col: number, row: number) { return this.terminal.setCursor(col, row); }
    clearScreen() { return this.terminal.clearScreen(); }
    clearRow(row: number) { return this.terminal.clearRow(row); }
    scrollUp() { return this.terminal.scrollUp(); }
    moveCursor(x: number, y: number) { return this.terminal.moveCursor(x, y); }
    putChar(x: number, y: number, ch: string, attr?: number) { return this.terminal.putChar(x, y, ch, attr); }
    getChar(x: number, y: number) { return this.terminal.getChar(x, y); }
    putString(str: string) { return this.terminal.putString(str); }
    putCharAtCursor(ch: string) { return this.terminal.putCharAtCursor(ch); }
    clearToEol() { return this.terminal.clearToEol(); }
    cursSet(visibility: boolean | number) { return this.terminal.cursSet(visibility); }
    flush() { return this.terminal.flush?.(); }
    getPreElement() { return this.terminal.getPreElement(); }
    getCanvas() { return this.terminal.getCanvas?.(); }
    colorToCss(color: TerminalColor) { return this.terminal.colorToCss(color); }
    captureForShell() { return this.terminal.captureForShell(); }

    // Input methods — delegate to terminal with NetHack-specific defaults
    pushKey(code: number) { return this.terminal.pushKey(code); }
    clearInputQueue() { return this.terminal.clearInputQueue(); }
    get isWaitingForInput() { return this.terminal.isWaitingForInput; }
    get inputQueueLength() { return this.terminal.inputQueueLength; }
    get waitEpoch() { return this.terminal.waitEpoch; }

    /**
     * Read a key with NetHack-specific options bundled.
     * Apps set keyMapper and onInterrupt on GameDisplay;
     * these are passed through to terminal.readKey on every call.
     */
    readKey(extraOptions?: TerminalReadKeyOptions) {
        return this.terminal.readKey({
            keyMapper: this.keyMapper,
            onInterrupt: this.onInterrupt,
            ...extraOptions,
        });
    }

    /** NetHack key mapper — converts browser keys to game codes. */
    keyMapper: KeyMapper | null = null;
    /** Ctrl-C handler. */
    onInterrupt: InterruptHandler | null = null;
    // --- NetHack-specific methods ---

    putstr_message(msg: string) {
        this.clearRow(0);
        this.putstr(0, 0, msg, CLR_GRAY);
        this.topMessage = msg.trimEnd();
        this.toplines = this.topMessage;
        this.toplin = this.topMessage ? TOPLINE_NEED_MORE : TOPLINE_EMPTY;
        this.messages.push(this.topMessage);
        if (this.messages.length > 20) this.messages.shift();
    }

    moveCursorTo(col: number, row = 0) {
        this.setCursor(col, row);
    }
}
