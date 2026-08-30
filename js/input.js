// input.js — The single boundary for NetHack key input.
// C refs: win/tty/wintty.c:tty_nhgetch(), win/tty/getline.c.

import { KEY_BINDINGS } from './terminal.js';

function keyCode(key) {
    if (typeof key === 'number') return key;
    if (typeof key === 'string' && key.length > 0) return key.charCodeAt(0);
    throw new TypeError('InputGate accepts character strings or key codes');
}

export class InputGate {
    constructor({ beforeRead = null, display = null } = {}) {
        this.beforeRead = beforeRead;
        this.display = display;
        this.queue = [];
        this.pendingRead = null;
        this.blockedWaiters = [];
    }

    feed(keys) {
        const values = typeof keys === 'string' ? [...keys] : [keys].flat();
        for (const key of values) this.feedOne(keyCode(key));
    }

    feedOne(code) {
        if (!this.pendingRead) {
            this.queue.push(code);
            return;
        }
        const resolve = this.pendingRead;
        this.pendingRead = null;
        resolve(code);
    }

    async readKey() {
        await this.beforeRead?.();
        if (this.queue.length > 0) return this.queue.shift();
        if (this.display) {
            return this.display.readKey({ bindings: KEY_BINDINGS.VI_KEYS });
        }

        const key = new Promise(resolve => {
            this.pendingRead = resolve;
        });
        this.notifyBlocked();
        return key;
    }

    waitUntilBlocked() {
        if (this.isBlocked) return Promise.resolve();
        return new Promise(resolve => this.blockedWaiters.push(resolve));
    }

    notifyBlocked() {
        const waiters = this.blockedWaiters;
        this.blockedWaiters = [];
        for (const resolve of waiters) resolve();
    }

    clear() {
        this.queue.length = 0;
    }

    get isBlocked() {
        return this.pendingRead !== null;
    }
}

let activeInputGate = new InputGate();

export function bindInputGate(inputGate) {
    if (!(inputGate instanceof InputGate))
        throw new TypeError('bindInputGate requires an InputGate');
    activeInputGate = inputGate;
}

export function pushKey(key) {
    activeInputGate.feed(key);
}

export function pushKeys(keys) {
    activeInputGate.feed(keys);
}

export async function nhgetch() {
    return activeInputGate.readKey();
}

export function resetInputState() {
    activeInputGate = new InputGate();
    return activeInputGate;
}
