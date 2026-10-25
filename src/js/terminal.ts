// Typed counterpart of the contest terminal adapter.
// The judge overwrites the emitted js/terminal.js from frozen/ when scoring.
// terminal.js -- Shared Terminal base class for all apps (NetHack, Hack, Rogue, Logo, BASIC).
// Provides a character-cell grid with optional DOM rendering.

export type TerminalColor = number | string;

import { ATR_BLINK } from './terminal_attributes.js';

export interface TerminalCell {
    ch: string;
    color: TerminalColor;
    attr: number;
}

export type TerminalCursor = [col: number, row: number, visible: number];
export type KeyBindings = Readonly<Partial<Record<string, string | number>>>;
export type KeyMapper = (event: KeyboardEvent) => number | null | undefined;
export type InterruptHandler = () => void;

export interface TerminalReadKeyOptions {
    bindings?: KeyBindings;
    keyMapper?: KeyMapper | null;
    onInterrupt?: InterruptHandler | null;
}

export interface TerminalOptions {
    rows?: number;
    cols?: number;
    graphicsCanvas?: HTMLCanvasElement;
}

export interface TerminalFlags {
    color?: boolean;
    use_darkgray?: boolean;
}

// --- Color constants ---
export const CLR_BLACK = 0;
export const CLR_RED = 1;
export const CLR_GREEN = 2;
export const CLR_BROWN = 3;
export const CLR_BLUE = 4;
export const CLR_MAGENTA = 5;
export const CLR_CYAN = 6;
export const CLR_GRAY = 7;
export const NO_COLOR = 8;
export const CLR_ORANGE = 9;
export const CLR_BRIGHT_GREEN = 10;
export const CLR_YELLOW = 11;
export const CLR_BRIGHT_BLUE = 12;
export const CLR_BRIGHT_MAGENTA = 13;
export const CLR_BRIGHT_CYAN = 14;
export const CLR_WHITE = 15;

// --- Attribute constants ---
export const ATR_NONE = 0;
export const ATR_INVERSE = 1;
export const ATR_BOLD = 2;
export const ATR_UNDERLINE = 4;

// --- Highlight aliases ---
// HI_METAL, HI_WOOD, HI_GOLD, HI_ZAP moved to const.js (game-specific)

// --- DEC Special Graphics → Unicode ---
// VT100 alternate charset codes mapped to Unicode box-drawing / symbols.
// Used by display code to convert raw DEC chars to browser-renderable glyphs.
export const DEC_TO_UNICODE: Readonly<Partial<Record<string, string>>> = {
    '`': '\u25c6', a: '\u2592', f: '\u00b0', g: '\u00b1',
    j: '\u2518', k: '\u2510', l: '\u250c', m: '\u2514', n: '\u253c',
    q: '\u2500', t: '\u251c', u: '\u2524', v: '\u2534', w: '\u252c',
    x: '\u2502', y: '\u2264', z: '\u2265', '|': '\u2260',
    o: '\u23ba', s: '\u23bd', '{': '\u03c0', '~': '\u00b7',
};

// CSS color strings for each color constant.
// See display.js DECISIONS.md #2 for color choices.
const COLOR_CSS = [
    '#555',    // 0  - CLR_BLACK (dark gray for visibility on black bg)
    '#a00',    // 1  - CLR_RED
    '#0a0',    // 2  - CLR_GREEN
    '#a50',    // 3  - CLR_BROWN
    '#00d',    // 4  - CLR_BLUE
    '#a0a',    // 5  - CLR_MAGENTA
    '#0aa',    // 6  - CLR_CYAN
    '#ccc',    // 7  - CLR_GRAY
    '#ccc',    // 8  - NO_COLOR (unused, defaults to gray)
    '#f80',    // 9  - CLR_ORANGE
    '#0f0',    // 10 - CLR_BRIGHT_GREEN
    '#ff0',    // 11 - CLR_YELLOW
    '#55f',    // 12 - CLR_BRIGHT_BLUE
    '#f5f',    // 13 - CLR_BRIGHT_MAGENTA
    '#0ff',    // 14 - CLR_BRIGHT_CYAN
    '#fff',    // 15 - CLR_WHITE
] as const;

