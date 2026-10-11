#!/usr/bin/env node
// rng-function-table.mjs — per-C-function random-call verification table.
//
// Post-processes a completed triage/eval/public run. Each recorded native
// random call names the C function (or Lua site) that made it. A call is
// verified when it lies before its session's first random-call divergence;
// once the streams split, later calls cannot be compared, so they count as
// unverified rather than wrong. The function whose expected call failed is
// blamed, with the downstream calls that its divergence hid.
//
//   node scripts/rng-function-table.mjs RUN_DIR [--baseline OLD/functions.json]
//       [--check-ledger LEDGER.tsv] [--write-ledger LEDGER.tsv]
//
// Writes RUN_DIR/functions.json and prints bounded Markdown tables. With a
// baseline from the same corpus, it lists functions that lost verified calls,
// functions newly blamed by a later divergence, and newly verified functions.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { decodeSession, arrayValue, booleanValue, errorMessage, itemAt, numberValue, objectValue, stringValue } from './lib/session-types.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RNG_CALL = /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/;
const TOP = Number(process.env.FUNCTION_TABLE_TOP || 25);

interface Site { key: string; file: string }
type RunOutcome =
    | { kind: 'verified' }
    | { kind: 'rng'; globalIndex: number; expected: boolean }
    | { kind: 'error'; segment: number }
    | { kind: 'unmeasured'; reason: string };
interface RunEntry { path: string; outcome: RunOutcome }

interface FunctionRow {
    function: string;
    file: string;
    calls: number;
    verified: number;
    sessions: number;
    fullyVerifiedSessions: number;
    // Sessions whose first divergence is this function's expected call
    // (value differs, or the port made no call there).
    blamedExpected: number;
    // Sessions where the port made an extra call right after this function's.
    blamedExtra: number;
    // Recorded calls left unverified by the divergences blamed here.
    hiddenCalls: number;
    examples: string[];
}
interface FileRow { file: string; functions: number; fullyVerifiedFunctions: number; calls: number; verified: number; blamed: number; hiddenCalls: number }
interface Table {
    version: 1;
    run: string;
    sessions: { measured: number; unmeasured: { path: string; reason: string }[] };
    totals: { calls: number; verified: number };
    functions: FunctionRow[];
    files: FileRow[];
}

// "dosounds(sounds.c:213)"                         → dosounds, sounds.c
// "nh.rn2(themerms.lua:969)"                        → themerms.lua@969
// "random src=nhlib.lua:10 parent=d(nhlib.lua:36)"  → nhlib.lua:random
// "nh.rn2 src=themerms.lua:1039 parent=room([C]:-1)" → themerms.lua@1039
function callSite(tag: string): Site {
    const c = /^(\w+)\(([\w.-]+\.c):\d+\)$/.exec(tag);
    if (c) return { key: itemAt(c, 1), file: itemAt(c, 2) };
    const luaSrc = /^([\w.]+) src=([\w.-]+\.lua):(\d+)/.exec(tag);
    if (luaSrc) {
        const fn = itemAt(luaSrc, 1), file = itemAt(luaSrc, 2);
        return { key: fn.startsWith('nh.') ? `${file}@${itemAt(luaSrc, 3)}` : `${file}:${fn}`, file };
    }
    const luaDirect = /^([\w.]+)\(([\w.-]+\.lua):(\d+)\)$/.exec(tag);
    if (luaDirect) {
        const fn = itemAt(luaDirect, 1), file = itemAt(luaDirect, 2);
        return { key: fn.startsWith('nh.') ? `${file}@${itemAt(luaDirect, 3)}` : `${file}:${fn}`, file };
    }
    return { key: tag, file: '?' };
}

function siteOf(entry: string): Site {
    const m = /@\s*(.+?)\s*$/.exec(entry);
    return m ? callSite(itemAt(m, 1)) : { key: '(no caller)', file: '?' };
}

// Native calls flattened in scorer order, plus where each segment starts.
function recordedCalls(path: string): { calls: string[]; segmentBase: number[] } {
    const data: unknown = JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
    const calls: string[] = [];
    const segmentBase: number[] = [];
    for (const segment of decodeSession(normalizeSession(data)).segments) {
        segmentBase.push(calls.length);
        for (const step of segment.steps ?? []) {
            for (const entry of step.rng) if (RNG_CALL.test(entry)) calls.push(entry);
        }
    }
    return { calls, segmentBase };
}

