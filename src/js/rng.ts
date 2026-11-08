// rng.js — PRNG wrappers around ISAAC64.
// C ref: rng.c — independent core and display RNG contexts.  The display
// stream owns hallucinated glyphs and names; it must never perturb the core
// sequence which controls gameplay.

import { isaac64_init, isaac64_next_uint64 } from './isaac64.js';
import type { Isaac64Context } from './isaac64.js';
import { game } from './gstate.js';

export type RngSeed = number | bigint | string;

let _rngLog: string[] = [];
let _rngLogEnabled = false;

// C rnd.c:init_random(): seeds the core and display isaac64 contexts.
export function initRng(seed: RngSeed): void {
    game.currentSeed = seed;
    // Convert seed to 8 little-endian bytes
    let s = BigInt(seed) & 0xFFFFFFFFFFFFFFFFn;
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        bytes[i] = Number(s & 0xFFn);
        s >>= 8n;
    }
    game.coreCtx = isaac64_init(bytes);
    game.displayCtx = isaac64_init(bytes);
    _rngLog = [];
}

// Port only: enables capture of RNG draws for the recorder.
export function enableRngLog() { _rngLogEnabled = true; _rngLog = []; }
// Port only: returns the captured RNG log.
export function getRngLog() { return _rngLog; }
// Port only: appends one draw to the captured RNG log.
export function pushRngLogEntry(entry: string): void { if (_rngLogEnabled) _rngLog.push(entry); }

// Port only: resolves the core or display isaac64 context for a draw.
function initializedContext(stream: 'core' | 'display'): Isaac64Context {
    const context = stream === 'core' ? game.coreCtx : game.displayCtx;
    if (!context) throw new Error(`The ${stream} random stream has not been initialized`);
    return context;
}

// C rnd.c:RND().
function RND(x: number): number {
    const val = isaac64_next_uint64(initializedContext('core'));
    return Number(val % BigInt(x));
}

// C rnd.c:rn2().
// C ref: rn2(x) — random number 0..x-1
export function rn2(x: number): number {
    if (x <= 0) return 0;
    const val = RND(x);
    if (_rngLogEnabled) _rngLog.push(`rn2(${x})=${val}`);
    return val;
}

// C rnd.c:rn2_on_display_rng().
// C ref: rn2_on_display_rng(). Cosmetic choices use a separate RNG stream and
// do not appear in the core RNG log.
export function rn2Display(x: number): number {
    if (x <= 0) return 0;
    return Number(isaac64_next_uint64(initializedContext('display')) % BigInt(x));
}

// C rnd.c:rnd().
// C ref: rnd(x) — random number 1..x
export function rnd(x: number): number {
    if (x <= 0) return 0;
    const val = RND(x) + 1;
    if (_rngLogEnabled) _rngLog.push(`rnd(${x})=${val}`);
    return val;
}

// C hack.h:rn1().
// C ref: rn1(x, y) — random number y..y+x-1
export function rn1(x: number, y: number): number { return rn2(x) + y; }

// C rnd.c:rnl().
// C ref: rnl(x) — luck-adjusted random number.  The base draw is logged as
// rnl rather than rn2; only the conditional adjustment uses a nested rn2.
export function rnl(x: number): number {
    if (x <= 0) return 0;
    let adjustment = (game.u?.uluck || 0) + (game.u?.moreluck || 0);
    if (x <= 15) {
        adjustment = Math.trunc((Math.abs(adjustment) + 1) / 3)
            * Math.sign(adjustment);
    }
    let value = RND(x);
    if (adjustment && rn2(37 + Math.abs(adjustment))) {
        value = Math.max(0, Math.min(x - 1, value - adjustment));
    }
    if (_rngLogEnabled) _rngLog.push(`rnl(${x})=${value}`);
    return value;
}

// C rnd.c:d().
// C ref: d(n, x) — roll n dice of x sides
export function d(n: number, x: number): number {
    let sum = 0;
    // d(N,X) is one logged operation even though it advances the generator N
    // times. Calling rnd() here would add nested log entries.
    for (let i = 0; i < n; i++) sum += RND(x) + 1;
    if (_rngLogEnabled) _rngLog.push(`d(${n},${x})=${sum}`);
    return sum;
}

// C rnd.c:rne().
// C ref: rne(x) — exponentially distributed
// Internal rn2 calls are logged (matching C's PRNG log format).
export function rne(x: number): number {
    const ulevel = game.u?.ulevel || 1;
    const utmp = ulevel < 15 ? 5 : Math.trunc(ulevel / 3);
    let tmp = 1;
    while (tmp < utmp && !rn2(x)) tmp++;
    if (_rngLogEnabled) _rngLog.push(`rne(${x})=${tmp}`);
    return tmp;
}

// C rnd.c:rnz().
// C ref: rnz(i) — fuzzy random around i
// Internal rn2/rne calls are logged (matching C's PRNG log format).
export function rnz(i: number): number {
    let x = i;
    let tmp = 1000;
    tmp += rn2(1000);
    tmp *= rne(4);
    if (rn2(2)) { x *= tmp; x = Math.trunc(x / 1000); }
    else { x *= 1000; x = Math.trunc(x / tmp); }
    if (_rngLogEnabled) _rngLog.push(`rnz(${i})=${x}`);
    return x;
}


// C rnd.c:shuffle_int_array(). Randomize the first count entries of the
// list in place, from the top down, skipping no-op swaps.
export function shuffleIntArray<T>(values: T[], count: number, random: typeof rn2 = rn2): void {
    for (let index = count - 1; index > 0; index--) {
        const other = random(index + 1);
        if (other === index) continue;
        const current = values[index];
        const swap = values[other];
        if (current === undefined || swap === undefined)
            throw new RangeError(`shuffle_int_array selected a missing entry ${other}.`);
        values[index] = swap;
        values[other] = current;
    }
}
