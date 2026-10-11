#!/usr/bin/env node
// score-session.mjs — bounded per-session scorer for fresh-C triage.
//
// One session in, one bounded JSON result out. Scoring semantics are
// lifted from frozen/ps_test_runner.mjs (RNG normalization, screen
// visual comparison, cursor equality, pass condition, cross-segment
// storage); this file adds bounded first-divergence diagnostics and
// streams JS outputs one segment at a time so memory stays bounded.
//
//   node scripts/lib/score-session.mjs PATH
//   stdout: "__RESULT_ONE__" sentinel, then one JSON line.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { decodeScreen, diffCell, renderCell, ROWS_24, COLS_80 } from '../../frozen/screen-decode.mjs';
import { normalizeSession } from '../../frozen/session_loader.mjs';
import { decodeSession, errorMessage, itemAt } from './session-types.mjs';
import { createReplayStorage, loadReplayRunner } from './replay-capture.mjs';
function cellAt(grid, row, column) {
    return itemAt(itemAt(grid, row), column);
}
const PROJECT_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
// ── Frozen scorer semantics (frozen/ps_test_runner.mjs) ──
export function isRngCall(entry) {
    return typeof entry === 'string' && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry);
}
export function extractRngCalls(rngArray) {
    return (rngArray || []).filter(isRngCall);
}
// Strip caller annotations and JS index prefix: "12 rn2(N)=M @ f(c:1)" → "rn2(N)=M".
export function normalizeRng(entry) {
    return entry.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
}
// Build-variant screen lines tolerated before decode: version banners
// and wall-clock timestamps.
const STARTUP_VARIANT_LINES = [
    /Version\s+\d+\.\d+\.\d+[^\n]*/,
];
export function preDecode(s) {
    let cur = String(s);
    for (const re of STARTUP_VARIANT_LINES) {
        cur = cur.replace(re, '<<VERSION_BANNER>>');
    }
    cur = cur.replace(/^\d{2}:\d{2}:\d{2}\.$/gm, '<time>.');
    return cur;
}
export function screensVisuallyEqual(a, b) {
    const ga = decodeScreen(preDecode(a));
    const gb = decodeScreen(preDecode(b));
    for (let r = 0; r < ROWS_24; r++) {
        for (let c = 0; c < COLS_80; c++) {
            if (diffCell(cellAt(ga, r, c), cellAt(gb, r, c)))
                return false;
        }
    }
    return true;
}
export function cursorsEqual(c, j) {
    if (!Array.isArray(c))
        return true; // no recorded cursor → don't fail
    if (!Array.isArray(j))
        return false;
    return c[0] === j[0] && c[1] === j[1] && c[2] === j[2];
}
// ── Bounded diagnostics helpers ──
const TEXT_LIMIT = 2000;
const STACK_LINES = 12;
function truncText(s, n = TEXT_LIMIT) {
    const t = String(s ?? '');
    return t.length <= n ? t : t.slice(0, n) + `…(+${t.length - n} chars)`;
}
function truncStack(stack) {
    if (!stack)
        return null;
    const lines = String(stack).split('\n');
    return lines.length <= STACK_LINES
        ? lines.join('\n')
        : lines.slice(0, STACK_LINES).join('\n') + `\n…(+${lines.length - STACK_LINES} lines)`;
}
// "rn2(13)=3 @ pick_role(role.c:1032)" → "pick_role(role.c:1032)"
export function callerTag(entry) {
    if (typeof entry !== 'string')
        return null;
    const m = entry.match(/@\s*(.+?)\s*$/);
    return m ? truncText(m[1], 200) : null;
}
function stripIndexPrefix(entry) {
    return entry.replace(/^\d+\s+/, '');
}
function rowText(gridRow) {
    let s = '';
    for (const cell of gridRow)
        s += renderCell(cell);
    return s.replace(/\s+$/, '');
}
function cellInfo(cell) {
    return { ch: renderCell(cell), color: cell.color, attr: cell.attr, decgfx: cell.decgfx ? 1 : 0 };
}
// ≤3 decoded text rows around `row`, both sides — never a full screen.
function neighborhoodRows(ga, gb, row) {
    const rows = [];
    for (let r = Math.max(0, row - 1); r <= Math.min(ROWS_24 - 1, row + 1); r++) {
        rows.push({ row: r, c: rowText(itemAt(ga, r)), js: rowText(itemAt(gb, r)) });
    }
    return rows;
}
function findFirstCellDiff(ga, gb) {
    for (let r = 0; r < ROWS_24; r++) {
        for (let c = 0; c < COLS_80; c++) {
            const kind = diffCell(cellAt(ga, r, c), cellAt(gb, r, c));
            if (kind)
                return { row: r, col: c, kind };
        }
    }
    return null;
}
// ≤3 raw entries around index i of a slice.
function neighborhood(slice, i) {
    return slice.slice(Math.max(0, i - 1), i + 2).map(e => truncText(e, 200));
}
// First index where two per-input slices disagree; the shorter side's
// length when one is a prefix of the other; null when equal.
export function firstSliceDifference(cSlice, jSlice) {
    const m = Math.min(cSlice.length, jSlice.length);
    for (let i = 0; i < m; i++) {
        if (normalizeRng(itemAt(cSlice, i)) !== normalizeRng(itemAt(jSlice, i)))
            return i;
    }
    return cSlice.length === jSlice.length ? null : m;
}
// ── Scoring ──
/**
 * Score one session file through js/jsmain.js runSegment.
 * Result (all diagnostics bounded):
 *   { session, passed, metrics: { rngCalls, screens, cellsOnly, cursors },
 *     produced, firstRng, firstScreen, firstDivergence, error,
 *     segments, time, basis }
 *
 * metrics follow the official positional flattened comparison exactly;
 * firstRng is located by per-input slice alignment, which pinpoints the
 * boundary even when shifted call counts make later flat positions all
 * differ (see `basis`).
 */
