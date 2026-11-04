// input.js — The single boundary for NetHack key input.
// C refs: win/tty/wintty.c:tty_nhgetch(), win/tty/getline.c.
import { KEY_BINDINGS } from './terminal.js';
import { game } from './gstate.js';
import { NATIVE_COMMAND_CONSTANTS, NATIVE_COMMAND_PROFILE, NATIVE_COMMANDS } from './command_data.js';
import { rn1, rn2, rnd } from './rng.js';
import { isok } from './cmd.js';
import { randomKey, resetFuzzerCommandState } from './cmd.js';
export const MAP_CLICK_KEY = 256;
function keyCode(key) {
    if (typeof key === 'number')
        return key;
    if (typeof key === 'string' && key.length > 0)
        return key.charCodeAt(0);
    throw new TypeError('InputGate accepts character strings or key codes');
}
export class InputGate {
    beforeRead;
    display;
    queue;
    pendingRead;
    mapClick = null;
    blockedWaiters;
    constructor({ beforeRead = null, display = null } = {}) {
        this.beforeRead = beforeRead;
        this.display = display;
        this.queue = [];
        this.pendingRead = null;
        this.blockedWaiters = [];
    }
    feed(keys) {
        const values = typeof keys === 'string' ? [...keys]
            : typeof keys === 'number' ? [keys] : keys;
        for (const key of values)
            this.feedOne(keyCode(key));
    }
    feedOne(code) {
        // The pinned Unix tty retains ICRNL for external keyboard input.
        // Generated fuzzer bytes bypass this source conversion.
        if (code === 13)
            code = 10;
        this.feedInput(code);
    }
    feedMapClick(x, y, button) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !isok(x, y) || button !== 1 && button !== 2)
            throw new RangeError('A map click must be within the dungeon map');
        this.feedInput({ x, y, button });
    }
    takeMapClick() {
        const click = this.mapClick;
        this.mapClick = null;
        return click;
    }
    feedInput(input) {
        if (!this.pendingRead) {
            this.queue.push(input);
            return;
        }
        const resolve = this.pendingRead;
        this.pendingRead = null;
        resolve(input);
    }
    async readKey(inputState = 'other') {
        // tty input belongs to the player. Command owners consume canned
        // choices explicitly so message pagers cannot steal item letters.
        await this.beforeRead?.();
        this.mapClick = null;
        if (game.iflags.debug_fuzzer)
            return randomKey(inputState);
        const queued = this.queue.shift();
        if (queued !== undefined)
            return this.inputKey(queued);
        if (this.display) {
            const code = await this.display.readKey({ bindings: KEY_BINDINGS.VI_KEYS });
            return code === 13 ? 10 : code;
        }
        const key = new Promise(resolve => {
            this.pendingRead = resolve;
        });
        this.notifyBlocked();
        return this.inputKey(await key);
    }
    inputKey(input) {
        if (typeof input === 'number')
            return input;
        this.mapClick = input;
        return MAP_CLICK_KEY;
    }
    waitUntilBlocked() {
        if (this.isBlocked)
            return Promise.resolve();
        return new Promise(resolve => this.blockedWaiters.push(resolve));
    }
    notifyBlocked() {
        const waiters = this.blockedWaiters;
        this.blockedWaiters = [];
        for (const resolve of waiters)
            resolve();
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
// The gate itself stays private; the folded cmd.c readchar()/pgetchar()
// ports read through this accessor, exactly like their C bodies call
// the windowport's key entry points.
export function inputGate() {
    return activeInputGate;
}
export function bindInputGate(inputGate) {
    if (!(inputGate instanceof InputGate))
        throw new TypeError('bindInputGate requires an InputGate');
    activeInputGate = inputGate;
    // C randomkey()'s statics are process-wide; the port scopes them to one
    // game, and every game binds a freshly built gate (jsmain start()), so
    // the table index and repeat key start from their head again here.
    resetFuzzerCommandState();
}
export function pushKey(key) {
    activeInputGate.feed(key);
}
export function pushKeys(keys) {
    activeInputGate.feed(keys);
}
export async function nhgetch(inputState = 'other') {
    // tty_nhgetch() clears WIN_STOP before reading any key, including a
    // target selection made by an action resumed from the command queue.
    game._suppressMessagesUntilInput = false;
    if (game.nhDisplay)
        game.nhDisplay.stoppedTopline = null;
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
export function resetInputState() {
    activeInputGate = new InputGate();
    resetFuzzerCommandState();
    return activeInputGate;
}
//# sourceMappingURL=input.js.map