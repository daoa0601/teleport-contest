// Diagnostics helpers for pline.c:impossible() and end.c:panic();
// panic() itself lives in end.ts with its end.c owner.
import { BUFSZ } from './const.js';
import { beginPanicOutput, plineWithContinuation, rawPrintf } from './pline.js';
import { rawPrint } from './input.js';
import { game, requireLiveGame } from './gstate.js';
import { paniclog } from './novel_tribute.js';
import { saveErrorGame } from './save.js';
import { PanicTermination } from './panic_termination.js';
export const FUZZER_OFF = 0;
export const FUZZER_IMPOSSIBLE_PANIC = 1;
export const FUZZER_IMPOSSIBLE_CONTINUE = 2;
// Port only: typed access to flags.debug_fuzzer, which C reads inline.
export function fuzzerMode(state) {
    return Number(state.flags?.debug_fuzzer ?? FUZZER_OFF);
}
// Part of C pline.c:impossible(), end.c:panic(): NUL-terminate and truncate
// the reason to BUFSZ-1 like the C char buffers.
export function diagnosticReason(reason) {
    const bytes = new TextEncoder().encode(reason.split('\0', 1)[0] ?? '');
    return new TextDecoder().decode(bytes.subarray(0, BUFSZ - 1));
}
//# sourceMappingURL=diagnostics.js.map