export async function scoreSession(sessionPath) {
    const t0 = performance.now();
    const runSegmentImpl = await loadReplayRunner(pathToFileURL(join(PROJECT_ROOT, 'js/jsmain.js')).href);
    const sessionData = JSON.parse(readFileSync(sessionPath, 'utf8'));
    const segments = decodeSession(normalizeSession(sessionData)).segments;
    // C-side expectations flattened once with provenance; cRngBase[s] is
    // the flattened RNG index where segment s starts.
    const cRng = [];
    const cRngBase = [];
    const cScreens = [];
    for (const [si, seg] of segments.entries()) {
        cRngBase.push(cRng.length);
        for (const [ti, step] of (seg.steps ?? []).entries()) {
            for (const e of extractRngCalls(step.rng)) {
                cRng.push({ e, si, ti });
            }
            if (step.screen) {
                cScreens.push({
                    screen: step.screen,
                    cursor: Array.isArray(step.cursor) ? step.cursor : null,
                    si, ti,
                });
            }
        }
    }
    const rngTotal = cRng.length;
    const screenTotal = cScreens.length;
    // One shared Web-Storage-shaped Map per session: cross-segment C
    // state (bones, record, save) flows through it, as in the frozen runner.
    const storageHandle = createReplayStorage();
    let rngMatched = 0;
    let rngConsumed = 0;
    let jsRngProduced = 0;
    let screenMatched = 0;
    let cellsOnlyMatched = 0;
    let cursorsMatched = 0;
    let screenConsumed = 0;
    let jsScreensProduced = 0;
    let firstRng = null;
    let firstScreen = null;
    let jsError = null;
    let errorSegment = null;
    let totalMoves = 0;
    const countScreen = (ref, jsScreen, jsCursor) => {
        const cellsOk = screensVisuallyEqual(jsScreen || '', ref.screen || '');
        const cursorOk = cursorsEqual(ref.cursor, jsCursor);
        if (cellsOk)
            cellsOnlyMatched++;
        if (cursorOk)
            cursorsMatched++;
        if (cellsOk && cursorOk)
            screenMatched++;
        if (!firstScreen && !(cellsOk && cursorOk)) {
            firstScreen = buildFirstScreen(ref, screenConsumed, jsScreen || '', jsCursor, cellsOk, cursorOk);
        }
    };
    for (const [si, seg] of segments.entries()) {
        // Replay input carries only what launches and plays the segment;
        // expected answers (steps) never reach the engine.
        const input = {
            seed: seg.seed,
            datetime: seg.datetime,
            nethackrc: seg.nethackrc,
            moves: seg.moves ?? '',
            storage: storageHandle,
        };
        totalMoves += (input.moves || '').length;
        let game;
        try {
            game = await runSegmentImpl(input);
        }
        catch (e) {
            jsError = { message: truncText(errorMessage(e)), stack: truncStack(e instanceof Error ? e.stack : undefined), segment: si };
            errorSegment = si;
            break; // frozen runner also stops at the first segment error
        }
        // RNG — official positional flattened comparison.
        const jsRngSeg = game.rngLog.map(stripIndexPrefix).filter(isRngCall);
        jsRngProduced += jsRngSeg.length;
        for (let k = 0; k < jsRngSeg.length && rngConsumed < rngTotal; k++, rngConsumed++) {
            if (normalizeRng(itemAt(cRng, rngConsumed).e) === normalizeRng(itemAt(jsRngSeg, k)))
                rngMatched++;
        }
        // Screens + cursors — frozen combined-match semantics.
        const jsScreens = game.screens;
        const jsCursors = game.cursors;
        jsScreensProduced += jsScreens.length;
        for (let k = 0; k < jsScreens.length && screenConsumed < screenTotal; k++, screenConsumed++) {
            countScreen(itemAt(cScreens, screenConsumed), itemAt(jsScreens, k), jsCursors[k]);
        }
        // firstRng — per-input slice alignment (diagnostic only).
        if (!firstRng) {
            firstRng = locateFirstRngBySlices(game, jsRngSeg, seg, si, itemAt(cRngBase, si), segments);
        }
    }
    // Screens the JS side never produced still count as compared against
    // an empty JS screen (official loop reads jsScreens[i] || ''), with
    // no JS cursor — keep full denominators, build firstScreen for them.
    for (; screenConsumed < screenTotal; screenConsumed++) {
        countScreen(itemAt(cScreens, screenConsumed), '', undefined);
    }
    const firstDivergence = pickFirstDivergence(firstRng, firstScreen, jsError, errorSegment);
    const passed = !jsError && rngMatched === rngTotal && screenMatched === screenTotal;
    return {
        session: basename(sessionPath),
        passed,
        metrics: {
            rngCalls: { matched: rngMatched, total: rngTotal },
            screens: { matched: screenMatched, total: screenTotal },
            cellsOnly: { matched: cellsOnlyMatched, total: screenTotal },
            cursors: { matched: cursorsMatched, total: screenTotal },
        },
        // JS-side production counts (not official): produced < total means
        // the engine ran out of screens or calls before the recording did.
        produced: { rngCalls: jsRngProduced, screens: jsScreensProduced },
        firstRng,
        firstScreen,
        firstDivergence,
        error: jsError,
        segments: segments.length,
        time: { ms: +(performance.now() - t0).toFixed(2), moves: totalMoves },
        basis: 'metrics use the official positional flattened comparison '
            + '(frozen/ps_test_runner.mjs); firstRng is located by per-input '
            + 'slice alignment, which pinpoints the boundary even when shifted '
            + 'call counts make later flat positions differ',
    };
}
function buildFirstScreen(ref, globalStep, jsScreen, jsCursor, cellsOk, cursorOk) {
    const out = {
        segment: ref.si,
        step: ref.ti,
        globalStep,
        reason: cellsOk ? 'cursor' : (cursorOk ? 'cells' : 'cells+cursor'),
        cell: null,
        rows: null,
        cursors: { c: ref.cursor, js: Array.isArray(jsCursor) ? jsCursor : null },
    };
    if (!cellsOk) {
        const ga = decodeScreen(preDecode(ref.screen || ''));
        const gb = decodeScreen(preDecode(jsScreen));
        const first = findFirstCellDiff(ga, gb);
        out.cell = first && {
            row: first.row, col: first.col, kind: first.kind,
            c: cellInfo(cellAt(ga, first.row, first.col)),
            js: cellInfo(cellAt(gb, first.row, first.col)),
        };
        out.rows = neighborhoodRows(ga, gb, first ? first.row : 0);
    }
    return out;
}
// Walk C steps and JS input-boundary slices side by side. The engine
// exposes one slice per blocked input request (getRngSlices); calls made
// after the last request (game over without a final prompt) are appended
// as a tail slice so trailing C steps still line up.
function locateFirstRngBySlices(game, jsRngSeg, seg, si, segBase, segments) {
    const jsSlices = game.rngSlices.map(s => s.map(stripIndexPrefix).filter(isRngCall));
    const covered = jsSlices.reduce((n, s) => n + s.length, 0);
    if (covered < jsRngSeg.length)
        jsSlices.push(jsRngSeg.slice(covered));
    const cSlices = (seg.steps || []).map(st => extractRngCalls(st.rng));
    const boundaries = Math.max(cSlices.length, jsSlices.length);
    let consumedC = 0;
    for (let b = 0; b < boundaries; b++) {
        const cS = cSlices[b] || [];
        const jS = jsSlices[b] || [];
        const i = firstSliceDifference(cS, jS);
        if (i === null) {
            consumedC += cS.length;
            continue;
        }
        const cMissing = cS[i] === undefined;
        return {
            segment: si,
            step: b,
            index: i,
            globalIndex: segBase + consumedC + i,
            c: cMissing ? null : truncText(cS[i], 200),
            js: jS[i] !== undefined ? truncText(jS[i], 200) : null,
            caller: callerTag(cS[i]),
            // When the JS side emitted an extra call, attribute it to the
            // next recorded C call after this boundary (never the prior one).
            nextExpectedCaller: cMissing
                ? nextCallerAfter(segments, si, b, cSlices)
                : null,
            reason: i < Math.min(cS.length, jS.length) ? 'value' : 'length',
            jsBoundaryBeyondC: b >= cSlices.length,
            neighborhood: { c: neighborhood(cS, i), js: neighborhood(jS, i) },
            sliceLengths: { c: cS.length, js: jS.length },
        };
    }
    return null;
}
// First recorded C rng call strictly after boundary `b` of segment `si`:
// later steps of the same segment, then later segments.
function nextCallerAfter(segments, si, b, cSlices) {
    for (let k = b + 1; k < cSlices.length; k++) {
        const slice = itemAt(cSlices, k);
        if (slice.length)
            return callerTag(slice[0]);
    }
    for (let s = si + 1; s < segments.length; s++) {
        for (const step of itemAt(segments, s).steps || []) {
            const calls = extractRngCalls(step.rng);
            if (calls.length)
                return callerTag(calls[0]);
        }
    }
    return null;
}
// Earliest input boundary across both channels; RNG wins a tie at the
// same boundary (it fires first inside the turn).
function pickFirstDivergence(firstRng, firstScreen, jsError, errorSegment) {
    if (firstRng && (!firstScreen || firstRng.segment < firstScreen.segment
        || (firstRng.segment === firstScreen.segment && firstRng.step <= firstScreen.step))) {
        return {
            kind: 'rng',
            segment: firstRng.segment,
            step: firstRng.step,
            globalIndex: firstRng.globalIndex,
            caller: firstRng.caller ?? firstRng.nextExpectedCaller,
            reason: firstRng.reason,
        };
    }
    if (firstScreen) {
        return {
            kind: 'screen',
            segment: firstScreen.segment,
            step: firstScreen.step,
            globalStep: firstScreen.globalStep,
            caller: null, // screens carry no PRNG caller context
            reason: firstScreen.reason,
        };
    }
    if (jsError) {
        return {
            kind: 'error',
            segment: errorSegment,
            step: null,
            caller: null,
            reason: jsError.message,
        };
    }
    return null;
}
// ── CLI ──
function fatalResult(arg, message) {
    return {
        session: basename(arg),
        passed: false,
        metrics: {
            rngCalls: { matched: 0, total: 0 },
            screens: { matched: 0, total: 0 },
            cellsOnly: { matched: 0, total: 0 },
            cursors: { matched: 0, total: 0 },
        },
        produced: { rngCalls: 0, screens: 0 },
        firstRng: null,
        firstScreen: null,
        firstDivergence: { kind: 'error', segment: null, step: null, caller: null, reason: truncText(message) },
        error: { message: truncText(message), stack: null, segment: null },
        fatal: true,
    };
}
async function main() {
    const arg = process.argv[2];
    if (!arg || arg.startsWith('-') || process.argv.length > 3) {
        process.stderr.write('usage: node scripts/lib/score-session.mjs <session.json>\n');
        process.exit(2);
    }
    let emitted = false;
    const emit = (result) => {
        if (emitted)
            return;
        emitted = true;
        console.log('__RESULT_ONE__');
        console.log(JSON.stringify(result));
    };
    process.on('uncaughtException', (e) => { emit(fatalResult(arg, `uncaught: ${errorMessage(e)}`)); process.exit(1); });
    process.on('unhandledRejection', (e) => { emit(fatalResult(arg, `unhandled rejection: ${errorMessage(e)}`)); process.exit(1); });
    try {
        emit(await scoreSession(arg));
        process.exit(0);
    }
    catch (e) {
        emit(fatalResult(arg, errorMessage(e)));
        process.exit(1);
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
//# sourceMappingURL=score-session.mjs.map