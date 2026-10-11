// Typed counterpart of the contest ISAAC64 adapter.
// The judge overwrites the emitted js/isaac64.js from frozen/ when scoring.
// isaac64.js -- ISAAC64 PRNG (public domain)
// Faithful port of nethack-c/src/isaac64.c by Timothy B. Terriberry.
// Uses BigInt for 64-bit unsigned integer arithmetic.
// cf. isaac64.c — ISAAC64 cryptographic PRNG implementation
const MASK = 0xffffffffffffffffn;
const SZ_LOG = 8;
const SZ = 1 << SZ_LOG;
const SEED_SZ_MAX = SZ * 8; // 2048
const GOLDEN = 0x9e3779b97f4a7c13n;
function wordAt(words, index) {
    const word = words[index];
    if (word === undefined)
        throw new RangeError(`ISAAC64 state has no word at ${index}`);
    return word;
}
function seedByteAt(bytes, index) {
    const byte = bytes[index];
    if (byte === undefined)
        throw new RangeError(`ISAAC64 seed has no byte at ${index}`);
    return byte;
}
// cf. isaac64.c:39 — extract SZ_LOG bits starting at bit 3
export function lower_bits(x) {
    return Number((x >> 3n) & 0xffn);
}
// cf. isaac64.c:45 — extract SZ_LOG bits starting at bit SZ_LOG+3 = 11
export function upper_bits(y) {
    return Number((y >> 11n) & 0xffn);
}
// cf. isaac64.c:103 — mix 8 values using alternating shift pattern
export function isaac64_mix(x) {
    const SHIFT = [9n, 9n, 23n, 15n, 14n, 20n, 17n, 14n];
    for (let i = 0; i < 8; i++) {
        x[i] = (wordAt(x, i) - wordAt(x, (i + 4) & 7)) & MASK;
        x[(i + 5) & 7] = wordAt(x, (i + 5) & 7) ^ (wordAt(x, (i + 7) & 7) >> wordAt(SHIFT, i));
        x[(i + 7) & 7] = (wordAt(x, (i + 7) & 7) + wordAt(x, i)) & MASK;
        i++;
        x[i] = (wordAt(x, i) - wordAt(x, (i + 4) & 7)) & MASK;
        x[(i + 5) & 7] = wordAt(x, (i + 5) & 7) ^ ((wordAt(x, (i + 7) & 7) << wordAt(SHIFT, i)) & MASK);
        x[(i + 7) & 7] = (wordAt(x, (i + 7) & 7) + wordAt(x, i)) & MASK;
    }
}
// cf. isaac64.c:50 — generate next batch of 256 random values
export function isaac64_update(ctx) {
    const m = ctx.m;
    const r = ctx.r;
    let a = ctx.a;
    ctx.c = (ctx.c + 1n) & MASK;
    let b = (ctx.b + ctx.c) & MASK;
    // First half: uses m[i + SZ/2]
    for (let i = 0; i < SZ / 2;) {
        let x;
        let y;
        x = wordAt(m, i);
        a = (((a ^ ((a << 21n) & MASK)) ^ MASK) + wordAt(m, i + SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
        x = wordAt(m, i);
        a = ((a ^ (a >> 5n)) + wordAt(m, i + SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
        x = wordAt(m, i);
        a = ((a ^ ((a << 12n) & MASK)) + wordAt(m, i + SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
        x = wordAt(m, i);
        a = ((a ^ (a >> 33n)) + wordAt(m, i + SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
    }
    // Second half: uses m[i - SZ/2]
    for (let i = SZ / 2; i < SZ;) {
        let x;
        let y;
        x = wordAt(m, i);
        a = (((a ^ ((a << 21n) & MASK)) ^ MASK) + wordAt(m, i - SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
        x = wordAt(m, i);
        a = ((a ^ (a >> 5n)) + wordAt(m, i - SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
        x = wordAt(m, i);
        a = ((a ^ ((a << 12n) & MASK)) + wordAt(m, i - SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
        x = wordAt(m, i);
        a = ((a ^ (a >> 33n)) + wordAt(m, i - SZ / 2)) & MASK;
        m[i] = y = (wordAt(m, lower_bits(x)) + a + b) & MASK;
        r[i] = b = (wordAt(m, upper_bits(y)) + x) & MASK;
        i++;
    }
    ctx.b = b;
    ctx.a = a;
    ctx.n = SZ;
}
// cf. isaac64.c:118 — create a new ISAAC64 context and seed it
export function isaac64_init(seed_bytes) {
    const ctx = {
        a: 0n,
        b: 0n,
        c: 0n,
        n: 0,
        r: Array(SZ).fill(0n),
        m: Array(SZ).fill(0n),
    };
    isaac64_reseed(ctx, seed_bytes);
    return ctx;
}
// cf. isaac64.c:124 — mix seed into state and reinitialize
export function isaac64_reseed(ctx, seed_bytes) {
    const m = ctx.m;
    const r = ctx.r;
    const seed = seed_bytes ?? [];
    let nseed = seed.length;
    if (nseed > SEED_SZ_MAX)
        nseed = SEED_SZ_MAX;
    // XOR seed bytes into r[] as little-endian uint64s
    let i = 0;
    for (; i < (nseed >> 3); i++) {
        let val = 0n;
        for (let j = 7; j >= 0; j--) {
            val = (val << 8n) | BigInt(seedByteAt(seed, (i << 3) | j));
        }
        r[i] = wordAt(r, i) ^ val;
    }
    // Handle remaining bytes
    const remaining = nseed - (i << 3);
    if (remaining > 0) {
        let ri = BigInt(seedByteAt(seed, i << 3));
        for (let j = 1; j < remaining; j++) {
            ri |= BigInt(seedByteAt(seed, (i << 3) | j)) << BigInt(j << 3);
        }
        r[i] = wordAt(r, i) ^ ri;
        i++;
    }
    // Initialize x[] with golden ratio constant
    const x = Array(8).fill(GOLDEN);
    // 4 rounds of mixing
    for (let k = 0; k < 4; k++)
        isaac64_mix(x);
    // Mix r[] values into m[]
    for (let k = 0; k < SZ; k += 8) {
        for (let j = 0; j < 8; j++)
            x[j] = (wordAt(x, j) + wordAt(r, k + j)) & MASK;
        isaac64_mix(x);
        for (let j = 0; j < 8; j++)
            m[k + j] = wordAt(x, j);
    }
    // Double-mix with m[]
    for (let k = 0; k < SZ; k += 8) {
        for (let j = 0; j < 8; j++)
            x[j] = (wordAt(x, j) + wordAt(m, k + j)) & MASK;
        isaac64_mix(x);
        for (let j = 0; j < 8; j++)
            m[k + j] = wordAt(x, j);
    }
    // Generate first batch
    isaac64_update(ctx);
}
// cf. isaac64.c:161 — return next random uint64
// Autotranslated from isaac64.c:161
export function isaac64_next_uint64(_ctx) {
    if (!_ctx.n)
        isaac64_update(_ctx);
    return wordAt(_ctx.r, --_ctx.n);
}
// Peek at the next PRNG value without consuming it.
// Used by mail daemon to check delivery probability without
// perturbing the RNG stream.
export function isaac64_peek_uint64(_ctx) {
    if (!_ctx.n)
        isaac64_update(_ctx);
    return wordAt(_ctx.r, _ctx.n - 1);
}
// cf. isaac64.c:166 — return unbiased random value in [0, n)
// Autotranslated from isaac64.c:166
export function isaac64_next_uint(_ctx, _n) {
    let remainder;
    let multiple;
    do {
        const random = isaac64_next_uint64(_ctx);
        remainder = random % _n;
        multiple = random - remainder;
    } while (((multiple + _n - 1n) & MASK) < multiple);
    return remainder;
}
//# sourceMappingURL=isaac64.js.map