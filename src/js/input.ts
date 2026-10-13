// input.js — The single boundary for NetHack key input.
// C refs: win/tty/wintty.c:tty_nhgetch(), win/tty/getline.c.

import { KEY_BINDINGS } from './terminal.js';
import { game } from './gstate.js';
import { NATIVE_COMMAND_PROFILE } from './command_data.js';
import type { TerminalReadKeyOptions } from './terminal.js';

export type KeyInput = string | number;
export interface KeyReader {
    readKey(options?: TerminalReadKeyOptions): Promise<number>;
}
export interface InputGateOptions {
    beforeRead?: (() => void | Promise<void>) | null;
    display?: KeyReader | null;
}

function keyCode(key: KeyInput): number {
    if (typeof key === 'number') return key;
    if (typeof key === 'string' && key.length > 0) return key.charCodeAt(0);
    throw new TypeError('InputGate accepts character strings or key codes');
}

export class InputGate {
    beforeRead: (() => void | Promise<void>) | null;
    display: KeyReader | null;
    private readonly queue: number[];
    private readonly commandKeys: number[];
    private pendingRead: ((code: number) => void) | null;
    private blockedWaiters: (() => void)[];

    constructor({ beforeRead = null, display = null }: InputGateOptions = {}) {
        this.beforeRead = beforeRead;
        this.display = display;
        this.queue = [];
        this.commandKeys = [];
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
        if (!this.pendingRead) {
            this.queue.push(code);
            return;
        }
        const resolve = this.pendingRead;
        this.pendingRead = null;
        resolve(code);
    }

    queueCommandKeys(keys: string): void {
        this.commandKeys.push(...[...keys].map(keyCode));
    }

    async readKey(): Promise<number> {
        // C cmdq keys answer a command's prompts without asking tty or
        // consuming input the player already entered for the next command.
        const commandKey = this.commandKeys.shift();
        if (commandKey !== undefined) return commandKey;
        await this.beforeRead?.();
        const queued = this.queue.shift();
        if (queued !== undefined) return queued;
        if (this.display) {
            const code = await this.display.readKey({ bindings: KEY_BINDINGS.VI_KEYS });
            return code === 13 ? 10 : code;
        }

        const key = new Promise<number>(resolve => {
            this.pendingRead = resolve;
        });
        this.notifyBlocked();
        return key;
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
        this.commandKeys.length = 0;
    }

    get isBlocked() {
        return this.pendingRead !== null;
    }
}

let activeInputGate = new InputGate();

export function bindInputGate(inputGate: InputGate): void {
    if (!(inputGate instanceof InputGate))
        throw new TypeError('bindInputGate requires an InputGate');
    activeInputGate = inputGate;
}

export function pushKey(key: KeyInput): void {
    activeInputGate.feed(key);
}

export function pushKeys(keys: KeyInput | readonly KeyInput[]): void {
    activeInputGate.feed(keys);
}

export function queueCommandKeys(keys: string): void {
    activeInputGate.queueCommandKeys(keys);
}

export async function nhgetch() {
    const key = await activeInputGate.readKey();
    // tty_nhgetch() marks the displayed topline as seen after any key.
    // Keep its text visible, but a later screen reset must not page it again.
    if (game._pending_message) {
        game._retained_message = game._pending_message;
        game._pending_message = '';
    }
    // tty_nhgetch() treats NUL as Escape, including a typed Ctrl-@.
    return key === 0 ? 27 : key;
}

// C cmd.c:readchar_core(). Escape prefixes only have meaning in command,
// direction, and position input. Ordinary prompts keep a literal Escape.
export async function readchar(inputState: 'other' | 'command' | 'direction' | 'position' = 'other') {
    let key = await nhgetch();
    if (key === -1) {
        key = 27;
    } else if (key === 27 && game.iflags?.altmeta && inputState !== 'other') {
        // pgetchar() returns char, unlike the first nh_poskey() int.
        const next = nativeChar(await nhgetch());
        key = next === -1 || next === 0 || next === 27 ? 27 : next | 128;
    }
    return nativeChar(key);
}

function nativeChar(key: number): number {
    return NATIVE_COMMAND_PROFILE.signedChar ? (key << 24) >> 24 : key & 255;
}

export function resetInputState() {
    activeInputGate = new InputGate();
    return activeInputGate;
}
