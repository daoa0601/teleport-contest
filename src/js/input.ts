// input.js — The single boundary for NetHack key input.
// C refs: win/tty/wintty.c:tty_nhgetch(), win/tty/getline.c.

import { KEY_BINDINGS, NO_COLOR } from './terminal.js';
import { game } from './gstate.js';
import { NATIVE_COMMAND_CONSTANTS, NATIVE_COMMAND_PROFILE, NATIVE_COMMANDS } from './command_data.js';
import { rn1, rn2, rnd } from './rng.js';
import type { TerminalReadKeyOptions } from './terminal.js';
import type { Position } from './map_types.js';
import { isok } from './cmd.js';
import { randomKey, resetFuzzerCommandState } from './cmd.js';

export interface CommandDirection {
    readonly dx: number;
    readonly dy: number;
    readonly dz: number;
}
export interface MapClick extends Position { button: 1 | 2 }
export const MAP_CLICK_KEY = 256;

export interface CharacterInput {
    readonly key: number;
    readonly click: MapClick | null;
}

export type KeyInput = string | number;
export type InputState = 'other' | 'command' | 'direction' | 'position';
export interface KeyReader {
    readKey(options?: TerminalReadKeyOptions): Promise<number>;
}
export interface InputGateOptions {
    beforeRead?: (() => void | Promise<void>) | null;
    display?: KeyReader | null;
}

// Port only: normalize a character string or code to its key code.
function keyCode(key: KeyInput): number {
    if (typeof key === 'number') return key;
    if (typeof key === 'string' && key.length > 0) return key.charCodeAt(0);
    throw new TypeError('InputGate accepts character strings or key codes');
}

export class InputGate {
    beforeRead: (() => void | Promise<void>) | null;
    display: KeyReader | null;
    private readonly queue: (number | MapClick)[];

    private pendingRead: ((input: number | MapClick) => void) | null;
    private mapClick: MapClick | null = null;
    private blockedWaiters: (() => void)[];

    constructor({ beforeRead = null, display = null }: InputGateOptions = {}) {
        this.beforeRead = beforeRead;
        this.display = display;
        this.queue = [];
        this.pendingRead = null;
        this.blockedWaiters = [];
    }

    feed(keys: KeyInput | readonly KeyInput[]): void {
        const values = typeof keys === 'string' ? [...keys]
            : typeof keys === 'number' ? [keys] : keys;
        for (const key of values) this.feedOne(keyCode(key));
    }

    feedOne(code: number): void {
        // The pinned Unix tty retains ICRNL for external keyboard input.
        // Generated fuzzer bytes bypass this source conversion.
        if (code === 13) code = 10;
        this.feedInput(code);
    }

    feedMapClick(x: number, y: number, button: 1 | 2): void {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !isok(x, y) || button !== 1 && button !== 2)
            throw new RangeError('A map click must be within the dungeon map');
        this.feedInput({ x, y, button });
    }

    takeMapClick(): MapClick | null {
        const click = this.mapClick;
        this.mapClick = null;
        return click;
    }

    private feedInput(input: number | MapClick): void {
        if (!this.pendingRead) {
            this.queue.push(input);
            return;
        }
        const resolve = this.pendingRead;
        this.pendingRead = null;
        resolve(input);
    }

    async readKey(inputState: InputState = 'other'): Promise<number> {
        // tty input belongs to the player. Command owners consume canned
        // choices explicitly so message pagers cannot steal item letters.
        await this.beforeRead?.();
        this.mapClick = null;
        if (game.iflags.debug_fuzzer) return randomKey(inputState);
        const queued = this.queue.shift();
        if (queued !== undefined) return this.inputKey(queued);
        if (this.display) {
            const code = await this.display.readKey({ bindings: KEY_BINDINGS.VI_KEYS });
            return code === 13 ? 10 : code;
        }

        const key = new Promise<number | MapClick>(resolve => {
            this.pendingRead = resolve;
        });
        this.notifyBlocked();
        return this.inputKey(await key);
    }

    private inputKey(input: number | MapClick): number {
        if (typeof input === 'number') return input;
        this.mapClick = input;
        return MAP_CLICK_KEY;
    }


    waitUntilBlocked(): Promise<void> {
        if (this.isBlocked) return Promise.resolve();
        return new Promise<void>(resolve => this.blockedWaiters.push(resolve));
    }

    notifyBlocked() {
        const waiters = this.blockedWaiters;
        this.blockedWaiters = [];
        for (const resolve of waiters) resolve();
    }

    clear() {
        this.queue.length = 0;
        this.mapClick = null;
    }

    get isBlocked() {
        return this.pendingRead !== null;
    }
}

