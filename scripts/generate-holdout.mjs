#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { RECIPE_NAMES } from './holdout/recipes.mjs';
import { selectRecipes } from './holdout/recipe-selection.mjs';
import { inspectCandidate, summarizeCorpus } from './holdout/inspect.mjs';
import { GENERATOR_KINDS, makeCandidate, parseKind } from './holdout/candidates.mjs';
import { decodeManifest } from './holdout/types.mjs';
import { decodeSession, errorMessage, hasErrorCode, objectValue, arrayValue, numberValue } from './lib/session-types.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL = process.env.NETHACK_INSTALL
    ?? path.join(ROOT, 'nethack-c/recorder/install/games/lib/nethackdir');
const children = new Set();
let stopping = false;
function stopChildren() {
    stopping = true;
    for (const child of children) {
        signalRecorder(child, 'SIGTERM');
    }
}
process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);
function options(argv) {
    const opts = { count: 500, jobs: 2, out: path.join(ROOT, '.cache/holdout-dev/mixed'),
        maxAttempts: 0, resume: false, kinds: ['recipe', 'fuzz', 'explore'] };
    let requestedMaxAttempts = null;
    for (let index = 0; index < argv.length; index++) {
        const flag = argv[index];
        if (flag === '--help')
            return null;
        if (flag === '--resume') {
            opts.resume = true;
            continue;
        }
        const value = argv[++index];
        if (value === undefined)
            throw new Error(`missing value for ${flag}`);
        if (flag === '--count')
            opts.count = Number(value);
        else if (flag === '--jobs')
            opts.jobs = Number(value);
        else if (flag === '--out')
            opts.out = path.resolve(value);
        else if (flag === '--max-attempts')
            requestedMaxAttempts = Number(value);
        else if (flag === '--kinds')
            opts.kinds = value.split(',').map(parseKind);
        else if (flag === '--recipes')
            opts.recipes = selectRecipes(value);
        else
            throw new Error(`unknown option ${flag}`);
    }
    for (const key of ['count', 'jobs']) {
        if (!Number.isSafeInteger(opts[key]) || opts[key] < 1)
            throw new Error(`${key} must be a positive integer`);
    }
    if (opts.jobs > 4)
        throw new Error('use at most four isolated recorder workers');
    if (!opts.kinds.length || opts.kinds.some(kind => !GENERATOR_KINDS.includes(kind))) {
        throw new Error(`kinds must contain ${GENERATOR_KINDS.join(', ')}`);
    }
    if (opts.recipes && !opts.kinds.includes('recipe'))
        throw new Error('--recipes requires recipe in --kinds');
    opts.maxAttempts = requestedMaxAttempts ?? opts.count * 3;
    if (!Number.isSafeInteger(opts.maxAttempts) || opts.maxAttempts < opts.count) {
        throw new Error('max-attempts must be an integer at least count');
    }
    if (opts.out === ROOT || opts.out.startsWith(path.join(ROOT, 'sessions'))) {
        throw new Error('output must not overwrite the public corpus');
    }
    return opts;
}
async function readJson(file, fallback = null) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
    }
    catch (error) {
        if (hasErrorCode(error, 'ENOENT'))
            return fallback;
        throw error;
    }
}
async function atomicJson(file, value) {
    const temporary = `${file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
    await fs.rename(temporary, file);
}
async function reserveOutput(opts) {
    await fs.mkdir(opts.out, { recursive: true });
    const lock = path.join(opts.out, '.active');
    try {
        await fs.mkdir(lock);
    }
    catch (error) {
        if (!hasErrorCode(error, 'EEXIST'))
            throw error;
        const owner = objectValue(await readJson(path.join(lock, 'owner.json'), {}), 'lock owner');
        let live = true;
        if (typeof owner.pid === 'number' && Number.isSafeInteger(owner.pid)) {
            try {
                process.kill(owner.pid, 0);
            }
            catch (error) {
                if (hasErrorCode(error, 'ESRCH'))
                    live = false;
            }
        }
        if (live || !opts.resume)
            throw new Error('output has an active or unclaimed lock; do not launch a duplicate run');
        await fs.rm(lock, { recursive: true });
        await fs.mkdir(lock);
    }
    await atomicJson(path.join(lock, 'owner.json'), { pid: process.pid, started: new Date().toISOString() });
    return lock;
}
async function excludedSeeds() {
    const seeds = new Set();
    const files = await fs.readdir(path.join(ROOT, 'sessions'));
    for (const file of files.filter(file => file.endsWith('.session.json'))) {
        const session = objectValue(await readJson(path.join(ROOT, 'sessions', file)), file);
        for (const value of arrayValue(session.segments ?? [], `${file} segments`)) {
            const segment = objectValue(value, `${file} segment`);
            seeds.add(numberValue(segment.seed, `${file} seed`));
        }
    }
    return seeds;
}
async function record(input, output, install) {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts/record-session.mjs'), input, output], {
        cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NETHACK_BINARY: path.join(install, 'nethack'),
            NETHACK_INSTALL: install, TMPDIR: path.dirname(install), RECORD_SESSION_METADATA: '1', RECORD_SESSION_QUIET: '0' },
    });
    children.add(child);
    let diagnostic = '';
    const collect = (data) => { diagnostic = (diagnostic + data.toString()).slice(-12000); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    let timedOut = false;
    let killTimer;
    const timer = setTimeout(() => {
        timedOut = true;
        signalRecorder(child, 'SIGTERM');
        killTimer = setTimeout(() => { signalRecorder(child, 'SIGKILL'); }, 1500);
    }, 120000);
    try {
        await new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', (code, signal) => {
                if (code === 0 && !timedOut)
                    resolve();
                else
                    reject(new Error(`${timedOut ? 'session wall timeout' : `recorder exit ${code ?? signal}`}\n${diagnostic}`));
            });
        });
    }
    finally {
        clearTimeout(timer);
        clearTimeout(killTimer);
        children.delete(child);
    }
}
async function main() {
    const opts = options(process.argv.slice(2));
    if (!opts) {
        console.log('Usage: node scripts/generate-holdout.mjs [--out DIR] [--count 500] [--jobs 2] [--resume] [--kinds recipe,fuzz,explore,deep,wide,deepwide] [--recipes NAME,...] [--max-attempts N]');
        return;
    }
    const lock = await reserveOutput(opts);
    const runtime = path.join(opts.out, '.runtime');
    try {
        const manifestFile = path.join(opts.out, 'manifest.json');
        const savedManifest = await readJson(manifestFile);
        if (savedManifest !== null && !opts.resume)
            throw new Error('output already contains a batch; pass --resume or choose another directory');
        const manifest = savedManifest === null
            ? { version: 1, tier: 'dev-private', sealed: false, created: new Date().toISOString(),
                accepted: [], rejected: [], pending: [], attempts: 0, configuration: {
                    kinds: opts.kinds, ...(opts.recipes ? { recipes: opts.recipes } : {}),
                } }
            : decodeManifest(savedManifest);
        if (manifest.configuration.kinds.join(',') !== opts.kinds.join(',')) {
            throw new Error('resume must use the original --kinds; use a separate directory for another mix');
        }
        if ((manifest.configuration.recipes ?? []).join(',') !== (opts.recipes ?? []).join(',')) {
            throw new Error('resume must use the original --recipes; use a separate directory for another selection');
        }
        for (const pending of manifest.pending) {
            const completed = await readJson(path.join(opts.out, pending.file), null);
            if (completed) {
                manifest.accepted.push({ ...pending, metrics: inspectCandidate(pending.spec, decodeSession(completed)) });
            }
            else {
                manifest.rejected.push({ spec: pending.spec, reason: 'recording interrupted before acceptance' });
            }
        }
        manifest.pending = [];
        const seeds = await excludedSeeds();
        for (const row of [...manifest.accepted, ...manifest.rejected]) {
            for (let offset = 0; offset < 16; offset++)
                seeds.add(row.spec.seed + offset);
        }
        // On resume validate the artifacts, not only the saved count.
        for (const row of manifest.accepted) {
            row.metrics = inspectCandidate(row.spec, decodeSession(await readJson(path.join(opts.out, row.file))));
        }
        await fs.rm(runtime, { recursive: true, force: true });
        for (const directory of ['sessions', 'plans', 'rejected', '.runtime']) {
            await fs.mkdir(path.join(opts.out, directory), { recursive: true });
        }
        const save = async () => {
            manifest.updated = new Date().toISOString();
            await atomicJson(manifestFile, manifest);
            await atomicJson(path.join(opts.out, 'summary.json'), {
                ...summarizeCorpus(manifest.accepted), rejected: manifest.rejected.length,
                rejectionReasons: manifest.rejected.reduce((counts, row) => {
                    counts[row.reason] = (counts[row.reason] ?? 0) + 1;
                    return counts;
                }, {}),
                attempts: manifest.attempts, target: opts.count,
            });
        };
        let saveChain = Promise.resolve();
        const checkpoint = () => { saveChain = saveChain.then(save); return saveChain; };
        let inFlight = 0;
        const worker = async (workerIndex) => {
            const install = path.join(runtime, `worker-${workerIndex}`);
            await fs.rm(install, { recursive: true, force: true });
            await fs.cp(INSTALL, install, { recursive: true });
            while (!stopping && manifest.accepted.length + inFlight < opts.count
                && manifest.attempts < opts.maxAttempts) {
                inFlight++;
                const index = manifest.attempts++;
                const candidate = makeCandidate(index, seeds, opts.kinds, opts.recipes ?? RECIPE_NAMES);
                const { spec, session } = candidate;
                const planPath = path.join(opts.out, 'plans', `${spec.id}.json`);
                const partial = path.join(runtime, `${spec.id}.partial.json`);
                await atomicJson(planPath, session);
                const file = `sessions/${spec.id}.session.json`;
                manifest.pending.push({ spec, file });
                await checkpoint();
                try {
                    await record(planPath, partial, install);
                    const recorded = decodeSession(await readJson(partial));
                    const metrics = inspectCandidate(spec, recorded);
                    await fs.rename(partial, path.join(opts.out, file));
                    manifest.accepted.push({ spec, file, metrics });
                }
                catch (error) {
                    const diagnostic = `rejected/${spec.id}.txt`;
                    const message = errorMessage(error);
                    await fs.writeFile(path.join(opts.out, diagnostic), message + '\n');
                    manifest.rejected.push({ spec, diagnostic, reason: message.split('\n')[0] ?? message });
                    await fs.rm(partial, { force: true });
                }
                finally {
                    inFlight--;
                    manifest.pending = manifest.pending.filter(row => row.spec.id !== spec.id);
                }
                await checkpoint();
                if (manifest.accepted.length % 10 === 0 || manifest.attempts <= opts.jobs) {
                    console.log(`accepted=${manifest.accepted.length} rejected=${manifest.rejected.length} attempts=${manifest.attempts} target=${opts.count}`);
                }
            }
        };
        const workers = await Promise.allSettled(Array.from({ length: opts.jobs }, (_, index) => worker(index)));
        await checkpoint();
        const failedWorker = workers.find(result => result.status === 'rejected');
        if (failedWorker)
            throw failedWorker.reason;
        console.log(JSON.stringify({ ...summarizeCorpus(manifest.accepted), rejected: manifest.rejected.length }, null, 2));
        if (stopping || manifest.accepted.length < opts.count)
            process.exitCode = 1;
    }
    finally {
        stopChildren();
        await fs.rm(runtime, { recursive: true, force: true });
        await fs.rm(lock, { recursive: true, force: true });
    }
}
void main().catch((error) => { console.error(errorMessage(error)); process.exitCode = 1; });
function signalRecorder(child, signal) {
    if (child.pid === undefined)
        return;
    try {
        process.kill(-child.pid, signal);
    }
    catch (error) {
        if (!hasErrorCode(error, 'ESRCH'))
            throw error;
    }
}
//# sourceMappingURL=generate-holdout.mjs.map