/**
 * Compute the optimal line-height for seamless box-drawing characters.
 *
 * Terminal box-drawing glyphs extend to the font's full cell height (usWinAscent +
 * usWinDescent), not the smaller typographic metrics. This function measures the
 * actual loaded font via the Canvas API and rounds down to a whole-pixel value.
 *
 * @param {number} fontSize - The font size in pixels (e.g. 16)
 * @param {string} fontFamily - The CSS font-family string
 * @returns {number} line-height as a unitless ratio (e.g. 1.125)
 */
function computeTerminalLineHeight(fontSize: number, fontFamily: string): number {
    const DEFAULT_LINE_HEIGHT = 1.1875;
    if (typeof document === 'undefined') return DEFAULT_LINE_HEIGHT;
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return DEFAULT_LINE_HEIGHT;
        ctx.font = `${fontSize}px ${fontFamily}`;
        const metrics = ctx.measureText('|');
        if (metrics.fontBoundingBoxAscent != null &&
            metrics.fontBoundingBoxDescent != null) {
            const naturalHeight = metrics.fontBoundingBoxAscent
                                + metrics.fontBoundingBoxDescent;
            const naturalRatio = naturalHeight / fontSize;
            const wholePixelHeight = Math.floor(naturalRatio * fontSize);
            return Math.max(wholePixelHeight / fontSize, 1.0);
        }
    } catch (e) {
        // Canvas not available (e.g. Node.js tests)
    }
    return DEFAULT_LINE_HEIGHT;
}

/** Standard key binding presets for readKey(). */
export const KEY_BINDINGS = {
    /** NetHack/Hack/Rogue: arrows → vi keys (hjkl), shift+arrows → run (HJKL) */
    VI_KEYS: {
        ArrowUp: 'k', ArrowDown: 'j', ArrowLeft: 'h', ArrowRight: 'l',
        'Shift+ArrowUp': 'K', 'Shift+ArrowDown': 'J',
        'Shift+ArrowLeft': 'H', 'Shift+ArrowRight': 'L',
    },
    /** Line-editing: arrows → Ctrl codes for history and cursor movement */
    LINE_EDIT: {
        ArrowUp: 16,    // Ctrl-P (history prev)
        ArrowDown: 14,  // Ctrl-N (history next)
        ArrowLeft: 2,   // Ctrl-B (cursor left)
        ArrowRight: 6,  // Ctrl-F (cursor right)
    },
};

export class Terminal {
    rows: number;
    cols: number;
    grid: TerminalCell[][];
    cursorCol = 0;
    cursorRow = 0;
    cursorVisible = 1;
    _focusCol = 0;
    _focusRow = 0;
    spans: HTMLSpanElement[][] | null = null;
    _pre: HTMLPreElement | null = null;
    _canvas: HTMLCanvasElement | null;
    _cursorSpan: HTMLSpanElement | null = null;
    container: HTMLElement | null = null;
    flags: TerminalFlags | undefined;
    _keyboardInstalled = false;
    _keyTarget: EventTarget | null = null;
    _keyHandler: EventListener | null = null;
    _activeOptions: TerminalReadKeyOptions | null = null;
    _waitEpoch = 0;
    _inputQueue: number[] = [];
    _inputResolver: ((code: number) => void) | null = null;

    /**
     * @param {string|null} containerId - DOM container id, or null/undefined for headless
     * @param {object} opts
     * @param {number} opts.rows - number of rows (default 24)
     * @param {number} opts.cols - number of columns (default 80)
     * @param {HTMLCanvasElement} opts.graphicsCanvas - optional canvas overlay
     */
    constructor(
        containerId: string | HTMLElement | null = null,
        { rows = 24, cols = 80, graphicsCanvas }: TerminalOptions = {},
    ) {
        this.rows = rows;
        this.cols = cols;

        // The character grid: [row][col] = {ch, color, attr}
        // attr: 0=normal, 1=inverse, 2=bold, 4=underline, 8=blink (can be OR'd)
        this.grid = Array.from({ length: this.rows }, () =>
            Array.from({ length: this.cols }, () => ({ ch: ' ', color: CLR_GRAY, attr: 0 })),
        );

        this._canvas = graphicsCanvas || null;

        if (containerId != null) {
            this._createDOM(containerId);
            this.installKeyboard(); // auto-install keyboard when DOM is present
        }
    }