function decodeOutcome(data: Record<string, unknown>): RunOutcome {
    const error = data.error;
    // Worker failures (timeouts, heap limits) carry a string error and no
    // scorer diagnostics; they say nothing about which calls matched.
    if (typeof error === 'string') return { kind: 'unmeasured', reason: error.slice(0, 120) };
    if (data.fatal === true) return { kind: 'unmeasured', reason: 'fatal scorer result' };
    const firstRng = data.firstRng;
    if (firstRng !== null && firstRng !== undefined) {
        const rng = objectValue(firstRng, 'firstRng');
        return { kind: 'rng', globalIndex: numberValue(rng.globalIndex, 'firstRng.globalIndex'), expected: rng.c !== null };
    }
    if (error !== null && error !== undefined) {
        const segment = objectValue(error, 'scorer error').segment;
        if (typeof segment !== 'number') return { kind: 'unmeasured', reason: 'error outside a segment' };
        return { kind: 'error', segment };
    }
    booleanValue(data.passed, 'passed');
    return { kind: 'verified' };
}

function readRun(dir: string): RunEntry[] {
    const file = join(dir, 'results.jsonl');
    if (!existsSync(join(dir, 'summary.json'))) throw new Error(`${dir} has no summary.json; use a completed run`);
    return readFileSync(file, 'utf8').trim().split('\n').map((line, i) => {
        const data = objectValue(JSON.parse(line), `results line ${i + 1}`);
        return { path: stringValue(data.path, 'path'), outcome: decodeOutcome(data) };
    });
}

function buildTable(run: string, entries: readonly RunEntry[]): Table {
    const rows = new Map<string, FunctionRow>();
    const row = (site: Site): FunctionRow => {
        let found = rows.get(site.key);
        if (!found) {
            found = { function: site.key, file: site.file, calls: 0, verified: 0, sessions: 0, fullyVerifiedSessions: 0,
                blamedExpected: 0, blamedExtra: 0, hiddenCalls: 0, examples: [] };
            rows.set(site.key, found);
        }
        return found;
    };
    const unmeasured: { path: string; reason: string }[] = [];
    let measured = 0;
    for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
        const outcome = entry.outcome;
        if (outcome.kind === 'unmeasured') { unmeasured.push({ path: entry.path, reason: outcome.reason }); continue; }
        measured++;
        const { calls, segmentBase } = recordedCalls(entry.path);
        const verifiedEnd = outcome.kind === 'verified' ? calls.length
            : outcome.kind === 'rng' ? outcome.globalIndex
                : itemAt(segmentBase, outcome.segment);
        if (verifiedEnd < 0 || verifiedEnd > calls.length) throw new Error(`${entry.path}: divergence index outside the recording`);

        const perSession = new Map<string, { calls: number; verified: number }>();
        for (const [i, call] of calls.entries()) {
            const r = row(siteOf(call));
            r.calls++;
            const s = perSession.get(r.function) ?? { calls: 0, verified: 0 };
            s.calls++;
            if (i < verifiedEnd) { r.verified++; s.verified++; }
            perSession.set(r.function, s);
        }
        for (const [key, s] of perSession) {
            const r = rows.get(key);
            if (!r) continue;
            r.sessions++;
            if (s.verified === s.calls) r.fullyVerifiedSessions++;
        }

        if (outcome.kind === 'verified') continue;
        const hidden = calls.length - verifiedEnd;
        let blamed: FunctionRow;
        if (outcome.kind === 'error') {
            blamed = row({ key: '(js error)', file: '?' });
            blamed.blamedExpected++;
        } else if (outcome.expected) {
            blamed = row(siteOf(itemAt(calls, outcome.globalIndex)));
            blamed.blamedExpected++;
        } else {
            blamed = outcome.globalIndex > 0 ? row(siteOf(itemAt(calls, outcome.globalIndex - 1)))
                : row({ key: '(before first call)', file: '?' });
            blamed.blamedExtra++;
        }
        blamed.hiddenCalls += hidden;
        if (blamed.examples.length < 3) blamed.examples.push(entry.path);
    }

    const functions = [...rows.values()].sort((a, b) => b.hiddenCalls - a.hiddenCalls
        || (b.calls - b.verified) - (a.calls - a.verified) || a.function.localeCompare(b.function));
    const files = new Map<string, FileRow>();
    for (const r of functions) {
        const f = files.get(r.file) ?? { file: r.file, functions: 0, fullyVerifiedFunctions: 0, calls: 0, verified: 0, blamed: 0, hiddenCalls: 0 };
        f.functions++;
        if (r.verified === r.calls && r.blamedExpected + r.blamedExtra === 0) f.fullyVerifiedFunctions++;
        f.calls += r.calls;
        f.verified += r.verified;
        f.blamed += r.blamedExpected + r.blamedExtra;
        f.hiddenCalls += r.hiddenCalls;
        files.set(r.file, f);
    }
    return {
        version: 1,
        run,
        sessions: { measured, unmeasured },
        totals: { calls: functions.reduce((n, r) => n + r.calls, 0), verified: functions.reduce((n, r) => n + r.verified, 0) },
        functions,
        files: [...files.values()].sort((a, b) => b.hiddenCalls - a.hiddenCalls || (b.calls - b.verified) - (a.calls - a.verified)),
    };
}

