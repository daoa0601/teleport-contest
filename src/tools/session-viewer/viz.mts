// viz.mjs — PS Visualizer main controller.
//
// Loads a session, drives the JS port to compute screens/cursors/rng for
// every step, and renders:
//   - two timelines (canon + js) summarizing PRNG calls per step
//   - a 24×80 map showing the JS port's screen for the current step,
//     with diff overlay vs the canonical screen
//   - cursor / message-line / rng detail
//
// All work happens up-front after loading; scrubbing is pure DOM update.

import { decodeScreen, renderCell, colorToCss, diffCell, ROWS_24, COLS_80 } from '../../frozen/screen-decode.mjs';
import type { ScreenCell, ScreenGrid } from '../../frozen/screen-decode.mjs';
import { normalizeSession } from '../../frozen/session_loader.mjs';
import { decodeSession, arrayValue, booleanValue, errorMessage, itemAt, numberValue, objectValue, stringValue } from '../../scripts/lib/session-types.mjs';
import type { Cursor, SessionSegment } from '../../scripts/lib/session-types.mjs';
import { createReplayStorage, loadReplayRunner } from '../../scripts/lib/replay-capture.mjs';
import type { ReplayRunner } from '../../scripts/lib/replay-capture.mjs';

interface Metric { matched: number; total: number }
interface Advisory { passed: boolean; rng: Metric | null; screen: Metric | null }
type ViewMode = 'canon' | 'js' | 'diff';
interface ScreenDiff { char: boolean; attr: boolean; cursor: boolean }
interface ViewedStep {
    key: string | null;
    canonScreen: string;
    canonCursor: Cursor | null;
    canonRng: string[];
    jsScreen: string;
    jsCursor: Cursor | null;
    jsRng: string[];
    _diff?: ScreenDiff;
}
interface ViewedSegment { seg: SessionSegment; steps: ViewedStep[] }
interface ViewerState { name: string; segments: ViewedSegment[] }
interface AlignedCall { canon: string | null; js: string | null }
interface StepRange { start: number; end: number; segIdx: number; stepInSeg: number; callCount: number; xFrac0: number; xFrac1: number }
interface AlignedState { calls: AlignedCall[]; stepRanges: StepRange[] }
type CallStatus = 'match' | 'diff' | 'canon_only' | 'js_only' | 'empty';

function element<T extends HTMLElement>(selector: string, type: { new(): T }): T {
    const found = document.querySelector(selector);
    if (!(found instanceof type)) throw new Error(`Viewer requires ${selector} to be a ${type.name}`);
    return found;
}
function cellAt(grid: ScreenGrid, row: number, column: number): ScreenCell {
    return itemAt(itemAt(grid, row), column);
}
function cursorsMatch(recorded: Cursor | null, actual: Cursor | null): boolean {
    if (!recorded) return true;
    return actual !== null && recorded[0] === actual[0] && recorded[1] === actual[1]
        && recorded[2] === actual[2];
}
function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Viewer requires a 2D canvas context');
    return context;
}
function advisoryMetric(value: unknown): Metric | null {
    if (value == null) return null;
    const metric = objectValue(value, 'result metric');
    return { matched: numberValue(metric.matched, 'metric matched'), total: numberValue(metric.total, 'metric total') };
}

const $ = (selector: string): HTMLElement => element(selector, HTMLElement);
const status = (msg: string, cls = ''): void => {
    const el = $('#status');
    el.textContent = msg;
    el.className = cls;
};

// --- Hash state -----------------------------------------------------------
// Persist UI state in location.hash (#session=NAME&step=N) so a refresh
// or a copy-paste link lands on the same session and step. The session
// part matches a substring of the dropdown's display name (so the user
// can write "#session=4500" and it picks up "seed4500-knight-...").
function readHash() {
    const out: Record<string, string> = {};
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return out;
    for (const part of h.split('&')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const k = decodeURIComponent(part.slice(0, eq));
        const v = decodeURIComponent(part.slice(eq + 1));
        out[k] = v;
    }
    return out;
}
function writeHash({ session, step, view }: { session: string | null; step: number; view: ViewMode }): void {
    const parts = [];
    if (session) parts.push(`session=${encodeURIComponent(session)}`);
    if (typeof step === 'number') parts.push(`step=${step}`);
    if (view && view !== 'js') parts.push(`view=${view}`);
    const next = '#' + parts.join('&');
    if (next !== location.hash) {
        // Use replaceState so we don't pollute history with every step click.
        history.replaceState(null, '', next || ' ');
    }
}

// View modes:
//   canon — show the canonical screen, highlighting cells where JS differs
//   js    — show the JS port's screen, highlighting cells where canon differs
//   diff  — overlay both: show whichever side is informative, color the diff
function isViewMode(value: unknown): value is ViewMode {
    return value === 'canon' || value === 'js' || value === 'diff';
}
let CURRENT_VIEW: ViewMode = 'js';
function setView(v: unknown, { rerender = true } = {}): void {
    if (!isViewMode(v)) return;
    CURRENT_VIEW = v;
    document.querySelectorAll<HTMLButtonElement>('#view-modes button').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === v);
    });
    writeHash({ session: currentSessionShort(), step: currentStep(), view: v });
    if (rerender && CURRENT_ALIGNED) render(currentStep());
}
function currentStep() {
    const ro = $('#step-readout');
    return parseInt(ro.dataset.step || '0', 10);
}
function currentSessionShort() {
    return CURRENT?.name?.replace(/\.session\.json$/, '') || null;
}

