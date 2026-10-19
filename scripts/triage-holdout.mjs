#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { decodeSession, arrayValue, booleanValue, errorMessage, itemAt, numberValue, objectValue, stringValue } from './lib/session-types.mjs';
import { acquireCorpusLock, killChild } from './lib/corpus-lock.mjs';
const POOL_STRATA = ['adaptive', 'deep', 'scenarios'];
function decodeStratum(value) {
    if (value === 'adaptive' || value === 'deep' || value === 'scenarios' || value === 'public')
        return value;
    throw new Error(`Invalid session stratum: ${String(value)}`);
}
function decodeSample(value) {
    const sample = objectValue(value, 'frozen sample');
    if (sample.version !== 1)
        throw new Error('Invalid frozen sample version');
    const sessions = arrayValue(sample.sessions, 'sample sessions').map((value) => {
        const entry = objectValue(value, 'sample session');
        const stratum = decodeStratum(entry.stratum);
        if (stratum === 'public')
            throw new Error('Frozen sample cannot include public sessions');
        return { path: stringValue(entry.path, 'sample path'), stratum, seed: numberValue(entry.seed, 'sample seed') };
    });
    if (sessions.length !== 300)
        throw new Error('Invalid frozen sample size');
    return { version: 1, sessions };
}
function decodeMetric(value, label) {
    const data = objectValue(value, label);
    const matched = numberValue(data.matched, `${label}.matched`);
    const total = numberValue(data.total, `${label}.total`);
    if (!Number.isInteger(matched) || !Number.isInteger(total) || matched < 0 || total < matched) {
        throw new Error(`Invalid ${label} scorer counts`);
    }
    return { matched, total };
}
function decodeDivergence(value) {
    if (value === null)
        return null;
    const data = objectValue(value, 'first divergence');
    const kind = data.kind;
    if (kind !== 'rng' && kind !== 'screen' && kind !== 'error')
        throw new Error('Invalid divergence kind');
    return { ...data, kind,
        caller: data.caller == null ? null : stringValue(data.caller, 'divergence caller'),
        step: data.step == null ? null : numberValue(data.step, 'divergence step') };
}
function decodeResult(value, entry) {
    const data = objectValue(value, 'scorer result');
    const metrics = objectValue(data.metrics, 'scorer metrics');
    const error = decodeScoreError(data.error);
    return { ...data, path: entry?.path ?? stringValue(data.path, 'result path'),
        stratum: entry?.stratum ?? decodeStratum(data.stratum),
        passed: booleanValue(data.passed, 'result passed'), error,
        metrics: { ...metrics, screens: decodeMetric(metrics.screens, 'screens'), rngCalls: decodeMetric(metrics.rngCalls, 'rngCalls') },
        firstDivergence: decodeDivergence(data.firstDivergence) };
}
function decodeScoreError(value) {
    if (value == null || typeof value === 'string')
        return value ?? null;
    const error = objectValue(value, 'scorer error');
    return { ...error, message: stringValue(error.message, 'scorer error message') };
}
function resultError(error) {
    return typeof error === 'string' ? error : error?.message ?? '';
}
const metricKeys = ['screens', 'rngCalls'];
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POOL = join(ROOT, '.cache/holdout-dev');
const SAMPLE = join(POOL, 'eval-sample.json');
const WORK = join(ROOT, '.cache/generalization');
const STRATA = { adaptive: 120, deep: 120, scenarios: 60 };
const WORKER = join(ROOT, 'scripts/lib/score-session.mjs');
const ADAPTERS = join(ROOT, 'scripts/lib/frozen-adapters.mjs');
const TIMEOUT_MS = Number(process.env.SESSION_REPLAY_TIMEOUT_MS || 45000);
const HEAP_MB = Number(process.env.SESSION_REPLAY_HEAP_MB || 512);
// Each session runs in its own heap-limited process, so workers are bounded by
// JOBS * HEAP_MB rather than by one shared corpus heap.
const JOBS = Math.max(1, Number(process.env.TRIAGE_JOBS || Math.min(8, availableParallelism() - 2)));
// TRIAGE_SHARD=i/n scores every n-th corpus entry starting at i, so CI can
// split one corpus across runners and merge the results.jsonl files.
function corpusShard() {
    const value = process.env.TRIAGE_SHARD;
    if (!value)
        return null;
    const match = /^(\d+)\/(\d+)$/.exec(value);
    const index = Number(match?.[1]), count = Number(match?.[2]);
    if (!match || count < 1 || index >= count)
        throw new Error(`TRIAGE_SHARD must be i/n with 0 <= i < n: ${value}`);
    return { index, count };
}
function poolEntries() {
    return POOL_STRATA.flatMap(stratum => {
        const data = JSON.parse(readFileSync(join(POOL, stratum, 'manifest.json'), 'utf8'));
        const manifest = objectValue(data, `${stratum} manifest`);
        if (manifest.pending !== undefined && arrayValue(manifest.pending, 'pending recordings').length) {
            throw new Error(`${stratum} has pending recordings`);
        }
        return arrayValue(manifest.accepted, 'accepted recordings').map((value) => {
            const entry = objectValue(value, 'accepted recording');
            const spec = objectValue(entry.spec, 'recording spec');
            return { path: relative(ROOT, join(POOL, stratum, stringValue(entry.file, 'recording file'))),
                stratum, seed: numberValue(spec.seed, 'recording seed') };
        });
    });
}
function freezeSample() {
    if (existsSync(SAMPLE)) {
        const sample = readSample();
        console.log(`Keeping frozen sample: ${sample.sessions.length} sessions in ${relative(ROOT, SAMPLE)}`);
        return;
    }
    const entries = poolEntries();
    const seedRank = (seed) => createHash('sha256').update(String(seed), 'utf8').digest('hex');
    const sessions = POOL_STRATA.flatMap(stratum => {
        const count = STRATA[stratum];
        const candidates = entries.filter(e => e.stratum === stratum)
            .map(e => ({ ...e, seedHash: seedRank(e.seed) }))
            .sort((a, b) => a.seedHash < b.seedHash ? -1 : a.seedHash > b.seedHash ? 1 : 0);
        if (candidates.length < count)
            throw new Error(`Not enough ${stratum} sessions`);
        return candidates.slice(0, count);
    });
    writeFileSync(SAMPLE, JSON.stringify({
        version: 1, created: new Date().toISOString(),
        selection: 'Lowest SHA-256 hex of UTF-8 decimal initial seed within each stratum; no JS results',
        strata: STRATA, poolSize: entries.length, sessions,
    }, null, 2) + '\n', { flag: 'wx' });
    console.log(`Froze ${sessions.length} sessions in ${relative(ROOT, SAMPLE)}`);
}
function readSample() {
    const data = JSON.parse(readFileSync(SAMPLE, 'utf8'));
    const sample = decodeSample(data);
    const pool = new Map(poolEntries().map(e => [e.path, e]));
    const seen = new Set();
    for (const e of sample.sessions) {
        const source = pool.get(e.path);
        if (!source || source.seed !== e.seed || source.stratum !== e.stratum || seen.has(e.path)) {
            throw new Error(`Frozen sample no longer agrees with native manifest: ${e.path}`);
        }
        seen.add(e.path);
    }
    for (const [stratum, count] of Object.entries(STRATA)) {
        if (sample.sessions.filter(e => e.stratum === stratum).length !== count) {
            throw new Error(`Invalid frozen ${stratum} count`);
        }
    }
    return sample;
}
function expectedTotals(path) {
    const data = JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
    const session = decodeSession(normalizeSession(data));
    let screens = 0, rngCalls = 0;
    for (const seg of session.segments) {
        for (const step of seg.steps || []) {
            if (step.screen)
                screens++;
            rngCalls += (step.rng || []).filter(e => typeof e === 'string'
                && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(e)).length;
        }
    }
    return { screens, rngCalls };
}
function failedResult(entry, message, totals) {
    return { ...entry, passed: false, error: message.slice(0, 2000),
        metrics: { screens: { matched: 0, total: totals.screens }, rngCalls: { matched: 0, total: totals.rngCalls } },
        firstDivergence: { kind: 'error', caller: null, step: null },
    };
}
function summarize(results) {
    const sum = (key) => {
        const metric = results.reduce((a, r) => ({ matched: a.matched + r.metrics[key].matched, total: a.total + r.metrics[key].total }), { matched: 0, total: 0 });
        return { ...metric, percent: metric.total ? 100 * metric.matched / metric.total : 0 };
    };
    return { sessions: results.length, fullPasses: results.filter(r => r.passed).length,
        errors: results.filter(r => r.error).length, screens: sum('screens'), rngCalls: sum('rngCalls') };
}
function clusterKey(result) {
    const first = result.firstDivergence;
    const caller = first?.caller?.split('(')[0];
    return caller || (first?.kind === 'screen' ? `screen-step:${first.step}` : first?.kind || 'unknown');
}
function rankClusters(results) {
    const groups = new Map();
    for (const r of results) {
        if (r.passed)
            continue;
        const key = clusterKey(r);
        if (!groups.has(key))
            groups.set(key, { function: key, sessions: 0, strata: {}, examples: [] });
        const group = groups.get(key);
        if (!group)
            throw new Error(`Missing divergence cluster ${key}`);
        group.sessions++;
        group.strata[r.stratum] = (group.strata[r.stratum] || 0) + 1;
        if (group.examples.length < 3)
            group.examples.push(r.path);
    }
    return [...groups.values()].sort((a, b) => b.sessions - a.sessions || a.function.localeCompare(b.function));
}
const activeChildren = new Set();
function killWorkers(signal) {
    for (const child of activeChildren)
        killChild(child, signal);
}
async function scoreOne(entry) {
    let totals;
    try {
        totals = expectedTotals(entry.path);
    }
    catch (error) {
        throw new Error(`Invalid recording ${entry.path}: ${errorMessage(error)}`, { cause: error });
    }
    return new Promise(resolveResult => {
        const child = spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, '--import', ADAPTERS, WORKER, resolve(ROOT, entry.path)], {
            cwd: ROOT, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
        });
        activeChildren.add(child);
        let stdout = '', stderr = '', outputBytes = 0;
        let failure = null;
        const timeout = setTimeout(() => {
            failure = 'Session exceeded replay timeout';
            killChild(child, 'SIGKILL');
        }, TIMEOUT_MS);
        child.stdout.on('data', (data) => {
            outputBytes += data.length;
            if (outputBytes > 128 * 1024) {
                failure = 'Session exceeded bounded output limit';
                killChild(child, 'SIGKILL');
            }
            else
                stdout += data;
        });
        child.stderr.on('data', (data) => {
            outputBytes += data.length;
            stderr = (stderr + data).slice(-4000);
            if (outputBytes > 128 * 1024) {
                failure = 'Session exceeded bounded output limit';
                killChild(child, 'SIGKILL');
            }
        });
        child.on('error', error => { failure = error.message; });
        child.on('close', (code, signal) => {
            clearTimeout(timeout);
            activeChildren.delete(child);
            let result;
            try {
                if (failure || code !== 0)
                    throw new Error(failure || `Worker exit ${code}/${signal}: ${stderr}`);
                const marker = '__RESULT_ONE__';
                const start = stdout.lastIndexOf(marker);
                if (start < 0)
                    throw new Error('Missing scorer result marker');
                const payload = JSON.parse(stdout.slice(start + marker.length).trim());
                result = decodeResult(payload, entry);
                for (const key of metricKeys) {
                    const total = totals[key];
                    const metric = result.metrics[key];
                    if (metric.total !== total) {
                        throw new Error(`Invalid ${key} scorer counts`);
                    }
                }
                result.passed = !result.error && metricKeys.every(key => result.metrics[key].matched === result.metrics[key].total);
            }
            catch (error) {
                result = failedResult(entry, errorMessage(error), totals);
            }
            resolveResult({ ...result, path: entry.path, stratum: entry.stratum });
        });
    });
}
// Score entries with up to JOBS concurrent worker processes. Results arrive in
// completion order; callers must not depend on corpus order.
async function scoreAll(entries, isInterrupted, onResult) {
    let next = 0;
    let stopped = false;
    async function lane() {
        while (!stopped && next < entries.length) {
            if (isInterrupted())
                throw new Error('Corpus interrupted; partial results retained, not a completed score');
            const result = await scoreOne(itemAt(entries, next++));
            if (!stopped)
                onResult(result);
        }
    }
    const lanes = Array.from({ length: Math.min(JOBS, entries.length) }, lane);
    try {
        await Promise.all(lanes);
    }
    catch (error) {
        stopped = true;
        killWorkers('SIGKILL');
        await Promise.allSettled(lanes);
        throw error;
    }
}
async function runCorpus(mode, out) {
    // The public corpus is checked in; it must not need the local dev pool.
    const sample = mode === 'public' ? null : readSample();
    const corpus = mode === 'triage' ? poolEntries()
        : sample && mode === 'eval' ? sample.sessions
            : readdirSync(join(ROOT, 'sessions')).filter(f => f.endsWith('.session.json'))
                .sort().map(file => ({ path: `sessions/${file}`, stratum: 'public' }));
    const shard = corpusShard();
    const entries = shard ? corpus.filter((_, i) => i % shard.count === shard.index) : corpus;
    if (existsSync(out))
        throw new Error(`Output already exists: ${out}. Use a new batch directory.`);
    const release = acquireCorpusLock();
    let interrupted = false;
    const stop = () => { interrupted = true; killWorkers('SIGKILL'); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    const started = new Date().toISOString();
    const results = [];
    try {
        mkdirSync(out, { recursive: true });
        writeFileSync(join(out, 'run.json'), JSON.stringify({ mode, started, pid: process.pid, sessions: entries.length }, null, 2));
        await scoreAll(entries, () => interrupted, result => {
            results.push(result);
            appendFileSync(join(out, 'results.jsonl'), JSON.stringify(result) + '\n');
            if (results.length % 100 === 0 || results.length === entries.length) {
                const s = summarize(results);
                console.error(`${results.length}/${entries.length}: screen ${s.screens.percent.toFixed(2)}%, RNG ${s.rngCalls.percent.toFixed(2)}%, passes ${s.fullPasses}, errors ${s.errors}`);
            }
        });
        if (interrupted)
            throw new Error('Corpus interrupted');
        const samplePaths = new Set(sample?.sessions.map(e => e.path));
        const summary = { mode, started, finished: new Date().toISOString(),
            limits: { timeoutMs: TIMEOUT_MS, heapMb: HEAP_MB, outputBytes: 128 * 1024 },
            adapters: 'frozen isaac64.js, terminal.js, storage.js via load hook',
            metrics: summarize(results),
            strata: Object.fromEntries([...new Set(results.map(r => r.stratum))].map(stratum => [stratum, summarize(results.filter(r => r.stratum === stratum))])),
            ...(mode === 'triage' ? { evalSample: summarize(results.filter(r => samplePaths.has(r.path))),
                clusters: rankClusters(results) } : {}),
        };
        writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
        console.log(JSON.stringify(summary.metrics, null, 2));
    }
    finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        release();
    }
}
function latestTriageDir() {
    const dirs = readdirSync(WORK).filter(d => d.startsWith('triage-')
        && existsSync(join(WORK, d, 'summary.json'))).sort();
    const latest = dirs.at(-1);
    if (!latest)
        throw new Error('No completed triage run; run `triage` first');
    return join(WORK, latest);
}
// Inner loop: rescore only the sessions that a completed triage run grouped
// under one first-divergence function, and show where each one stops now.
async function runCluster(name, triageDir) {
    const dir = triageDir ? resolve(triageDir) : latestTriageDir();
    const before = readFileSync(join(dir, 'results.jsonl'), 'utf8').trim().split('\n')
        .map(line => { const data = JSON.parse(line); return decodeResult(data); }).filter(r => !r.passed && clusterKey(r) === name);
    if (!before.length)
        throw new Error(`No failing sessions in cluster ${name} of ${relative(ROOT, dir)}`);
    const limit = Number(process.env.CLUSTER_LIMIT || 20);
    const chosen = before.sort((a, b) => a.path.localeCompare(b.path)).slice(0, limit);
    const after = new Map();
    await scoreAll(chosen, () => false, r => after.set(r.path, r));
    const moved = {};
    let screenBefore = 0, screenAfter = 0;
    for (const old of chosen) {
        const now = after.get(old.path);
        if (!now)
            throw new Error(`Missing replay result for ${old.path}`);
        screenBefore += old.metrics.screens.matched;
        screenAfter += now.metrics.screens.matched;
        const where = now.passed ? 'PASS' : clusterKey(now);
        moved[where] = (moved[where] || 0) + 1;
        const step = now.firstDivergence?.step ?? '-';
        console.log(`${relative(ROOT, resolve(ROOT, old.path))}  screens ${old.metrics.screens.matched}->${now.metrics.screens.matched}`
            + `/${now.metrics.screens.total}  now: ${where} @ step ${step}${now.error ? `  error: ${resultError(now.error).slice(0, 120)}` : ''}`);
    }
    console.log(`\n${name}: ${chosen.length}/${before.length} sessions rescored against ${relative(ROOT, dir)}`);
    console.log(`screens matched ${screenBefore} -> ${screenAfter}`);
    console.log(`first divergence now: ${JSON.stringify(moved)}`);
}
const [command, output, extra] = process.argv.slice(2);
try {
    if (command === 'freeze')
        freezeSample();
    else if ((command === 'triage' || command === 'eval' || command === 'public') && output)
        await runCorpus(command, resolve(output));
    else if (command === 'cluster' && output)
        await runCluster(output, extra);
    else {
        console.error('Usage: node scripts/triage-holdout.mjs freeze | {triage|eval|public} .cache/generalization/BATCH'
            + ' | cluster FUNCTION [TRIAGE_DIR]');
        process.exitCode = 2;
    }
}
catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
}
//# sourceMappingURL=triage-holdout.mjs.map