    _createDOM(containerId: string | HTMLElement): void {
        this.container = typeof containerId === 'string'
            ? document.getElementById(containerId)
            : containerId;  // accept DOM element directly
        if (!this.container) throw new Error(`Terminal container not found: ${containerId}`);
        const pre = document.createElement('pre');
        pre.id = 'terminal';
        const fontFamily = '"DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", monospace';
        const fontSize = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--game-font-size')) || 16;
        const lineHeight = computeTerminalLineHeight(fontSize, fontFamily);
        pre.style.cssText = `
            font-family: ${fontFamily};
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            background: #000;
            color: #ccc;
            padding: 8px;
            margin: 0;
            display: inline-block;
            white-space: pre;
            cursor: default;
            user-select: none;
        `;

        // Create spans for each cell
        this.spans = [];
        for (let r = 0; r < this.rows; r++) {
            const row: HTMLSpanElement[] = [];
            this.spans.push(row);
            for (let c = 0; c < this.cols; c++) {
                const span = document.createElement('span');
                span.textContent = ' ';
                span.style.color = COLOR_CSS[CLR_GRAY];
                span.dataset.row = String(r);
                span.dataset.col = String(c);
                row.push(span);
                pre.appendChild(span);
            }
            if (r < this.rows - 1) {
                pre.appendChild(document.createTextNode('\n'));
            }
        }

        // CSS animations for blinking text and cursor
        const style = document.createElement('style');
        style.textContent = `
@keyframes terminal-text-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
span.terminal-blink {
  animation: terminal-text-blink 1s step-end infinite;
}
@keyframes terminal-cursor-blink {
  0%, 49% { box-shadow: inset 0 -3px 0 0 rgba(255,255,255,0.85); }
  50%, 100% { box-shadow: none; }
}
span.terminal-cursor {
  animation: terminal-cursor-blink 0.8s step-end infinite;
}
`;
        this.container.innerHTML = '';
        this.container.appendChild(style);
        this.container.appendChild(pre);
        this._pre = pre;
    }

    // --- Shell transition ---

    /** Capture the terminal <pre> HTML to localStorage for flash-free ^C transition.
     *  The shell's inline script reads this and renders it immediately before modules load. */
    captureForShell() {
        try {
            if (this._pre) {
                localStorage.setItem('shell_preload_html', this._pre.outerHTML);
            }
        } catch (e) { /* non-fatal */ }
    }

    // --- Keyboard Input ---
    // Unified async key input used by all apps (NetHack, Hack, Rogue, BASIC, Logo, Shell).
    // Keys are delivered as numeric char codes (Enter=13, Backspace=8, Ctrl-A=1, etc.)
    // The keyboard listener is optional — apps can also feed keys via pushKey().

    /**
     * Install the keyboard listener on the document (or a specific element).
     * Safe to call multiple times — only installs once.
     * @param {EventTarget} [target=document] - element to listen on
     */
    installKeyboard(target?: EventTarget): void {
        if (this._keyboardInstalled) return;
        this._keyTarget = target || (typeof document !== 'undefined' ? document : null);
        if (!this._keyTarget) return;
        this._keyHandler = (event) => {
            if (event instanceof KeyboardEvent) this._onKeyDown(event);
        };
        this._keyTarget.addEventListener('keydown', this._keyHandler);
        this._keyboardInstalled = true;
    }

    /** Remove the keyboard listener. */
    uninstallKeyboard() {
        if (!this._keyboardInstalled) return;
        if (this._keyTarget && this._keyHandler) {
            this._keyTarget.removeEventListener('keydown', this._keyHandler);
        }
        this._keyboardInstalled = false;
    }