// --- Session list -------------------------------------------------------
async function listSessions(): Promise<string[]> {
    // Try a manifest.json first (zero filesystem listing on a static server).
    // Fall back to a directory listing, with a file picker for static hosts.
    try {
        const r = await fetch('../../sessions/manifest.json', { cache: 'no-store' });
        if (r.ok) {
            const data: unknown = await r.json();
            return arrayValue(data, 'session manifest').map(name => stringValue(name, 'session filename'));
        }
    } catch {}
    try {
        const r = await fetch('../../sessions/', { cache: 'no-store' });
        if (r.ok) {
            const html = await r.text();
            const matches = [...html.matchAll(/href="([^"?]*\.session\.json)"/g)]
                .map((m) => decodeURIComponent(m[1] ?? ''))
                .filter((n) => !n.startsWith('/') && !n.includes('/'));
            if (matches.length) return matches;
        }
    } catch {}
    return [];
}

// Optional advisory: a session-results bundle written by whatever local
// runner the user has (the maud-side `scripts/pes-report.mjs`, or the
// contest-side equivalent). Lives at `.cache/session-results.json`,
// which is gitignored. If present we surface pass/fail in the picker.
async function loadResultsAdvisory(): Promise<Map<string, Advisory> | null> {
    for (const url of ['/.cache/session-results.json', '../../.cache/session-results.json']) {
        try {
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) continue;
            const data: unknown = await r.json();
            const bundle = objectValue(data, 'results advisory');
            const map = new Map<string, Advisory>();
            for (const value of arrayValue(bundle.results ?? bundle.sessions ?? [], 'advisory results')) {
                const s = objectValue(value, 'advisory result');
                // Tolerate three bundle shapes:
                //   - maud pes-report: { session, metrics: { rngCalls, screens } }
                //   - judge:           { name,    rng, screen }
                //   - contest ps:      { sessionFile, prng, screen }
                const name = stringValue(s.session ?? s.sessionFile ?? s.name, 'advisory session name');
                if (!name) continue;
                const metrics = s.metrics == null ? null : objectValue(s.metrics, 'advisory metrics');
                const rng = advisoryMetric(metrics?.rngCalls ?? s.rng ?? s.prng);
                const screen = advisoryMetric(metrics?.screens ?? s.screen);
                map.set(name.split('/').pop() ?? name, { passed: booleanValue(s.passed, 'advisory passed'), rng, screen });
            }
            return map;
        } catch {}
    }
    return null;
}

function resultGlyph(s: Advisory | undefined): string {
    if (!s) return '·';
    if (s.passed) return '✓';
    return '✗';
}
function resultTitle(s: Advisory | undefined, name: string): string {
    if (!s) return `${name} — no recorded result`;
    const fmt = (x: Metric | null): string => x ? `${x.matched}/${x.total}` : '?';
    const status = s.passed ? 'pass' : 'fail';
    return `${name} — ${status} · RNG ${fmt(s.rng)} · Screen ${fmt(s.screen)}`;
}

const select = element('#session-select', HTMLSelectElement);
Promise.all([listSessions(), loadResultsAdvisory()]).then(([names, statusMap]) => {
    for (const n of names) {
        const opt = document.createElement('option');
        opt.value = '../../sessions/' + n;
        const status = statusMap?.get(n);
        opt.textContent = `${resultGlyph(status)}  ${n}`;
        if (status) {
            opt.title = resultTitle(status, n);
            opt.dataset.result = status.passed ? 'pass' : 'fail';
        }
        select.appendChild(opt);
    }
    if (!names.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(no manifest — use file picker)';
        opt.disabled = true;
        select.appendChild(opt);
    }
    // After the dropdown is populated, honor #session=… from the URL.
    const hash = readHash();
    const hashSession = hash.session;
    if (hashSession) {
        const opt = [...select.options].find((o) =>
            (o.textContent ?? '').includes(hashSession));
        if (opt) {
            select.value = opt.value;
            void loadFromUrl(opt.value);
        }
    }
}).catch(error => status(`failed to list sessions: ${errorMessage(error)}`, 'error'));

// React to hash changes from back/forward or manual edits.
window.addEventListener('hashchange', () => {
    const h = readHash();
    const hashSession = h.session;
    if (hashSession) {
        const opt = [...select.options].find((o) =>
            (o.textContent ?? '').includes(hashSession));
        if (opt && opt.value !== select.value) {
            select.value = opt.value;
            void loadFromUrl(opt.value);
            return;
        }
    }
    if (h.view && h.view !== CURRENT_VIEW && isViewMode(h.view)) {
        setView(h.view, { rerender: false });
    }
    if (CURRENT_ALIGNED && h.step != null) {
        const total = totalSteps();
        const step = Math.max(0, Math.min(total - 1, parseInt(h.step, 10) || 0));
        render(step);
    }
});

select.addEventListener('change', () => {
    if (select.value) void loadFromUrl(select.value);
    // Drop focus so the dropdown doesn't eat arrow-key navigation.
    select.blur();
});
const fileInput = element('#session-file', HTMLInputElement);
fileInput.addEventListener('change', () => { void loadFromFile(); });
async function loadFromFile(): Promise<void> {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
        const data: unknown = JSON.parse(await file.text());
        select.value = '';
        await loadAndCompute(data, file.name);
    } catch (error) {
        status(`failed to load: ${errorMessage(error)}`, 'error');
    }
}

// --- Loading + compute --------------------------------------------------
let CURRENT: ViewerState | null = null;