type Status = 'verified' | 'partial' | 'unreached' | 'diverges';
function status(r: FunctionRow): Status {
    if (r.blamedExpected + r.blamedExtra > 0) return 'diverges';
    if (r.verified === r.calls) return 'verified';
    return r.verified === 0 ? 'unreached' : 'partial';
}

const pct = (n: number, d: number): string => d ? `${(100 * n / d).toFixed(1)}%` : '-';

function printTable(table: Table): void {
    const counts: Record<Status, number> = { verified: 0, partial: 0, unreached: 0, diverges: 0 };
    for (const r of table.functions) counts[status(r)]++;
    console.log(`# Random-call verification by function\n`);
    console.log(`Run: ${table.run}. ${table.sessions.measured} sessions measured, ${table.sessions.unmeasured.length} unmeasured.`);
    console.log(`Recorded calls verified: ${table.totals.verified}/${table.totals.calls} (${pct(table.totals.verified, table.totals.calls)}).`);
    console.log(`Functions: ${table.functions.length} — ${counts.verified} verified, ${counts.partial} partial, `
        + `${counts.unreached} unreached, ${counts.diverges} diverging.\n`);

    console.log(`## Diverging functions by hidden calls\n`);
    console.log('| Function | File | Blamed (expected/extra) | Hidden calls | Verified | Example |');
    console.log('|---|---|---:|---:|---:|---|');
    for (const r of table.functions.filter(f => status(f) === 'diverges').slice(0, TOP)) {
        console.log(`| ${r.function} | ${r.file} | ${r.blamedExpected}/${r.blamedExtra} | ${r.hiddenCalls} | `
            + `${r.verified}/${r.calls} (${pct(r.verified, r.calls)}) | ${(r.examples[0] ?? '').split('/').at(-1) ?? ''} |`);
    }
    console.log(`\n## Least-verified files\n`);
    console.log('| File | Functions verified | Calls verified | Blamed sessions | Hidden calls |');
    console.log('|---|---:|---:|---:|---:|');
    for (const f of table.files.slice(0, TOP)) {
        console.log(`| ${f.file} | ${f.fullyVerifiedFunctions}/${f.functions} | ${f.verified}/${f.calls} (${pct(f.verified, f.calls)}) | ${f.blamed} | ${f.hiddenCalls} |`);
    }
}

function decodeBaseline(path: string): Map<string, { verified: number; calls: number; blamed: number }> {
    const data = objectValue(JSON.parse(readFileSync(path, 'utf8')), 'baseline table');
    if (data.version !== 1) throw new Error('Unsupported baseline table version');
    return new Map(arrayValue(data.functions, 'baseline functions').map(value => {
        const r = objectValue(value, 'baseline function');
        return [stringValue(r.function, 'function'), {
            verified: numberValue(r.verified, 'verified'), calls: numberValue(r.calls, 'calls'),
            blamed: numberValue(r.blamedExpected, 'blamedExpected') + numberValue(r.blamedExtra, 'blamedExtra'),
        }];
    }));
}

// Same corpus, so per-function call totals must agree. A verified count can
// only fall when an earlier divergence appeared in some session; more blame
// with no verified loss means a later divergence moved onto this function.
function printComparison(table: Table, baselinePath: string): void {
    const before = decodeBaseline(baselinePath);
    const regressed: string[] = [], exposed: string[] = [], newlyVerified: string[] = [];
    let mismatchedCorpus = 0;
    for (const r of table.functions) {
        const old = before.get(r.function);
        if (!old) continue;
        if (old.calls !== r.calls) { mismatchedCorpus++; continue; }
        const blamed = r.blamedExpected + r.blamedExtra;
        const line = `| ${r.function} | ${old.verified} → ${r.verified} / ${r.calls} | ${old.blamed} → ${blamed} |`;
        if (r.verified < old.verified) regressed.push(line);
        else if (blamed > old.blamed) exposed.push(line);
        if (status(r) === 'verified' && old.verified < old.calls) newlyVerified.push(r.function);
    }
    const section = (title: string, lines: string[]): string => `### ${title}\n\n`
        + (lines.length ? `| Function | Verified | Blamed |\n|---|---:|---:|\n${lines.slice(0, TOP).join('\n')}` : 'None.');
    console.log(`\n## Against ${baselinePath}\n`);
    if (mismatchedCorpus) console.log(`Warning: ${mismatchedCorpus} functions have different call totals; the runs used different corpora.\n`);
    console.log(section('Regressions (verified calls lost)', regressed));
    console.log(`\n${section('Newly exposed (later divergence now blamed here)', exposed)}`);
    console.log(`\nNewly fully verified: ${newlyVerified.length ? newlyVerified.slice(0, TOP).join(', ') : 'none'}.`);
}