    /**
     * Read one key asynchronously. Returns a numeric char code.
     * If the queue has keys, returns immediately. Otherwise waits.
     *
     * All options are per-call (no stateful properties to manage):
     *
     * @param {Object} [options] - options for this read
     * @param {Object} [options.bindings] - key bindings overriding default
     *   ANSI sequences. Keys are event.key names, values are char codes or
     *   single-char strings. Use KEY_BINDINGS.VI_KEYS or KEY_BINDINGS.LINE_EDIT.
     * @param {Function} [options.keyMapper] - if set, receives the raw
     *   KeyboardEvent and returns a char code (or null). Bypasses bindings
     *   and default translation entirely.
     * @param {Function} [options.onInterrupt] - Ctrl-C handler for this read.
     * @returns {Promise<number>}
     */
    readKey(options?: TerminalReadKeyOptions): Promise<number> {
        this._activeOptions = options || null;
        // Record every read, including reads satisfied by an already queued
        // key, so callers can tell when the game accepted their input.
        this._waitEpoch++;
        const queuedCode = this._inputQueue.shift();
        if (queuedCode !== undefined) return Promise.resolve(queuedCode);
        return new Promise<number>((resolve) => {
            this._inputResolver = resolve;
        });
    }

    /**
     * Push a key into the input queue (for programmatic/test input).
     * If readKey() is waiting, resolves it immediately.
     * @param {number} code - char code
     */
    pushKey(code: number): void {
        if (this._inputResolver) {
            const resolve = this._inputResolver;
            this._inputResolver = null;
            resolve(code);
        } else {
            this._inputQueue.push(code);
        }
    }

    /** Clear the input queue. */
    clearInputQueue() {
        this._inputQueue = [];
    }

    /** True when readKey() is blocked waiting for input. */
    get isWaitingForInput() {
        return !!this._inputResolver;
    }

    /** Number of calls to readKey(). */
    get waitEpoch() {
        return this._waitEpoch;
    }

    /** Number of keys queued but not yet consumed. */
    get inputQueueLength() {
        return this._inputQueue.length;
    }


    /** @private Handle a keydown event — translate to char code and deliver. */
    _onKeyDown(e: KeyboardEvent): void {
        let code: number | null = null;
        const opts = this._activeOptions;

        // Ctrl-C: fire interrupt handler from active readKey options
        if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            if (opts?.onInterrupt) opts.onInterrupt();
            return;
        }

        // Check keyMapper from active readKey options
        if (opts?.keyMapper) {
            const mapped = opts.keyMapper(e);
            if (mapped !== null && mapped !== undefined) {
                e.preventDefault();
                this.pushKey(mapped);
            }
            return;
        }

        // Check bindings from active readKey options
        const bindings = opts?.bindings;
        if (bindings) {
            // Build lookup key: "Shift+ArrowUp", "Ctrl+a", or just "ArrowUp"
            let bindKey = e.key;
            if (e.shiftKey && e.key.startsWith('Arrow')) bindKey = 'Shift+' + e.key;

            const bound = bindings[bindKey];
            if (bound !== undefined) {
                code = typeof bound === 'string' ? bound.charCodeAt(0) : bound;
                e.preventDefault();
                this.pushKey(code);
                return;
            }
        }