async function loadFromUrl(url: string): Promise<void> {
    status(`loading ${url} …`);
    try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: unknown = await r.json();
        await loadAndCompute(data, url.split('/').pop() ?? url);
    } catch (err) {
        status(`failed to load: ${errorMessage(err)}`, 'error');
    }
}

async function loadAndCompute(data: unknown, name: string): Promise<void> {
    const sessionData = decodeSession(normalizeSession(data));
    status(`running JS port on ${name} …`);
    // Default JS port lives at ../../js/jsmain.js (the contest skeleton).
    // Override via ?js=<url> for ad-hoc testing against a different port.
    const jsUrl = new URLSearchParams(location.search).get('js') || '../../js/jsmain.js';
    let runSegment: ReplayRunner;
    try {
        runSegment = await loadReplayRunner(new URL(jsUrl, import.meta.url).href);
    } catch (err) {
        status(`could not import ${jsUrl}: ${errorMessage(err)}`, 'error');
        return;
    }

    const segments: ViewedSegment[] = [];
    const storage = createReplayStorage();
    for (const [s, seg] of sessionData.segments.entries()) {
        const input = {
            seed: seg.seed,
            datetime: seg.datetime,
            nethackrc: seg.nethackrc,
            moves: seg.moves ?? '',
            storage,
        };
        let game;
        try {
            game = await runSegment(input);
        } catch (err) {
            status(`seg ${s}: JS port threw: ${errorMessage(err)}`, 'error');
            return;
        }
        const stepsOut: ViewedStep[] = [];
        for (const [i, canonStep] of (seg.steps ?? []).entries()) {
            stepsOut.push({
                key: canonStep.key,
                canonScreen: canonStep.screen || '',
                canonCursor: canonStep.cursor ?? null,
                canonRng: canonStep.rng || [],
                jsScreen: game.screens[i] || '',
                jsCursor: game.cursors[i] ?? null,
                jsRng: game.rngSlices[i] || [],
            });
        }
        segments.push({ seg, steps: stepsOut });
    }

    CURRENT = { name, segments };
    classifyScreenDiffs();
    initUI();
    status(buildStatusSummary(name), 'ok');
}

// Walk every step once and classify its screen diff into three independent
// bits: charDiff (any cell where the rendered glyph differs), attrDiff
// (matching glyph, different color/attr) and cursorDiff (recorded cursor
// position or visibility disagrees). The timeline screen-strip stacks these into colored bands.
function classifyScreenDiffs(): void {
    if (!CURRENT) return;
    for (const seg of CURRENT.segments) {
        for (const st of seg.steps) {
            const c = decodeScreen(st.canonScreen);
            const j = decodeScreen(st.jsScreen);
            let charDiff = false, attrDiff = false;
            for (let r = 0; r < ROWS_24 && !(charDiff && attrDiff); r++) {
                for (let col = 0; col < COLS_80; col++) {
                    const d = diffCell(cellAt(c, r, col), cellAt(j, r, col));
                    if (d === 'ch')   { charDiff = true; }
                    else if (d === 'attr') { attrDiff = true; }
                    if (charDiff && attrDiff) break;
                }
            }
            const cursorDiff = !cursorsMatch(st.canonCursor, st.jsCursor);
            st._diff = { char: charDiff, attr: attrDiff, cursor: cursorDiff };
        }
    }
}

function buildStatusSummary(name: string): string {
    if (!CURRENT) return `${name} — no session loaded`;
    let prngMatch = 0, prngTotal = 0;
    let screenMatch = 0, screenTotal = 0;
    for (const s of CURRENT.segments) {
        for (const st of s.steps) {
            const ap = filterPrng(st.canonRng), bp = filterPrng(st.jsRng);
            const m = Math.min(ap.length, bp.length);
            for (let i = 0; i < m; i++) if (callKey(ap[i]) === callKey(bp[i])) prngMatch++;
            prngTotal += Math.max(ap.length, bp.length);
            screenTotal++;
            // Count the same visual and cursor differences shown in the timeline.
            const d = st._diff;
            if (d && !d.char && !d.attr && !d.cursor) screenMatch++;
        }
    }
    return `${name} — ${totalSteps()} steps · `
        + `PRNG ${prngMatch}/${prngTotal}`
        + ` · screens ${screenMatch}/${screenTotal}`;
}

function totalSteps(): number {
    return CURRENT?.segments.reduce((n, s) => n + s.steps.length, 0) ?? 0;
}

// --- Flat indexing across segments --------------------------------------
function flatStep(idx: number) {
    if (!CURRENT) return null;
    let acc = 0;
    for (const s of CURRENT.segments) {
        if (idx < acc + s.steps.length)
            return { seg: s, step: itemAt(s.steps, idx - acc), segIdx: CURRENT.segments.indexOf(s), stepInSeg: idx - acc };
        acc += s.steps.length;
    }
    return null;
}

// --- UI initialization --------------------------------------------------
function initUI() {
    buildFlatAligned();
    syncCanvasSize();
    installResizeHandler();
    installKeyboardNav();
    wireTimelineClicks();
    wireViewModeButtons();
    // Honor #view=NAME from the URL (default 'js').
    const hash = readHash();
    if (hash.view && isViewMode(hash.view)) {
        setView(hash.view, { rerender: false });
    } else {
        setView('js', { rerender: false });
    }
    // Honor #step=N from the URL on first render; otherwise start at 0.
    const total = totalSteps();
    const initialStep = hash.step != null
        ? Math.max(0, Math.min(total - 1, parseInt(hash.step, 10) || 0))
        : 0;
    render(initialStep);
}

