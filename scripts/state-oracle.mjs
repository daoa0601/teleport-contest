#!/usr/bin/env node
// state-oracle.mjs — native state and coverage diagnostics for a corpus.
//
//   node scripts/state-oracle.mjs record   OUT [--public]   re-record with the probe recorder
//   node scripts/state-oracle.mjs compare  OUT [LABEL]      compare JS state digests with C
//   node scripts/state-oracle.mjs coverage OUT              C function coverage and TS references
//
// `record` re-records the frozen eval sample (or the public sessions) with
// the probe recorder built by nethack-c/probe/build-probe.sh. Each recording
// must reproduce the original random calls, screens, and cursors; only then
// is its state log kept. Coverage counters merge into OUT/profraw.
//
// `compare` replays the JS port and reports the first input whose game
// state differs from C, next to the first random-call and screen
// differences. A state difference before both is a hidden-state defect.
//
// `coverage` lists the C functions the corpus executed, by source file,
// and flags those whose names (or camelCase forms) never appear in src/js,
// in code or comments: either unported, or ported without a traceable name.
//
// Outputs stay under OUT; recordings, digests, and RNG logs are never
// copied into js/ or test/.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, join, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { acquireCorpusLock, killChild } from './lib/corpus-lock.mjs';
import { arrayValue, decodeSession, errorMessage, itemAt, numberValue, objectValue, stringValue } from './lib/session-types.mjs';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROBE = join(ROOT, '.cache/probe-recorder');
const PROBE_INSTALL = join(PROBE, 'install/games/lib/nethackdir');
const PROBE_BINARY = join(PROBE_INSTALL, 'nethack');
const SAMPLE = join(ROOT, '.cache/holdout-dev/eval-sample.json');
const ADAPTERS = join(ROOT, 'scripts/lib/frozen-adapters.mjs');
const RECORDER = join(ROOT, 'scripts/record-session.mjs');
const WORKER = join(ROOT, 'scripts/lib/state-replay.mjs');
const JOBS = Math.max(1, Number(process.env.STATE_ORACLE_JOBS || Math.min(6, availableParallelism() - 2)));
const TIMEOUT_MS = Number(process.env.SESSION_REPLAY_TIMEOUT_MS || 60000);
const HEAP_MB = Number(process.env.SESSION_REPLAY_HEAP_MB || 512);
const TOP = Number(process.env.STATE_ORACLE_TOP || 20);
// ── Corpus selection ──
function corpus(publicSet) {
    const paths = publicSet
        ? readdirSync(join(ROOT, 'sessions')).filter(f => f.endsWith('.session.json')).sort().map(f => `sessions/${f}`)
        : arrayValue(objectValue(JSON.parse(readFileSync(SAMPLE, 'utf8')), 'eval sample').sessions, 'sample sessions')
            .map(value => stringValue(objectValue(value, 'sample entry').path, 'sample path'));
    return paths.map(path => ({ path, id: basename(path, '.session.json') }));
}
function manifestEntries(out) {
    const data = objectValue(JSON.parse(readFileSync(join(out, 'record.json'), 'utf8')), 'record manifest');
    return arrayValue(data.recorded, 'recorded').map(value => {
        const entry = objectValue(value, 'recorded entry');
        return { path: stringValue(entry.path, 'path'), id: stringValue(entry.id, 'id') };
    });
}
// ── Process pool ──
const activeChildren = new Set();
function runChild(command, args, env, timeoutMs) {
    return new Promise(done => {
        const child = spawn(command, args, { cwd: ROOT, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
        activeChildren.add(child);
        let stdout = '', stderr = '', bytes = 0, failure = null;
        const timer = setTimeout(() => { failure = 'timeout'; killChild(child, 'SIGKILL'); }, timeoutMs);
        const take = (data, toStdout) => {
            bytes += data.length;
            if (bytes > 256 * 1024) {
                failure = 'bounded output exceeded';
                killChild(child, 'SIGKILL');
                return;
            }
            if (toStdout)
                stdout += data.toString();
            else
                stderr = (stderr + data.toString()).slice(-2000);
        };
        child.stdout.on('data', (d) => take(d, true));
        child.stderr.on('data', (d) => take(d, false));
        child.on('error', e => { failure = e.message; });
        child.on('close', code => {
            clearTimeout(timer);
            activeChildren.delete(child);
            const detail = failure ?? (code === 0 ? '' : `exit ${code}: ${stderr.slice(-300)}`);
            done({ ok: !failure && code === 0, stdout, detail });
        });
    });
}
async function pool(items, work, interrupted) {
    let next = 0;
    const lane = async (k) => {
        while (next < items.length) {
            if (interrupted())
                throw new Error('Interrupted; partial output retained, not a completed run');
            await work(itemAt(items, next++), k);
        }
    };
    await Promise.all(Array.from({ length: Math.min(JOBS, items.length) }, (_, k) => lane(k)));
}
async function withCorpus(run) {
    const release = acquireCorpusLock();
    let stopped = false;
    const stop = () => { stopped = true; for (const child of activeChildren)
        killChild(child, 'SIGKILL'); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    try {
        await run(() => stopped);
        if (stopped)
            throw new Error('Interrupted');
    }
    finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        release();
    }
}
// ── record ──
// The probe must reproduce the original recording exactly before its state
// log is trusted; returns the first differing step, or null.
function recordingDifference(originalPath, reRecordedPath) {
    const steps = (path) => decodeSession(normalizeSession(JSON.parse(readFileSync(path, 'utf8'))))
        .segments.flatMap(seg => (seg.steps ?? []).map(s => JSON.stringify([s.rng, s.screen ?? null, s.cursor ?? null])));
    const a = steps(originalPath), b = steps(reRecordedPath);
    const i = a.findIndex((v, k) => v !== b[k]);
    if (i >= 0)
        return `step ${i}`;
    return a.length === b.length ? null : `length ${a.length} vs ${b.length}`;
}
async function record(out, publicSet) {
    if (!existsSync(PROBE_BINARY))
        throw new Error('Build the probe first: bash nethack-c/probe/build-probe.sh');
    if (existsSync(out))
        throw new Error(`Output already exists: ${out}. Use a new directory.`);
    const entries = corpus(publicSet);
    for (const dir of ['states', 'profraw', 'tmp'])
        mkdirSync(join(out, dir), { recursive: true });
    const recorded = [], failed = [];
    await withCorpus(async (interrupted) => {
        await pool(entries, async (entry, lane) => {
            const statePath = join(out, 'states', `${entry.id}.state.log`);
            const tmp = join(out, 'tmp', `${entry.id}.session.json`);
            // Save, bones, and level files live in the install dir. Killed
            // recorder processes leave level files the recorder's cleanup
            // misses, so every session starts from a pristine lane copy.
            const laneInstall = join(PROBE, `lane${lane}`);
            execFileSync('rsync', ['-a', '--delete', '--exclude', '*.profraw', `${PROBE_INSTALL}/`, laneInstall + '/']);
            const env = { ...process.env, NETHACK_BINARY: join(laneInstall, 'nethack'), NETHACK_INSTALL: laneInstall,
                NETHACK_STATELOG: statePath, LLVM_PROFILE_FILE: join(out, 'profraw', 'probe-%4m.profraw'),
                RECORD_SESSION_QUIET: '1' };
            const run = await runChild(process.execPath, [RECORDER, resolve(ROOT, entry.path), tmp], env, 180000);
            const reason = !run.ok ? run.detail : recordingDifference(resolve(ROOT, entry.path), tmp);
            rmSync(tmp, { force: true });
            if (reason) {
                failed.push({ path: entry.path, reason: reason.slice(0, 200) });
                rmSync(statePath, { force: true });
            }
            else
                recorded.push(entry);
            const done = recorded.length + failed.length;
            if (done % 25 === 0 || done === entries.length)
                console.error(`${done}/${entries.length} recorded, ${failed.length} failed`);
        }, interrupted);
    });
    rmSync(join(out, 'tmp'), { recursive: true, force: true });
    recorded.sort((a, b) => a.path.localeCompare(b.path));
    writeFileSync(join(out, 'record.json'), JSON.stringify({ corpus: publicSet ? 'public' : 'eval-sample',
        finished: new Date().toISOString(), recorded, failed }, null, 2) + '\n');
    console.log(`${recorded.length} recordings reproduced exactly; ${failed.length} failed.`);
}
// ── compare ──
function decodeRef(value) {
    if (value === null || value === undefined)
        return null;
    const ref = objectValue(value, 'step ref');
    return { segment: numberValue(ref.segment, 'segment'), step: numberValue(ref.step, 'step') };
}
function decodeRow(value) {
    const data = objectValue(value, 'state result');
    const fs = data.firstState;
    let firstState = null;
    if (fs !== null && fs !== undefined) {
        const s = objectValue(fs, 'firstState');
        const ref = decodeRef(s);
        if (!ref)
            throw new Error('firstState without a step');
        firstState = { ...ref, field: stringValue(s.field, 'field'), c: stringValue(s.c, 'c'), js: stringValue(s.js, 'js') };
    }
    return {
        session: stringValue(data.session, 'session'),
        compared: numberValue(data.compared, 'compared'),
        phaseMismatches: numberValue(data.phaseMismatches, 'phaseMismatches'),
        firstState, firstRng: decodeRef(data.firstRng), firstScreen: decodeRef(data.firstScreen),
        error: data.error === null ? null : stringValue(data.error, 'error'),
    };
}
const earlier = (a, b) => !b || a.segment < b.segment || (a.segment === b.segment && a.step < b.step);
// One probe recording set serves many comparisons; LABEL names each one.
async function compare(out, label) {
    const entries = manifestEntries(out);
    const suffix = label ? `-${label}` : '';
    const resultsPath = join(out, `state-results${suffix}.jsonl`);
    if (existsSync(resultsPath))
        throw new Error(`${resultsPath} exists; choose a new LABEL`);
    const rows = [];
    await withCorpus(async (interrupted) => {
        await pool(entries, async (entry) => {
            const run = await runChild(process.execPath, [`--max-old-space-size=${HEAP_MB}`, '--import', ADAPTERS, WORKER,
                resolve(ROOT, entry.path), join(out, 'states', `${entry.id}.state.log`)], process.env, TIMEOUT_MS);
            const marker = run.stdout.lastIndexOf('__STATE_RESULT__');
            let row;
            try {
                if (!run.ok || marker < 0)
                    throw new Error(run.detail || 'missing result marker');
                row = decodeRow(JSON.parse(run.stdout.slice(marker + '__STATE_RESULT__'.length).trim()));
            }
            catch (e) {
                row = { session: basename(entry.path), compared: 0, phaseMismatches: 0, firstState: null,
                    firstRng: null, firstScreen: null, error: errorMessage(e).slice(0, 200) };
            }
            rows.push(row);
            if (rows.length % 50 === 0 || rows.length === entries.length)
                console.error(`${rows.length}/${entries.length} compared`);
        }, interrupted);
    });
    rows.sort((a, b) => a.session.localeCompare(b.session));
    writeFileSync(resultsPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    const measured = rows.filter(r => !r.error);
    const leading = measured.filter(r => r.firstState && earlier(r.firstState, r.firstRng) && earlier(r.firstState, r.firstScreen));
    const fields = new Map();
    for (const r of measured) {
        if (!r.firstState)
            continue;
        const f = fields.get(r.firstState.field) ?? { first: 0, leading: 0 };
        f.first++;
        if (leading.includes(r))
            f.leading++;
        fields.set(r.firstState.field, f);
    }
    const lead = (r) => {
        const fs = r.firstState;
        if (!fs)
            return 0;
        const visible = [r.firstRng, r.firstScreen].filter((x) => x !== null && x.segment === fs.segment);
        return visible.length ? Math.min(...visible.map(x => x.step)) - fs.step : Infinity;
    };
    const summary = {
        sessions: rows.length, errors: rows.length - measured.length,
        stateMatchesThroughout: measured.filter(r => !r.firstState).length,
        stepsCompared: measured.reduce((n, r) => n + r.compared, 0),
        phaseMismatches: measured.reduce((n, r) => n + r.phaseMismatches, 0),
        stateBeforeRngAndScreen: leading.length,
        fields: Object.fromEntries(fields),
    };
    writeFileSync(join(out, `state-summary${suffix}.json`), JSON.stringify(summary, null, 2) + '\n');
    console.log('# Game-state oracle\n');
    console.log(`${summary.sessions} sessions; ${summary.errors} errors; ${summary.stepsCompared} in-play steps compared.`);
    console.log(`State matches C throughout: ${summary.stateMatchesThroughout}. `
        + `State differs before any random-call or screen difference: ${summary.stateBeforeRngAndScreen}.\n`);
    console.log('| First differing field | Sessions | Before visible |\n|---|---:|---:|');
    for (const [field, f] of [...fields].sort((a, b) => b[1].first - a[1].first))
        console.log(`| ${field} | ${f.first} | ${f.leading} |`);
    console.log('\n## Hidden-state differences (state first, by lead)\n');
    console.log('| Session | Step | Field | C | JS | Steps before visible |\n|---|---:|---|---|---|---:|');
    for (const r of [...leading].sort((a, b) => lead(b) - lead(a)).slice(0, TOP)) {
        const fs = r.firstState;
        if (!fs)
            continue;
        const cell = (s) => s.replace(/\|/g, '\\|').slice(0, 60);
        console.log(`| ${r.session.slice(0, 13)} | ${fs.segment}:${fs.step} | ${fs.field} | ${cell(fs.c)} | ${cell(fs.js)} | ${lead(r) === Infinity ? 'never' : lead(r)} |`);
    }
    for (const r of rows.filter(x => x.error).slice(0, 5))
        console.log(`\nerror ${r.session}: ${r.error ?? ''}`);
}
// Host, storage, option-parsing, Lua-binding, and capture code. The port
// replaces these wholesale, so their functions are listed but not ranked
// as missing mechanics.
const INFRASTRUCTURE = new Set(['alloc.c', 'cfgfiles.c', 'coloratt.c', 'date.c', 'dlb.c', 'files.c', 'glyphs.c',
    'hacklib.c', 'mdlib.c', 'nhlobj.c', 'nhlsel.c', 'nhlua.c', 'nhmd4.c', 'options.c', 'report.c', 'restore.c',
    'rnd.c', 'save.c', 'selvar.c', 'sfbase.c', 'sfstruct.c', 'strutil.c', 'symbols.c', 'sys.c', 'utf8map.c',
    'version.c', 'windows.c']);
// Identifier words of the TS port, including those in comments and C refs.
function portWords() {
    const words = new Set();
    const walk = (dir) => {
        for (const name of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, name.name);
            if (name.isDirectory())
                walk(path);
            else if (['.ts', '.mts'].includes(extname(name.name))) {
                for (const w of readFileSync(path, 'utf8').match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])
                    words.add(w);
            }
        }
    };
    walk(join(ROOT, 'src/js'));
    return words;
}
const camel = (name) => name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
function coverage(out) {
    const raws = readdirSync(join(out, 'profraw')).filter(f => f.endsWith('.profraw')).map(f => join(out, 'profraw', f));
    if (!raws.length)
        throw new Error('No coverage counters; run `record` first');
    const profdata = join(out, 'coverage.profdata');
    execFileSync('xcrun', ['llvm-profdata', 'merge', '-sparse', ...raws, '-o', profdata]);
    const exported = join(out, 'coverage-export.json');
    execFileSync('sh', ['-c', 'xcrun llvm-cov export -format=text -skip-expansions "$1" -instr-profile="$2" > "$3"',
        'sh', PROBE_BINARY, profdata, exported]);
    const data = objectValue(itemAt(arrayValue(objectValue(JSON.parse(readFileSync(exported, 'utf8')), 'export').data, 'data'), 0), 'export data');
    rmSync(exported);
    const words = portWords();
    const rows = [];
    const srcPrefix = join(PROBE, 'tree/src') + '/';
    for (const value of arrayValue(data.functions, 'functions')) {
        const f = objectValue(value, 'function');
        const filename = stringValue(itemAt(arrayValue(f.filenames, 'filenames'), 0), 'filename');
        // Game mechanics live in src/*.c; window ports and system code are out of scope.
        if (!filename.startsWith(srcPrefix))
            continue;
        const name = stringValue(f.name, 'name').replace(/^.*:/, '');
        const file = filename.slice(srcPrefix.length);
        rows.push({ function: name, file, count: numberValue(f.count, 'count'),
            referenced: words.has(name) || words.has(camel(name)), infrastructure: INFRASTRUCTURE.has(file) });
    }
    const files = new Map();
    const mechanics = rows.filter(r => !r.infrastructure);
    for (const r of mechanics) {
        const f = files.get(r.file) ?? { total: 0, executed: 0, executedUnreferenced: [], neverExecuted: 0 };
        f.total++;
        if (r.count > 0) {
            f.executed++;
            if (!r.referenced)
                f.executedUnreferenced.push(r.function);
        }
        else
            f.neverExecuted++;
        files.set(r.file, f);
    }
    const executed = mechanics.filter(r => r.count > 0);
    const gaps = executed.filter(r => !r.referenced).sort((a, b) => b.count - a.count);
    writeFileSync(join(out, 'c-coverage.json'), JSON.stringify({
        corpus: relative(ROOT, out), infrastructureFiles: [...INFRASTRUCTURE].sort(),
        functions: mechanics.length, executed: executed.length,
        executedUnreferenced: gaps.length, neverExecuted: mechanics.length - executed.length,
        files: Object.fromEntries([...files].sort((a, b) => a[0].localeCompare(b[0]))),
        rows: rows.sort((a, b) => a.file.localeCompare(b.file) || a.function.localeCompare(b.function)),
    }, null, 2) + '\n');
    console.log('# C coverage of the corpus\n');
    console.log(`${mechanics.length} mechanics functions in src/*.c (${rows.length - mechanics.length} infrastructure excluded); `
        + `${executed.length} executed by the corpus; ${gaps.length} executed but never named in src/js; `
        + `${mechanics.length - executed.length} never executed.\n`);
    console.log('## Executed C functions never named in src/js (unported or untraced), by call count\n');
    console.log('| Function | File | Calls |\n|---|---|---:|');
    for (const r of gaps.slice(0, TOP))
        console.log(`| ${r.function} | ${r.file} | ${r.count} |`);
    console.log('\n## Files by unexercised functions\n');
    console.log('| File | Executed | Executed, unreferenced | Never executed |\n|---|---:|---:|---:|');
    for (const [file, f] of [...files].sort((a, b) => b[1].neverExecuted - a[1].neverExecuted).slice(0, TOP)) {
        console.log(`| ${file} | ${f.executed}/${f.total} | ${f.executedUnreferenced.length} | ${f.neverExecuted} |`);
    }
}
// ── CLI ──
const [command, outArg, flag] = process.argv.slice(2);
try {
    if (!outArg)
        throw new Error('usage: state-oracle.mjs {record OUT [--public] | compare OUT [LABEL] | coverage OUT}');
    const out = resolve(outArg);
    if (command === 'record')
        await record(out, flag === '--public');
    else if (command === 'compare')
        await compare(out, flag);
    else if (command === 'coverage')
        coverage(out);
    else
        throw new Error(`Unknown command ${command ?? ''}`);
}
catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
}
//# sourceMappingURL=state-oracle.mjs.map