        // Ctrl+letter → control codes (Ctrl-A=1 ... Ctrl-Z=26)
        if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
            const c = e.key.toLowerCase().charCodeAt(0);
            if (c >= 97 && c <= 122) {
                code = c - 96;
                e.preventDefault();
            }
        } else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            switch (e.key) {
            case 'Enter':     code = 13; break;
            case 'Backspace': code = 8; e.preventDefault(); break;
            case 'Delete':    code = 127; break;
            case 'Escape':    code = 27; e.preventDefault(); break;
            case 'Tab':       code = 9; e.preventDefault(); break;
            // Arrow keys: default ANSI escape sequences (ESC [ A/B/C/D)
            case 'ArrowUp':    this.pushKey(27); this.pushKey(91); code = 65; e.preventDefault(); break;
            case 'ArrowDown':  this.pushKey(27); this.pushKey(91); code = 66; e.preventDefault(); break;
            case 'ArrowRight': this.pushKey(27); this.pushKey(91); code = 67; e.preventDefault(); break;
            case 'ArrowLeft':  this.pushKey(27); this.pushKey(91); code = 68; e.preventDefault(); break;
            default:
                if (e.key.length === 1) code = e.key.charCodeAt(0);
                break;
            }
        }

        if (code !== null) this.pushKey(code);
    }

    // --- Color utilities ---

    /** Convert a color value (integer CLR_* constant or CSS string) to a CSS color. */
    colorToCss(color: TerminalColor): string {
        if (typeof color === 'string') return color;
        return COLOR_CSS[color] || COLOR_CSS[CLR_GRAY];
    }

    // --- Cell operations ---

    /**
     * Set a character at terminal position (col, row) with color and attributes.
     * color: integer CLR_* constant (0-15) or CSS color string.
     * attr: 0=normal, 1=inverse, 2=bold, 4=underline, 8=blink (can be OR'd).
     */
    setCell(col: number, row: number, ch: string, color: TerminalColor, attr = 0): void {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

        // Store raw color in grid — no normalization here.
        // Color mapping (CLR_BLACK → dark gray, color off → gray) happens
        // only at DOM rendering time (colorToCss), not in the grid data.
        const cell = this.cellAt(col, row);
        if (cell.ch === ch && cell.color === color && cell.attr === attr) return;
        cell.ch = ch;
        cell.color = color;
        cell.attr = attr;

        if (!this.spans) return;

        const span = this.spanAt(col, row);
        span.textContent = ch;
        const css = this.colorToCss(color);

        const isInverse = (attr & ATR_INVERSE) !== 0;
        const isBold = (attr & ATR_BOLD) !== 0;
        const isUnderline = (attr & ATR_UNDERLINE) !== 0;

        if (isInverse) {
            span.style.color = '#000';
            span.style.backgroundColor = css;
        } else {
            span.style.color = css;
            span.style.backgroundColor = '';
        }

        span.style.fontWeight = isBold ? 'bold' : '';
        span.style.textDecoration = isUnderline ? 'underline' : '';
        span.classList.toggle('terminal-blink', (attr & ATR_BLINK) !== 0);
    }

    /** Clear a row to spaces with CLR_GRAY. */
    clearRow(row: number): void {
        for (let c = 0; c < this.cols; c++) {
            this.setCell(c, row, ' ', CLR_GRAY);
        }
    }

    /** Write a string at position (col, row) with optional color and attributes. */
    putstr(col: number, row: number, str: string, color: TerminalColor = CLR_GRAY, attr = 0): void {
        for (let i = 0; i < str.length && col + i < this.cols; i++) {
            this.setCell(col + i, row, str.charAt(i), color, attr);
        }
    }

    /** Clear the entire screen. */
    clearScreen() {
        for (let r = 0; r < this.rows; r++) {
            this.clearRow(r);
        }
        this.setCursor(0, 0);
    }

    // --- Cursor ---

    /** Move the visible cursor to (col, row). 0-based. */
    setCursor(col: number, row: number): void {
        if (this._cursorSpan) {
            this._cursorSpan.classList.remove('terminal-cursor');
            this._cursorSpan = null;
        }
        this.cursorCol = col;
        this.cursorRow = row;
        const cursorSpan = this.spans?.[row]?.[col];
        if (this.cursorVisible && cursorSpan) {
            this._cursorSpan = cursorSpan;
            cursorSpan.classList.add('terminal-cursor');
        }
    }

    /** Return [col, row, visible]. */
    getCursor(): TerminalCursor {
        return [this.cursorCol, this.cursorRow, this.cursorVisible];
    }

    /** Set cursor visibility (truthy = visible). */
    cursSet(visibility: number | boolean): void {
        this.cursorVisible = visibility ? 1 : 0;
        if (this._cursorSpan) {
            if (!this.cursorVisible) {
                this._cursorSpan.classList.remove('terminal-cursor');
            } else {
                this._cursorSpan.classList.add('terminal-cursor');
            }
        }
    }

    /** Flush pending output. (DOM writes are immediate, so this is a no-op.) */
    flush() {
        // Browser display is immediate through setCell/DOM writes.
    }

    // --- 1-based legacy wrappers (for curses-style apps) ---

    /** Move cursor to 1-based (x, y). */
    moveCursor(x: number, y: number): void {
        this.setCursor(x - 1, y - 1);
    }

    /** Write character at 1-based (x, y) with attribute. */
    putChar(x: number, y: number, ch: string, attr = 0): void {
        this.setCell(x - 1, y - 1, ch, CLR_GRAY, attr);
    }

    /** Read character at 1-based (x, y). Returns the ch string. */
    getChar(x: number, y: number): string {
        const col = x - 1;
        const row = y - 1;
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return ' ';
        return this.cellAt(col, row).ch;
    }

    // --- Cursor-relative writing ---

    /** Write a string at the current cursor position, advancing the cursor. */
    putString(str: string): void {
        for (let i = 0; i < str.length; i++) {
            this.putCharAtCursor(str.charAt(i));
        }
    }

    /** Write a single character at the cursor and advance it one column. */
    putCharAtCursor(ch: string): void {
        if (this.cursorRow >= 0 && this.cursorRow < this.rows
            && this.cursorCol >= 0 && this.cursorCol < this.cols) {
            this.setCell(this.cursorCol, this.cursorRow, ch, CLR_GRAY);
        }
        this.cursorCol++;
    }

    /** Clear from cursor to end of line. */
    clearToEol() {
        const row = this.cursorRow;
        if (row < 0 || row >= this.rows) return;
        for (let c = this.cursorCol; c < this.cols; c++) {
            this.setCell(c, row, ' ', CLR_GRAY);
        }
    }

    /** Scroll all rows up by one; clear the bottom row. */
    scrollUp() {
        // Shift grid data up
        for (let r = 0; r < this.rows - 1; r++) {
            for (let c = 0; c < this.cols; c++) {
                const src = this.cellAt(c, r + 1);
                const dest = this.cellAt(c, r);
                dest.ch = src.ch;
                dest.color = src.color;
                dest.attr = src.attr;
            }
        }
        // Clear bottom row
        for (let c = 0; c < this.cols; c++) {
            const cell = this.cellAt(c, this.rows - 1);
            cell.ch = ' ';
            cell.color = CLR_GRAY;
            cell.attr = 0;
        }
        // Repaint spans if present
        if (this.spans) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.cellAt(c, r);
                    const span = this.spanAt(c, r);
                    span.textContent = cell.ch;
                    const css = this.colorToCss(cell.color);
                    const isInverse = (cell.attr & ATR_INVERSE) !== 0;
                    if (isInverse) {
                        span.style.color = '#000';
                        span.style.backgroundColor = css;
                    } else {
                        span.style.color = css;
                        span.style.backgroundColor = '';
                    }
                    span.style.fontWeight = (cell.attr & ATR_BOLD) ? 'bold' : '';
                    span.style.textDecoration = (cell.attr & ATR_UNDERLINE) ? 'underline' : '';
                    span.classList.toggle('terminal-blink', (cell.attr & ATR_BLINK) !== 0);
                }
            }
        }
    }

    private cellAt(col: number, row: number): TerminalCell {
        const cell = this.grid[row]?.[col];
        if (!cell) throw new RangeError(`Terminal cell is missing at (${col}, ${row})`);
        return cell;
    }

    private spanAt(col: number, row: number): HTMLSpanElement {
        const span = this.spans?.[row]?.[col];
        if (!span) throw new RangeError(`Terminal span is missing at (${col}, ${row})`);
        return span;
    }

    // --- Accessors ---

    /** Return the <pre> DOM element (or null if headless). */
    getPreElement() {
        return this._pre;
    }

    /** Return the graphics canvas (or null). */
    getCanvas() {
        return this._canvas;
    }

    /** Store a focus point for external scroll-into-view logic. */
    setFocusPoint(col: number, row: number): void {
        this._focusCol = col;
        this._focusRow = row;
    }
}

/** Terminal with no DOM. */
export class HeadlessTerminal extends Terminal {
    constructor(opts?: TerminalOptions) {
        super(null, opts);
    }
}