let _viewButtonsInstalled = false;
function wireViewModeButtons() {
    if (_viewButtonsInstalled) return;
    _viewButtonsInstalled = true;
    document.querySelectorAll<HTMLButtonElement>('#view-modes button').forEach((btn) => {
        btn.addEventListener('click', () => {
            setView(btn.dataset.view);
            // Don't keep keyboard focus on the button — arrow keys belong
            // to the timeline.
            btn.blur();
        });
    });
}

// --- Aligned per-call flat list -----------------------------------------
// CURRENT_ALIGNED:
//   calls: [{ canon: string|null, js: string|null }, ...]   one per slot
//   stepRanges: [{ start, end, segIdx, stepInSeg }]         per step boundary
//   stepBoundaries: indices in `calls` where each step starts
let CURRENT_ALIGNED: AlignedState | null = null;

function buildFlatAligned(): void {
    if (!CURRENT) return;
    const calls: AlignedCall[] = [];
    const stepRanges: StepRange[] = [];
    let acc = 0;
    for (const [s, seg] of CURRENT.segments.entries()) {
        for (const [i, st] of seg.steps.entries()) {
            const ap = filterPrng(st.canonRng);
            const bp = filterPrng(st.jsRng);
            const max = Math.max(ap.length, bp.length);
            for (let k = 0; k < max; k++) {
                calls.push({ canon: ap[k] ?? null, js: bp[k] ?? null });
            }
            stepRanges.push({
                start: acc, end: acc + max,
                segIdx: s, stepInSeg: i,
                callCount: max, xFrac0: 0, xFrac1: 0,
            });
            acc += max;
        }
    }
    CURRENT_ALIGNED = { calls, stepRanges };
    computeStepWidths();
}

// Non-uniform x-axis: each step's width is sqrt(calls+1)-scaled, then
// capped at MAX_STEP_FRACTION of the total. Caps redistribute their
// trimmed area proportionally to non-capped steps. The cap ensures one
// pathological step (e.g. seed8000's chargen with ~3000 PRNG calls)
// doesn't crowd out all the other steps; sqrt keeps a "denser steps
// look denser" signal under the cap.
const MAX_STEP_FRACTION = 0.25;
function computeStepWidths(): void {
    if (!CURRENT_ALIGNED) return;
    const ranges = CURRENT_ALIGNED.stepRanges;
    let widths = ranges.map((sr) => Math.sqrt(sr.callCount + 1));
    let sum = widths.reduce((a, b) => a + b, 0) || 1;
    widths = widths.map((w) => w / sum);
    // Iterative cap + redistribute.
    for (let pass = 0; pass < 20; pass++) {
        let overage = 0;
        const capped: boolean[] = Array.from({ length: widths.length }, () => false);
        for (let i = 0; i < widths.length; i++) {
            if (itemAt(widths, i) > MAX_STEP_FRACTION) {
                overage += itemAt(widths, i) - MAX_STEP_FRACTION;
                widths[i] = MAX_STEP_FRACTION;
                capped[i] = true;
            }
        }
        if (overage <= 1e-9) break;
        const uncappedSum = widths.reduce((a, w, i) => a + (capped[i] ? 0 : w), 0);
        if (uncappedSum <= 0) break;
        for (let i = 0; i < widths.length; i++) {
            if (!capped[i]) {
                const width = itemAt(widths, i);
                widths[i] = width + (width / uncappedSum) * overage;
            }
        }
    }
    // Cumulative fractions → pixel positions resolved at draw time.
    let cum = 0;
    for (let i = 0; i < ranges.length; i++) {
        const range = itemAt(ranges, i);
        range.xFrac0 = cum;
        cum += itemAt(widths, i);
        range.xFrac1 = cum;
    }
}

function filterPrng(rng: readonly string[]): string[] {
    const out = [];
    for (const e of rng || []) {
        if (typeof e !== 'string') continue;
        if (e[0] === '<' || e[0] === '>' || e[0] === '^') continue;
        out.push(e);
    }
    return out;
}

// --- Timeline rendering -------------------------------------------------
//
// Each canvas pixel-column maps to a contiguous range of PRNG call slots:
//
//   slot_lo = floor(x       * N / W)
//   slot_hi = floor((x + 1) * N / W)
//
// where N = CURRENT_ALIGNED.calls.length and W = canvas pixel width.
// When N ≤ W, each slot gets ⌈W/N⌉ pixels; when N > W, each pixel
// aggregates up to N/W consecutive slots.
//
// For each pixel/range we draw two stacked bars (canon-row + js-row),
// at the SAME x — so a divergence at slot k shows up at the same x in
// both rows. Bar height = log2 of the bound (e.g. rn2(100) → log2(101)),
// color = per-slot match status (green=match, red=value diff,
// orange=canon-only, blue=js-only).

