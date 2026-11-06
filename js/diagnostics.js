// Nonfatal impossible() reports and the Engine-local panic boundary.
// C refs: pline.c:impossible(), files.c:paniclog(), end.c:panic().
import { BUFSZ, PANICLOG, PATCHLEVEL, VERSION_MAJOR, VERSION_MINOR } from './const.js';
import { beginPanicOutput, plineWithContinuation, rawPrint, rawPrintf } from './pline.js';
import { game, requireLiveGame } from './gstate.js';
import { saveErrorGame } from './save.js';
import { PanicTermination } from './panic_termination.js';
export const FUZZER_OFF = 0;
export const FUZZER_IMPOSSIBLE_PANIC = 1;
export const FUZZER_IMPOSSIBLE_CONTINUE = 2;
// Port only: typed access to flags.debug_fuzzer, which C reads inline.
function fuzzerMode(state) {
    return Number(state.flags?.debug_fuzzer ?? FUZZER_OFF);
}
// Part of C pline.c:impossible(), end.c:panic(): NUL-terminate and truncate
// the reason to BUFSZ-1 like the C char buffers.
function diagnosticReason(reason) {
    const bytes = new TextEncoder().encode(reason.split('\0', 1)[0] ?? '');
    return new TextDecoder().decode(bytes.subarray(0, BUFSZ - 1));
}
// Part of C files.c:paniclog(): yyyymmdd+hhmmss timestamp (calendar.c) of the record.
function diagnosticDateTime(state) {
    if (state.datetime)
        return state.datetime;
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate(),
        now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((value, index) => String(value).padStart(index ? 2 : 4, '0')).join('');
}
// C files.c:paniclog(): Web Storage record in place of the paniclog append.
// Web Storage retains semantic records. Native's Unix uid and paniclog header
// are not available in a browser; do not fabricate a native header.
export function paniclog(type, reason, state = game) {
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
// C pline.c:impossible().
export async function impossible(reason, { state = game } = {}) {
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
        rawPrintf('Report error to "wizard"'
            + (useful ? '\nand it may be possible to rebuild.' : '.'));
    if (useful && fuzzerMode(state) === FUZZER_OFF)
        await saveErrorGame();
    rawPrint(reason);
    paniclog('panic', reason, state);
    throw termination;
}
//# sourceMappingURL=diagnostics.js.map