let activeInputGate = new InputGate();

// Port only: the gate accessor. The gate itself stays private; the folded cmd.c readchar()/pgetchar()
// ports read through this accessor, exactly like their C bodies call
// the windowport's key entry points.
export function inputGate(): InputGate {
    return activeInputGate;
}

// Port only: bind the process-wide input gate for a new game.
export function bindInputGate(inputGate: InputGate): void {
    if (!(inputGate instanceof InputGate))
        throw new TypeError('bindInputGate requires an InputGate');
    activeInputGate = inputGate;
    // C randomkey()'s statics are process-wide; the port scopes them to one
    // game, and every game binds a freshly built gate (jsmain start()), so
    // the table index and repeat key start from their head again here.
    resetFuzzerCommandState();
}

// Port only: queue one key into the active gate.
export function pushKey(key: KeyInput): void {
    activeInputGate.feed(key);
}

// Port only: queue one or many keys into the active gate.
export function pushKeys(keys: KeyInput | readonly KeyInput[]): void {
    activeInputGate.feed(keys);
}


// C wintty.c:tty_raw_print()
// C win/tty/wintty.c:tty_raw_print().
export function rawPrint(message: string) {
    writeRawText(`${message}\n`);
}

// Part of C wintty.c:tty_raw_print(): the character-level terminal writer
// (cursor, scroll, tab stops).
export function writeRawText(text: string) {
    const display = game.nhDisplay;
    if (!display) return;
    for (const ch of text) {
        if (ch === '\r') {
            display.setCursor(0, display.cursorRow);
        } else if (ch === '\n') {
            const row = display.cursorRow + 1;
            if (row >= display.rows) display.scrollUp();
            display.setCursor(0, Math.min(row, display.rows - 1));
        } else if (ch === '\t') {
            // tty_raw_print() leaves tabs for the terminal's eight-column stops.
            const nextTab = display.cursorCol + 8 - display.cursorCol % 8;
            display.setCursor(Math.min(nextTab, display.cols - 1), display.cursorRow);
        } else {
            if (display.cursorCol >= display.cols) writeRawText('\n');
            display.setCell(display.cursorCol, display.cursorRow, ch, NO_COLOR, 0);
            display.setCursor(display.cursorCol + 1, display.cursorRow);
        }
    }
    display.flush();
}

// C wintty.c:tty_nhgetch()
export async function nhgetch(inputState: InputState = 'other') {
    // tty_nhgetch() clears WIN_STOP before reading any key, including a
    // target selection made by an action resumed from the command queue.
    game._suppressMessagesUntilInput = false;
    if (game.nhDisplay) game.nhDisplay.stoppedTopline = null;
    const key = await activeInputGate.readKey(inputState);
    // tty_nhgetch() marks the displayed topline as seen after any key.
    // Keep its text visible, but a later screen reset must not page it again.
    if (game._pending_message) {
        game._retained_message = game._pending_message;
        game._pending_message = '';
    }
    // tty_nhgetch() treats NUL as Escape, including a typed Ctrl-@.
    return key === 0 ? 27 : key;
}

// C wintty.c:tty_nh_poskey()
// The Unix tty path just reads a key through tty_nhgetch(); the browser
// gate delivers map clicks through the same entry, and callers that need
// the click coordinates take them from the gate.
export async function nh_poskey(inputState: InputState = 'other') {
    return await nhgetch(inputState);
}


// Port only: fresh input gate and command-queue state for a new game.
export function resetInputState() {
    activeInputGate = new InputGate();
    resetFuzzerCommandState();
    return activeInputGate;
}