// Resolve the parchment-theme CSS custom properties so JS-side canvas
// drawing matches the DOM theme. Falls back to literals if the variable
// hasn't been parsed yet (e.g. test environments without the stylesheet).
const _root = (typeof document !== 'undefined') ? getComputedStyle(document.documentElement) : null;
const cssVar = (name: string, fallback: string): string => {
    const v = _root?.getPropertyValue(name)?.trim();
    return v || fallback;
};
const COLOR_MATCH      = cssVar('--tl-match',      '#6b5a40');
const COLOR_DIFF       = cssVar('--tl-diff',       '#c0392b');
const COLOR_CANON_ONLY = cssVar('--tl-canon-only', '#b8651b');   // canon has a call, js doesn't
const COLOR_JS_ONLY    = cssVar('--tl-js-only',    '#7b3fa3');   // js has a call, canon doesn't
const COLOR_DIFF_CHAR   = cssVar('--diff-char',   '#c0392b');
const COLOR_DIFF_ATTR   = cssVar('--diff-attr',   '#b8860b');
const COLOR_DIFF_CURSOR = cssVar('--diff-cursor', '#2563eb');
const COLOR_BG_OK      = cssVar('--tl-step-ok',   'rgba(196, 168, 130, 0.18)');
const COLOR_BG_DIFF    = cssVar('--tl-step-diff', 'rgba(192, 57, 43, 0.10)');
const COLOR_INACTIVE   = cssVar('--tl-inactive',  'rgba(0, 0, 0, 0.05)');  // bar slot when this side has no call
const COLOR_GRID       = cssVar('--tl-grid',      'rgba(0, 0, 0, 0.10)');