// Ledger: one line per fully verified function, "function<TAB>verified<TAB>calls".
// A fully verified function cannot gain blame without losing a verified
// call, so the check is exact: on the same corpus, every listed function
// must keep its verified count. New entries are added only by --write-ledger.
interface LedgerEntry { function: string; verified: number; calls: number }

function readLedger(path: string): LedgerEntry[] {
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => {
        const [fn, verified, calls] = line.split('\t');
        const entry = { function: fn ?? '', verified: Number(verified), calls: Number(calls) };
        if (!entry.function || !Number.isInteger(entry.verified) || !Number.isInteger(entry.calls)) {
            throw new Error(`Malformed ledger line: ${line.slice(0, 80)}`);
        }
        return entry;
    });
}

function checkLedger(table: Table, path: string): string[] {
    const rows = new Map(table.functions.map(r => [r.function, r]));
    const failures: string[] = [];
    for (const entry of readLedger(path)) {
        const r = rows.get(entry.function);
        if (!r) failures.push(`${entry.function}: no longer called by this corpus`);
        else if (r.calls !== entry.calls) failures.push(`${entry.function}: ${r.calls} calls, ledger has ${entry.calls}; different corpus?`);
        else if (r.verified < entry.verified) failures.push(`${entry.function}: verified ${entry.verified} → ${r.verified} of ${r.calls}`);
    }
    return failures;
}

function writeLedger(table: Table, path: string): number {
    const entries = table.functions.filter(r => status(r) === 'verified').sort((a, b) => a.function.localeCompare(b.function));
    writeFileSync(path, [
        '# Functions whose every recorded random call matched native C on this corpus.',
        `# Generated by scripts/rng-function-table.mjs from ${table.run}; check with --check-ledger.`,
        '# function\tverified\tcalls',
        ...entries.map(r => `${r.function}\t${r.verified}\t${r.calls}`),
    ].join('\n') + '\n');
    return entries.length;
}

function option(args: string[], name: string): string | undefined {
    const at = args.indexOf(name);
    if (at < 0) return undefined;
    const value = args[at + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} needs a path`);
    return value;
}

function main(): void {
    const args = process.argv.slice(2);
    const runArg = args[0];
    const known = ['--baseline', '--check-ledger', '--write-ledger'];
    const flags = args.slice(1).filter((_, i) => i % 2 === 0);
    if (!runArg || runArg.startsWith('-') || args.length % 2 !== 1 || flags.some(f => !known.includes(f))) {
        console.error('Usage: node scripts/rng-function-table.mjs RUN_DIR [--baseline OLD/functions.json]'
            + ' [--check-ledger LEDGER.tsv] [--write-ledger LEDGER.tsv]');
        process.exitCode = 2;
        return;
    }
    const baseline = option(args, '--baseline');
    const check = option(args, '--check-ledger');
    const write = option(args, '--write-ledger');
    const dir = resolve(runArg);
    const table = buildTable(runArg, readRun(dir));
    writeFileSync(join(dir, 'functions.json'), JSON.stringify(table, null, 2) + '\n');
    printTable(table);
    if (baseline) printComparison(table, resolve(baseline));
    for (const ledger of [check, write]) {
        if (!ledger) continue;
        const failures = checkLedger(table, resolve(ledger));
        if (failures.length) {
            console.log(`\n## Ledger regressions (${ledger})\n\n${failures.slice(0, TOP).map(f => `- ${f}`).join('\n')}`);
            process.exitCode = 1;
            return;
        }
        console.log(`\nLedger ${ledger}: ${readLedger(resolve(ledger)).length} functions keep every verified call.`);
    }
    if (write) console.log(`Wrote ${writeLedger(table, resolve(write))} fully verified functions to ${write}.`);
}

try {
    main();
} catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
}
