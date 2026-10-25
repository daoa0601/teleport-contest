// input.js — The single boundary for NetHack key input.
// C refs: win/tty/wintty.c:tty_nhgetch(), win/tty/getline.c.

import { KEY_BINDINGS } from './terminal.js';
import { game } from './gstate.js';
import { NATIVE_COMMAND_CONSTANTS, NATIVE_COMMAND_PROFILE, NATIVE_COMMANDS } from './command_data.js';
import { rn1, rn2, rnd } from './rng.js';
import type { TerminalReadKeyOptions } from './terminal.js';
import type { Position } from './map_types.js';
import { isok } from './const.js';

export type CommandResponse = number | 'user-input' | Position;
export interface MapClick extends Position { button: 1 | 2 }
export const MAP_CLICK_KEY = 256;

export type KeyInput = string | number;
type InputState = 'other' | 'command' | 'direction' | 'position';
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
    private readonly queue: (number | MapClick)[];
    private readonly commandKeys: CommandResponse[];
    private pendingRead: ((input: number | MapClick) => void) | null;
    private mapClick: MapClick | null = null;
    private blockedWaiters: (() => void)[];
    private fuzzerCommandIndex = 0;
    private lastFuzzerCommand = 0;

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

    queueCommandKeys(keys: string): void {
        this.commandKeys.push(...[...keys].map(keyCode));
    }

    queueCommandResponses(responses: readonly CommandResponse[]): void {
        this.commandKeys.push(...responses);
    }

    clearCommandKeys(): void {
        this.commandKeys.length = 0;
    }

    takeCommandKey(): number | undefined {
        const response = this.commandKeys.shift();
        if (response === undefined || response === 'user-input') return undefined;
        if (typeof response === 'number') return response;
        this.clearCommandKeys();
        return 27;
    }

    takeCommandPosition(): Position | null | undefined {
        const response = this.commandKeys.shift();
        if (response === undefined) return undefined;
        if (typeof response === 'object') return response;
        this.clearCommandKeys();
        return null;
    }

    async readKey(inputState: InputState = 'other'): Promise<number> {
        // tty input belongs to the player. Command owners consume canned
        // choices explicitly so message pagers cannot steal item letters.
        await this.beforeRead?.();
        this.mapClick = null;
        if (game.iflags.debug_fuzzer) return this.randomKey(inputState);
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

    // C cmd.c:randomkey(). The table index and repeat key survive prompts.
    private randomKey(inputState: InputState): number {
        if (inputState === 'command' && (this.lastFuzzerCommand === 1 || this.lastFuzzerCommand === 16)
            && rn2(5)) return this.lastFuzzerCommand;
        let key;
        switch (rn2(16)) {
        case 0: key = 10; break;
        case 1: case 2: case 3: case 4: key = rn1(95, 32); break;
        case 5: key = rn2(2) ? 9 : 32; break;
        case 6: key = rn1(26, 97); break;
        case 7: key = rn1(26, 65); break;
        case 8: key = NATIVE_COMMANDS[this.fuzzerCommandIndex++ % NATIVE_COMMANDS.length]?.key ?? 0; break;
        case 9: key = 35; break;
        case 10: case 11: case 12: {
            const direction = rn2(NATIVE_COMMAND_CONSTANTS.N_DIRS);
            const mode = rn2(7) ? 0 : !rn2(3) ? 2 : 1;
            key = game.commandBindings.keyForDirection(direction, mode);
            break;
        }
        case 13: key = rn1(10, 48); break;
        case 14: key = rnd(game.iflags.wc_eight_bit_input ? 255 : 127); break;
        default: key = 27; break;
        }
        key = nativeChar(key);
        if (inputState === 'command') this.lastFuzzerCommand = key;
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
        this.mapClick = null;
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

export function queueCommandResponses(responses: readonly CommandResponse[]): void {
    activeInputGate.queueCommandResponses(responses);
}

export function takeCommandPosition(): Position | null | undefined {
    return activeInputGate.takeCommandPosition();
}

export function clearCommandKeys(): void {
    activeInputGate.clearCommandKeys();
}

export function takeCommandKey(): number | undefined {
    return activeInputGate.takeCommandKey();
}

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

// C cmd.c:readchar_core(). Escape prefixes only have meaning in command,
// direction, and position input. Ordinary prompts keep a literal Escape.
export async function readchar(inputState: InputState = 'other') {
    // Native fuzzer input skips the keyboard's NUL, EOF, and Escape decoding.
    if (game.iflags.debug_fuzzer) return activeInputGate.readKey(inputState);
    let key = await nhgetch(inputState);
    if (key === MAP_CLICK_KEY) {
        // C readchar_core(): every nh_poskey click records its location
        // and queues the command bound to that button, including getpos.
        const click = activeInputGate.takeMapClick();
        game._clicklookTarget = click ? { x: click.x, y: click.y } : null;
        const command = click ? game.commandBindings.mouseCommand(click.button) : null;
        if (command?.name) {
            game._cannedCommands ??= [];
            game._cannedCommands.push({ kind: 'command', name: command.name });
        }
        return key;
    }
    if (key === -1) {
        key = 27;
    } else if (key === 27 && game.iflags?.altmeta && inputState !== 'other') {
        // pgetchar() returns char, unlike the first nh_poskey() int.
        const next = nativeChar(await nhgetch(inputState));
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