function callBound(call: string | null | undefined): number {
    if (!call) return 1;
    const m = /^\w+\((\d+)/.exec(call);
    return m ? parseInt(m[1] ?? '1', 10) : 1;
}
function callHeight(call: string | null | undefined): number {
    return Math.log2(Math.max(2, callBound(call) + 1));
}
// Compare ONLY the call + result, not the optional `@ source.c:line`
// annotation. The C recorder emits "rn2(N)=V @ fn(file:line)"; the JS
// port may emit just "rn2(N)=V" or include its own annotation. Either
// is fine — what matters for parity is the call name, bound, and
// drawn value.
function callKey(call: string | null | undefined): string | null {
    if (!call) return null;
    const at = call.indexOf(' @ ');
    return at < 0 ? call : call.slice(0, at);
}
function callStatus(c: AlignedCall): CallStatus {
    if (c.canon && c.js)  return callKey(c.canon) === callKey(c.js) ? 'match' : 'diff';
    if (c.canon && !c.js) return 'canon_only';
    if (c.js && !c.canon) return 'js_only';
    return 'empty';
}
function colorForStatus(status: CallStatus | null, side: 'js' | 'canon'): string {
    switch (status) {
        case 'match':      return COLOR_MATCH;
        case 'diff':       return COLOR_DIFF;
        case 'canon_only': return side === 'js' ? COLOR_INACTIVE : COLOR_CANON_ONLY;
        case 'js_only':    return side === 'js' ? COLOR_JS_ONLY : COLOR_INACTIVE;
        case 'empty':
        case null:         return COLOR_INACTIVE;
    }
}

// Single-canvas layout. All three rows share the same x mapping so they
// align perfectly. Labels are drawn into the canvas itself.
const ROW_LABEL_W = 56;       // left gutter for labels
const ROW_CANON_Y0 = 0;
const ROW_CANON_H = 54;
const ROW_GAP = 2;
const ROW_JS_Y0  = ROW_CANON_Y0 + ROW_CANON_H + ROW_GAP;
const ROW_JS_H   = 54;
const ROW_SCREEN_Y0 = ROW_JS_Y0 + ROW_JS_H + ROW_GAP;
const ROW_SCREEN_H  = 14;     // 3-way stack works at ~4-5px per band
const TIMELINE_H    = ROW_SCREEN_Y0 + ROW_SCREEN_H;

function fracToX(frac: number): number {
    const cv = element('#timeline', HTMLCanvasElement);
    const dataX0 = ROW_LABEL_W;
    const dataW  = cv.width - ROW_LABEL_W;
    return dataX0 + Math.round(frac * dataW);
}

function drawTimelines(): void {
    if (!CURRENT_ALIGNED || !CURRENT) return;
    const cv = element('#timeline', HTMLCanvasElement);
    const W = cv.width;
    const H = cv.height;
    const ctx = canvasContext(cv);
    ctx.clearRect(0, 0, W, H);

    const calls = CURRENT_ALIGNED.calls;
    const ranges = CURRENT_ALIGNED.stepRanges;
    const dataX0 = ROW_LABEL_W;
    const dataW  = W - ROW_LABEL_W;
    const maxBound = calls.reduce((m, c) => Math.max(m, callBound(c.canon), callBound(c.js)), 1);
    const maxHeight = Math.log2(Math.max(2, maxBound + 1));

    const drawBar = (y0: number, h: number, x: number, w: number, height01: number, color: string): void => {
        const barH = Math.max(2, Math.round((h - 4) * height01));
        ctx.fillStyle = color;
        ctx.fillRect(x, y0 + h - barH, Math.max(1, w), barH);
    };

    // Background row tints — very faint dark wash on the parchment canvas
    // to delineate rows without drawing borders.
    ctx.fillStyle = 'rgba(0,0,0,0.025)';
    ctx.fillRect(dataX0, ROW_CANON_Y0, dataW, ROW_CANON_H);
    ctx.fillRect(dataX0, ROW_JS_Y0,    dataW, ROW_JS_H);

    // Render each step into its own pixel range. Within a step, calls
    // are spread evenly across [x0, x1); when there are more calls than
    // pixels we aggregate, and when there are more pixels than calls
    // each call gets ⌈stepW / callCount⌉ pixels of width.
    for (const sr of ranges) {
        const x0 = fracToX(sr.xFrac0);
        const x1 = Math.max(x0 + 1, fracToX(sr.xFrac1));
        const stepW = x1 - x0;
        const callsHere = sr.callCount;

        // Step background: green-tint if every call matches, red-tint if any diff.
        let stepHasDiff = false;
        for (let k = sr.start; k < sr.end; k++) {
            if (callStatus(itemAt(calls, k)) !== 'match') { stepHasDiff = true; break; }
        }
        const bg = stepHasDiff ? COLOR_BG_DIFF : COLOR_BG_OK;
        ctx.fillStyle = bg;
        ctx.fillRect(x0, ROW_CANON_Y0, stepW, ROW_CANON_H);
        ctx.fillRect(x0, ROW_JS_Y0,    stepW, ROW_JS_H);

        if (callsHere === 0) continue;

        // For each pixel column inside this step, aggregate the calls
        // it covers.
        for (let xi = 0; xi < stepW; xi++) {
            const x = x0 + xi;
            const callLo = sr.start + Math.floor((xi * callsHere) / stepW);
            const callHi = Math.max(callLo + 1, sr.start + Math.floor(((xi + 1) * callsHere) / stepW));
            let canonH = 0, jsH = 0;
            let canonStatus: CallStatus | null = null, jsStatus: CallStatus | null = null;
            for (let k = callLo; k < callHi && k < sr.end; k++) {
                const c = itemAt(calls, k);
                canonH = Math.max(canonH, callHeight(c.canon));
                jsH    = Math.max(jsH,    callHeight(c.js));
                const st = callStatus(c);
                if (st === 'match') {
                    canonStatus = canonStatus || 'match';
                    jsStatus    = jsStatus    || 'match';
                } else if (st === 'diff') {
                    canonStatus = 'diff'; jsStatus = 'diff';
                } else if (st === 'canon_only') {
                    canonStatus = 'canon_only';
                    if (!jsStatus) jsStatus = 'canon_only';
                } else if (st === 'js_only') {
                    jsStatus = 'js_only';
                    if (!canonStatus) canonStatus = 'js_only';
                }
            }
            if (canonH > 0) drawBar(ROW_CANON_Y0, ROW_CANON_H, x, 1, canonH / maxHeight, colorForStatus(canonStatus, 'canon'));
            if (jsH > 0)    drawBar(ROW_JS_Y0,    ROW_JS_H,    x, 1, jsH    / maxHeight, colorForStatus(jsStatus,    'js'));
        }
    }

    // Step boundaries — faint verticals across canon + js rows.
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    for (let i = 1; i < ranges.length; i++) {
        const x = fracToX(itemAt(ranges, i).xFrac0) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, ROW_CANON_Y0);
        ctx.lineTo(x, ROW_JS_Y0 + ROW_JS_H);
        ctx.stroke();
    }
    // Segment boundaries — a bold dark-brown bar spanning the full
    // timeline. Multi-game / save+restore sessions read at a glance.
    ctx.fillStyle = '#3a2818';
    let prevSeg = -1;
    for (const sr of ranges) {
        if (sr.segIdx !== prevSeg && sr.xFrac0 > 0) {
            const x = fracToX(sr.xFrac0);
            ctx.fillRect(x - 2, ROW_CANON_Y0, 4, ROW_SCREEN_Y0 + ROW_SCREEN_H);
        }
        prevSeg = sr.segIdx;
    }

    // Screen-match strip. Each step gets a column subdivided into one band
    // per active diff type (char / attr / cursor), in that vertical order.
    // Steps with no diff fill the strip with the muted "match" color so the
    // user gets a quiet baseline that the colored bands stand out against.
    for (const sr of ranges) {
        const x0 = fracToX(sr.xFrac0);
        const x1 = Math.max(x0 + 1, fracToX(sr.xFrac1));
        const w = x1 - x0;
        const seg = itemAt(CURRENT.segments, sr.segIdx);
        const st = itemAt(seg.steps, sr.stepInSeg);
        const d = st._diff || { char: false, attr: false, cursor: false };
        const bands = [];
        if (d.char)   bands.push(COLOR_DIFF_CHAR);
        if (d.attr)   bands.push(COLOR_DIFF_ATTR);
        if (d.cursor) bands.push(COLOR_DIFF_CURSOR);
        if (bands.length === 0) {
            ctx.fillStyle = COLOR_MATCH;
            ctx.fillRect(x0, ROW_SCREEN_Y0, w, ROW_SCREEN_H);
        } else {
            const bandH = ROW_SCREEN_H / bands.length;
            for (let i = 0; i < bands.length; i++) {
                ctx.fillStyle = itemAt(bands, i);
                const y = ROW_SCREEN_Y0 + Math.round(i * bandH);
                const yEnd = ROW_SCREEN_Y0 + Math.round((i + 1) * bandH);
                ctx.fillRect(x0, y, w, yEnd - y);
            }
        }
    }

    // (Row labels live as DOM elements over the gutter — see #timeline-wrap
    // .row-labels in index.html — so they stay sharp regardless of how the
    // canvas is CSS-scaled.)
}

// Match canvas internal width to its display width so per-pixel timeline
// detail isn't blurred by CSS scaling. Re-runs on resize.
function syncCanvasSize() {
    const cv = element('#timeline', HTMLCanvasElement);
    const desired = Math.max(400, Math.floor(cv.clientWidth || cv.offsetWidth));
    if (cv.width !== desired) cv.width = desired;
}
let _resizeObs: ResizeObserver | null = null;
function installResizeHandler() {
    if (_resizeObs) return;
    _resizeObs = new ResizeObserver(() => {
        syncCanvasSize();
        if (CURRENT_ALIGNED) {
            // Re-render with new pixel width.
            const step = parseInt($('#step-readout').dataset.step || '0', 10);
            render(step);
        }
    });
    _resizeObs.observe($('#timeline'));
}

