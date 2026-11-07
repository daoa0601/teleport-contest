// Nonfatal impossible() reports and the Engine-local panic boundary.
// C refs: pline.c:impossible(), end.c:panic().
import { BUFSZ } from './const.js';
import { beginPanicOutput, plineWithContinuation, rawPrintf } from './pline.js';
import { rawPrint } from './input.js';
import { game, requireLiveGame } from './gstate.js';
import { paniclog } from './novel_tribute.js';
import { saveErrorGame } from './save.js';
import { PanicTermination } from './panic_termination.js';
import type { GameState } from './game_state.js';

export const FUZZER_OFF = 0;
export const FUZZER_IMPOSSIBLE_PANIC = 1;
export const FUZZER_IMPOSSIBLE_CONTINUE = 2;

// Port only: typed access to flags.debug_fuzzer, which C reads inline.
function fuzzerMode(state: GameState): number {
    return Number(state.flags?.debug_fuzzer ?? FUZZER_OFF);
}

// Part of C pline.c:impossible(), end.c:panic(): NUL-terminate and truncate
// the reason to BUFSZ-1 like the C char buffers.
function diagnosticReason(reason: string): string {
    const bytes = new TextEncoder().encode(reason.split('\0', 1)[0] ?? '');
    return new TextDecoder().decode(bytes.subarray(0, BUFSZ - 1));
}





// C pline.c:impossible().
export async function impossible(reason: string, { state = game }: { state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    reason = diagnosticReason(reason);
    if (state.program_state.in_impossible)
        await panic('impossible called impossible', { state });
    state.program_state.in_impossible = true;
    paniclog('impossible', reason, state);
    if (fuzzerMode(state) === FUZZER_IMPOSSIBLE_PANIC)
        await panic(reason, { state });

    await plineWithContinuation(reason, { urgent: true });
    if (!state.program_state.in_sanity_check) {
        await plineWithContinuation('Program in disorder!'
            + (state.program_state.something_worth_saving
                ? '  (Saving and reloading may fix this problem.)' : ''));
        await plineWithContinuation('Please report these messages to devteam@nethack.org.');
    }
    state.program_state.in_impossible = false;
}

// C end.c:panic(): full body; the window-exit preamble lives in beginPanicOutput().
export async function panic(reason: string, { state = game }: { state?: GameState } = {}): Promise<never> {
    requireLiveGame(state);
    reason = diagnosticReason(reason);
    const termination = new PanicTermination(reason);
    const alreadyPanicking = state.program_state.panicking || 0;
    state.program_state.panicking = alreadyPanicking + 1;
    if (alreadyPanicking) throw termination;

    await beginPanicOutput();
    const useful = state.program_state.something_worth_saving;
    rawPrint(state.program_state.gameover
        ? 'Postgame wrapup disrupted.'
        : useful ? 'Suddenly, the dungeon collapses.' : 'Program initialization has failed.');
    // The pinned sysconf has WIZARDS=*, with no SUPPORT or RECOVER setting.
    if (!state.flags?.debug)
        rawPrintf('Report error to "wizard"'
            + (useful ? '\nand it may be possible to rebuild.' : '.'));
    if (useful && fuzzerMode(state) === FUZZER_OFF) await saveErrorGame();
    rawPrint(reason);
    paniclog('panic', reason, state);
    throw termination;
}
