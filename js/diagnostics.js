// Nonfatal impossible() reports and the Engine-local panic boundary.
// C refs: pline.c:impossible(), files.c:paniclog(), end.c:panic().
import { BUFSZ, PANICLOG, PATCHLEVEL, VERSION_MAJOR, VERSION_MINOR } from './const.js';
import { beginPanicOutput, plineWithContinuation, rawPrint } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { saveErrorGame } from './save.js';
import { FormatterPanic, PanicTermination } from './panic_termination.js';
export const FUZZER_OFF = 0;
export const FUZZER_IMPOSSIBLE_PANIC = 1;
export const FUZZER_IMPOSSIBLE_CONTINUE = 2;
function fuzzerMode(state) {
    return Number(state.flags?.debug_fuzzer ?? FUZZER_OFF);
}
function diagnosticReason(reason) {
    const bytes = new TextEncoder().encode(reason.split('\0', 1)[0] ?? '');
    return new TextDecoder().decode(bytes.subarray(0, BUFSZ - 1));
}
function diagnosticDateTime(state) {
    if (state.datetime)
        return state.datetime;
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate(),
        now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((value, index) => String(value).padStart(index ? 2 : 4, '0')).join('');
}
// Web Storage retains semantic records. Native's Unix uid and paniclog header
// are not available in a browser; do not fabricate a native header.
function paniclog(type, reason, state) {
    if (state.program_state.in_paniclog)
        return;
    state.program_state.in_paniclog = true;
    try {
        const storage = state.storage;
        if (storage?.getItem && storage?.setItem) {
            const record = {
                type, reason, datetime: diagnosticDateTime(state),
                version: `${VERSION_MAJOR}.${VERSION_MINOR}.${PATCHLEVEL}`,
                player: state.plname || null,
                playmode: state.flags?.debug ? 'D' : state.flags?.explore ? 'X' : '-',
            };
            storage.setItem(PANICLOG, (storage.getItem(PANICLOG) || '')
                + JSON.stringify(record) + '\n');
        }
    }
    catch (error) {
        if (error instanceof PanicTermination)
            throw error;
        // Like a failed native log-file open, storage failure is nonfatal.
    }
    state.program_state.in_paniclog = false;
}
export async function impossible(reason, { state = game } = {}) {
    requireLiveGame(state);
    // Earlier formatter reports finished before this call began in C.
    await publishDeferredImpossibles(state);
    await reportImpossible(diagnosticReason(reason), state, { logged: false });
}
// C impossible() called while a synchronous formatter (doname(),
// unpaid_cost()) builds text. Native logs and prints before the formatter
// returns, so its caller's message or window always follows the diagnostic.
// Log now and print before the next message, window, or keystroke.
export function deferImpossible(reason, state = game) {
    reason = diagnosticReason(reason);
    paniclog('impossible', reason, state);
    // Native panics here, before the formatter's next statement.
    if (fuzzerMode(state) === FUZZER_IMPOSSIBLE_PANIC) {
        state.program_state.in_impossible = true;
        throw new FormatterPanic(reason);
    }
    (state.program_state.deferred_impossibles ??= []).push(reason);
}
export async function publishDeferredImpossibles(state = game) {
    // A report's own messages must not start a nested report.
    if (state.program_state.in_impossible)
        return;
    const pending = state.program_state.deferred_impossibles;
    if (!pending?.length)
        return;
    state.program_state.deferred_impossibles = [];
    for (const reason of pending)
        await reportImpossible(reason, state, { logged: true });
}
async function reportImpossible(reason, state, { logged }) {
    if (state.program_state.in_impossible)
        await panic('impossible called impossible', { state });
    state.program_state.in_impossible = true;
    if (!logged)
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
export async function panic(reason, { state = game } = {}) {
    requireLiveGame(state);
    reason = diagnosticReason(reason);
    const termination = new PanicTermination(reason);
    const alreadyPanicking = state.program_state.panicking || 0;
    state.program_state.panicking = alreadyPanicking + 1;
    if (alreadyPanicking)
        throw termination;
    await beginPanicOutput();
    const useful = state.program_state.something_worth_saving;
    rawPrint(state.program_state.gameover
        ? 'Postgame wrapup disrupted.'
        : useful ? 'Suddenly, the dungeon collapses.' : 'Program initialization has failed.');
    // The pinned sysconf has WIZARDS=*, with no SUPPORT or RECOVER setting.
    if (!state.flags?.debug)
        rawPrint('Report error to "wizard"'
            + (useful ? '\nand it may be possible to rebuild.' : '.'));
    if (useful && fuzzerMode(state) === FUZZER_OFF)
        await saveErrorGame();
    rawPrint(reason);
    paniclog('panic', reason, state);
    throw termination;
}
//# sourceMappingURL=diagnostics.js.map