function drawStepCursor(stepIdx: number): void {
    if (!CURRENT_ALIGNED) return;
    const sr = CURRENT_ALIGNED.stepRanges[stepIdx];
    if (!sr) return;
    const cv = element('#timeline', HTMLCanvasElement);
    const x0 = fracToX(sr.xFrac0);
    const x1 = Math.max(x0 + 2, fracToX(sr.xFrac1));
    const ctx = canvasContext(cv);
    ctx.save();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
    ctx.fillRect(x0, 0, x1 - x0, TIMELINE_H);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
    ctx.fillRect(x0, 0, 2, TIMELINE_H);
    ctx.fillRect(x1 - 2, 0, 2, TIMELINE_H);
    ctx.restore();
}

// Click + drag handler; installed once at module load and re-resolves
// state (CURRENT_ALIGNED, totalSteps()) per-event. Earlier we registered
// it inside wireTimelineClicks() per session-load, which piled up stale
// listeners that clamped using the previous session's step count.
let _clickHandlerInstalled = false;
function wireTimelineClicks() {
    if (_clickHandlerInstalled) return;
    _clickHandlerInstalled = true;
    const cv = element('#timeline', HTMLCanvasElement);
    const onClick = (ev: MouseEvent): void => {
        if (!CURRENT_ALIGNED) return;
        const rect = cv.getBoundingClientRect();
        const cssToCanvas = cv.width / rect.width;
        const cx = (ev.clientX - rect.left) * cssToCanvas;
        const dataX0 = ROW_LABEL_W;
        const dataW  = cv.width - ROW_LABEL_W;
        const frac = Math.max(0, Math.min(1, (cx - dataX0) / dataW));
        let step = 0;
        for (let i = 0; i < CURRENT_ALIGNED.stepRanges.length; i++) {
            const sr = itemAt(CURRENT_ALIGNED.stepRanges, i);
            if (frac < sr.xFrac1) { step = i; break; }
            step = i;
        }
        step = Math.max(0, Math.min(totalSteps() - 1, step));
        render(step);
    };
    cv.addEventListener('mousedown', (ev) => {
        onClick(ev);
        const move = (e: MouseEvent) => onClick(e);
        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
}

// Keyboard navigation lives at module scope — registered once at load
// so re-loading a session with a different step count doesn't pile up
// stale listeners that clamp using an old total.
let _keyHandlerInstalled = false;
function installKeyboardNav() {
    if (_keyHandlerInstalled) return;
    _keyHandlerInstalled = true;
    document.addEventListener('keydown', (ev) => {
        if (!CURRENT_ALIGNED) return;
        if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
        const total = totalSteps();   // resolved fresh per keypress
        let cur = parseInt($('#step-readout').dataset.step || '0', 10);
        const stride = ev.shiftKey ? 10 : 1;
        if (ev.key === 'ArrowLeft')  cur = Math.max(0, cur - stride);
        else if (ev.key === 'ArrowRight') cur = Math.min(total - 1, cur + stride);
        else return;
        ev.preventDefault();
        render(cur);
    });
}

// --- Map render ---------------------------------------------------------
function render(stepIdx: number): void {
    const total = totalSteps();
    if (!CURRENT || stepIdx < 0 || stepIdx >= total) return;
    const where = flatStep(stepIdx);
    if (!where) return;
    const readout = $('#step-readout');
    // The hint segment stays together as one nowrap unit so it can't
    // break "←/→" away from "to navigate" when the chrome is narrow.
    readout.innerHTML =
        `step ${stepIdx + 1} / ${total}  (seg ${where.segIdx})  · `
        + `<span class="nowrap">←/→ to navigate</span>`;
    readout.dataset.step = String(stepIdx);
    writeHash({ session: currentSessionShort(), step: stepIdx, view: CURRENT_VIEW });
    // Re-render timelines (clears the previous cursor highlight) then draw
    // the new step cursor on top.
    drawTimelines();
    drawStepCursor(stepIdx);

    const st = where.step;
    const canon = decodeScreen(st.canonScreen);
    const js = decodeScreen(st.jsScreen);

    const grid = $('#map-grid');
    grid.innerHTML = '';
    const ccx = st.canonCursor?.[0] ?? null, ccy = st.canonCursor?.[1] ?? null;
    const jcx = st.jsCursor?.[0] ?? null, jcy = st.jsCursor?.[1] ?? null;
    for (let r = 0; r < ROWS_24; r++) {
        const row = document.createElement('span');
        row.className = 'map-row';
        for (let c = 0; c < COLS_80; c++) {
            const jc = cellAt(js, r, c);
            const cc = cellAt(canon, r, c);
            const d = diffCell(cc, jc);
            const jsRender = renderCell(jc);
            const canonRender = renderCell(cc);
            const span = document.createElement('span');
            span.className = 'map-cell';

            // Choose which side to draw and whether to overlay the diff.
            // canon mode: canonical recording, with diff overlay so you
            //             can see WHERE the JS port diverges
            // js mode:    pure JS port, also with diff overlay
            // diff mode:  overlay — show whichever side is informative
            let cell, text, mark = null;
            if (CURRENT_VIEW === 'canon') {
                cell = cc; text = canonRender;
                if (d === 'ch')   mark = 'ch';
                else if (d === 'attr') mark = 'attr';
            } else if (CURRENT_VIEW === 'js') {
                cell = jc; text = jsRender;
                if (d === 'ch')   mark = 'ch';
                else if (d === 'attr') mark = 'attr';
            } else {
                // diff overlay (the original behavior): for char-diffs where
                // JS rendered whitespace, surface the CANON char so the user
                // can see what's missing.
                const showCanon = (d === 'ch' && (jsRender === ' ' || jsRender === ''));
                cell = showCanon ? cc : jc;
                text = showCanon ? canonRender : jsRender;
                if (d === 'ch')   mark = 'ch';
                else if (d === 'attr') mark = 'attr';
            }

            span.textContent = text || ' ';
            span.style.color = colorToCss(cell.color);
            if (cell.attr & 2) span.style.fontWeight = 'bold';
            if (cell.attr & 1) {
                span.style.background = colorToCss(cell.color);
                span.style.color = '#000';
            }
            if (mark === 'ch') {
                span.classList.add('ch-diff');
                span.title = `expected '${canonRender}', js produced '${jsRender}'`;
            } else if (mark === 'attr') {
                span.classList.add('attr-diff');
                span.title = `attr/color differs: canon=${cc.color}/${cc.attr} js=${jc.color}/${jc.attr}`;
            }

            // Cursor highlight. In every mode we anchor on the side
            // being drawn but also mark the OTHER side's cursor when it
            // differs, so the user can see the JS divergence even while
            // looking at canon.
            const isCanonCursor = Boolean(st.canonCursor?.[2]) && c === ccx && r === ccy;
            const isJsCursor = Boolean(st.jsCursor?.[2]) && c === jcx && r === jcy;
            if (CURRENT_VIEW === 'canon') {
                if (isCanonCursor) span.classList.add('cursor-canon');
                if (isJsCursor && !isCanonCursor) {
                    span.classList.add('cursor-js');
                    span.classList.add('cursor-diff');
                }
            } else if (CURRENT_VIEW === 'js') {
                if (isJsCursor) span.classList.add('cursor-js');
                if (isCanonCursor && !isJsCursor) {
                    span.classList.add('cursor-canon');
                    span.classList.add('cursor-diff');
                }
            } else {
                if (isCanonCursor && !isJsCursor) span.classList.add('cursor-canon');
                if (isJsCursor && !isCanonCursor) span.classList.add('cursor-js');
                if (isCanonCursor !== isJsCursor) span.classList.add('cursor-diff');
            }
            row.appendChild(span);
        }
        grid.appendChild(row);
    }

    // step key
    const k = st.key == null ? '∅ (initial)' : keyName(st.key);
    $('#step-key').textContent = `step ${stepIdx + 1}  key: ${k}`;

    // cursor detail
    const cursorOk = cursorsMatch(st.canonCursor, st.jsCursor);
    const canonCursorLabel = st.canonCursor ? `[${st.canonCursor.join(', ')}]` : '(not recorded)';
    const jsCursorLabel = st.jsCursor ? `[${st.jsCursor.join(', ')}]` : '(not captured)';
    $('#cursor-detail').innerHTML =
        `canon = ${canonCursorLabel}<br>js&nbsp;&nbsp;&nbsp;= ${jsCursorLabel}` +
        (cursorOk ? '' : '<br><span class="rng-line diff">cursor mismatch</span>');

    // rng detail
    renderRngDetail(st.canonRng, st.jsRng);

    // message line (row 0 plain text, no escapes)
    $('#msg-detail').textContent = (itemAt(canon, 0).map(renderCell).join('').trimEnd() || '(empty)')
        + (itemAt(canon, 0).map(renderCell).join('') === itemAt(js, 0).map(renderCell).join('') ? '' : '\n  js: ' + (itemAt(js, 0).map(renderCell).join('').trimEnd() || '(empty)'));
}

function renderRngDetail(canonRng: readonly string[], jsRng: readonly string[]): void {
    const out = $('#rng-detail');
    out.innerHTML = '';
    const ap = canonRng.filter((e) => typeof e === 'string' && e[0] !== '<' && e[0] !== '>' && e[0] !== '^');
    const bp = jsRng.filter((e) => typeof e === 'string' && e[0] !== '<' && e[0] !== '>' && e[0] !== '^');
    if (!ap.length && !bp.length) {
        out.textContent = '(no PRNG calls)';
        return;
    }
    const max = Math.max(ap.length, bp.length);
    for (let i = 0; i < max; i++) {
        const a = ap[i];
        const b = bp[i];
        const line = document.createElement('span');
        line.className = 'rng-line';
        const aKey = callKey(a);
        const bKey = callKey(b);
        if (a && b && aKey === bKey) {
            line.classList.add('match');
            // Show the short form; full annotation lives in the title attr.
            line.textContent = `${i.toString().padStart(3, ' ')}  ${aKey}`;
            line.title = `canon: ${a}\njs:    ${b}`;
        } else if (a && !b) {
            line.classList.add('missing');
            line.textContent = `${i.toString().padStart(3, ' ')}  canon: ${a}`;
        } else if (b && !a) {
            line.classList.add('extra');
            line.textContent = `${i.toString().padStart(3, ' ')}  js:    ${b}`;
        } else {
            line.classList.add('diff');
            line.textContent = `${i.toString().padStart(3, ' ')}  canon: ${a}\n     js:    ${b}`;
        }
        out.appendChild(line);
    }
}

function keyName(k: string | null): string {
    if (k == null) return '∅';
    const code = k.charCodeAt(0);
    if (code === 13) return 'CR';
    if (code === 10) return 'LF';
    if (code === 27) return 'ESC';
    if (code === 32) return 'SPC';
    if (code === 127) return 'DEL';
    if (code < 32) return `^${String.fromCharCode(code + 64)}`;
    return JSON.stringify(k);
}
