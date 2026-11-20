// Diagnostics helpers for pline.c:impossible() and end.c:panic();
// panic() itself lives in end.ts with its end.c owner.
import { byteStringFromBytes, bytesFromByteString } from './hacklib.js';
import { BUFSZ } from './const.js';
import type { GameState } from './game_state.js';

export const FUZZER_OFF = 0;
export const FUZZER_IMPOSSIBLE_PANIC = 1;
export const FUZZER_IMPOSSIBLE_CONTINUE = 2;

// Port only: typed access to flags.debug_fuzzer, which C reads inline.
export function fuzzerMode(state: GameState): number {
    return Number(state.flags?.debug_fuzzer ?? FUZZER_OFF);
}

// Part of C pline.c:impossible(), end.c:panic(): NUL-terminate and truncate
// the reason to BUFSZ-1 like the C char buffers.
export function diagnosticReason(reason: string): string {
    return byteStringFromBytes(
        bytesFromByteString(reason.split('\0', 1)[0] ?? '').subarray(0, BUFSZ - 1));
}
