import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const SPEC_SCHEMA = 'teleport.sealed-corpus-spec.v1';
export const MANIFEST_SCHEMA = 'teleport.sealed-corpus-manifest.v1';
export const PLAN_SCHEMA = 'teleport.sealed-corpus-private-plan.v1';
export const RECORDING_SCHEMA = 'teleport.sealed-corpus-recording.v1';
export const EVALUATION_STATE_SCHEMA = 'teleport.sealed-corpus-evaluation-state.v1';
export const RESULT_SCHEMA = 'teleport.sealed-corpus-result.v1';
export const RELEASE_SCHEMA = 'teleport.sealed-corpus-release.v1';

const SECRET_MIN_BYTES = 32;
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o400;
const MUTABLE_PRIVATE_FILE_MODE = 0o600;
const PUBLIC_FILE_MODE = 0o444;
const MAX_CAPTURE_BYTES = 1024 * 1024;

function isPlainObject(value) {
    return value !== null && typeof value === 'object'
        && !Array.isArray(value);
}

export function canonicalJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(',')}]`;
    }
    if (isPlainObject(value)) {
        const entries = Object.keys(value).sort().map(key =>
            `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
        return `{${entries.join(',')}}`;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new Error('non-finite numbers are not canonical JSON');
    }
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('unsupported canonical JSON value');
    return encoded;
}

export function sha256(value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    return crypto.createHash('sha256').update(bytes).digest('hex');
}

function hmac(secret, label, value = '') {
    return crypto.createHmac('sha256', secret)
        .update(label)
        .update('\0')
        .update(typeof value === 'string' ? value : canonicalJson(value))
        .digest('hex');
}

function signState(secret, label, state) {
    const base = { ...state };
    delete base.commitment;
    return { ...base, commitment: hmac(secret, label, base) };
}

function verifyState(secret, label, state) {
    const expected = signState(secret, label, state).commitment;
    return timingSafeHexEqual(state?.commitment, expected);
}

function timingSafeHexEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string'
        || left.length !== right.length || left.length % 2 !== 0) return false;
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export async function readSecret(secretPath) {
    const stat = await fsp.stat(secretPath);
    if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
        throw new Error('gate secret must not be readable by group or other users');
    }
    const value = await fsp.readFile(secretPath);
    if (value.length < SECRET_MIN_BYTES) {
        throw new Error(`gate secret must contain at least ${SECRET_MIN_BYTES} bytes`);
    }
    return value;
}

const RUNTIME_MUTABLE_NAMES = new Set([
    'record', 'xlogfile', 'logfile', 'livelog', 'paniclog',
]);

async function runtimeFiles(root, relative = '') {
    const directory = path.join(root, relative);
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const childRelative = relative ? path.join(relative, entry.name) : entry.name;
        if (entry.isDirectory()) {
            if (entry.name === 'save') continue;
            files.push(...await runtimeFiles(root, childRelative));
        } else if (entry.isFile()) {
            if (RUNTIME_MUTABLE_NAMES.has(entry.name)
                || /^\d+[^/]*\.\d+$/.test(entry.name)) continue;
            files.push(childRelative.split(path.sep).join('/'));
        }
    }
    return files;
}

export async function recorderRuntimeAttestation(repoRoot) {
    const binary = path.resolve(process.env.NETHACK_BINARY
        || path.join(repoRoot, 'nethack-c', 'recorder', 'install', 'games', 'lib', 'nethackdir', 'nethack'));
    const install = path.resolve(process.env.NETHACK_INSTALL
        || path.join(repoRoot, 'nethack-c', 'recorder', 'install', 'games', 'lib', 'nethackdir'));
    const binarySha256 = sha256(await fsp.readFile(binary));
    const files = await runtimeFiles(install);
    const runtimeEntries = [];
    for (const name of files) {
        runtimeEntries.push({ name, sha256: sha256(await fsp.readFile(path.join(install, name))) });
    }
    return {
        recorderBinarySha256: binarySha256,
        recorderRuntimeSha256: sha256(canonicalJson(runtimeEntries)),
    };
}

function prfUInt32(secret, label) {
    const bytes = crypto.createHmac('sha256', secret).update(label).digest();
    return bytes.readUInt32BE(0);
}

function pick(secret, label, values) {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`cannot choose from empty stratum: ${label}`);
    }
    return values[prfUInt32(secret, label) % values.length];
}

function derivedName(secret, label) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const bytes = crypto.createHmac('sha256', secret).update(`name\0${label}`).digest();
    let value = 'Gate';
    for (let i = 0; i < 10; i++) value += alphabet[bytes[i] % alphabet.length];
    return value;
}

function derivedSeed(secret, label) {
    return 1 + (prfUInt32(secret, `seed\0${label}`) % 0x7ffffffe);
}

function derivedDatetime(secret, label, dateRange) {
    const start = Date.parse(`${dateRange.start}T00:00:00Z`);
    const end = Date.parse(`${dateRange.end}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        throw new Error('invalid generator.dateRange');
    }
    const days = Math.floor((end - start) / 86400000) + 1;
    const dayOffset = prfUInt32(secret, `date-day\0${label}`) % days;
    const secondOffset = prfUInt32(secret, `date-time\0${label}`) % 86400;
    const value = new Date(start + dayOffset * 86400000 + secondOffset * 1000);
    const pad = number => String(number).padStart(2, '0');
    return String(value.getUTCFullYear())
        + pad(value.getUTCMonth() + 1)
        + pad(value.getUTCDate())
        + pad(value.getUTCHours())
        + pad(value.getUTCMinutes())
        + pad(value.getUTCSeconds());
}

function calendarFamily(datetime) {
    const year = Number(datetime.slice(0, 4));
    const month = Number(datetime.slice(4, 6));
    const day = Number(datetime.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (day === 13 && date.getUTCDay() === 5) return 'friday-13';
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) return 'weekend';
    return 'weekday';
}

function expandLegalCharacters(spec) {
    const profiles = [];
    for (const role of spec.characters || []) {
        for (const raceRule of role.races || []) {
            for (const gender of role.genders || []) {
                for (const alignment of raceRule.alignments || []) {
                    profiles.push({
                        role: role.role,
                        race: raceRule.race,
                        gender,
                        alignment,
                    });
                }
            }
        }
    }
    return profiles;
}

function validateProgram(program) {
    for (const key of [
        'id', 'commandFamily', 'worldFamily', 'optionFamily', 'runmode',
        'playmode',
    ]) {
        if (typeof program[key] !== 'string' || !program[key]) {
            throw new Error(`program ${program.id || '<unknown>'} lacks ${key}`);
        }
    }
    if (program.segments !== undefined && !Array.isArray(program.segments)) {
        throw new Error(`program ${program.id} segments must be an array`);
    }
    if (program.moves !== undefined && typeof program.moves !== 'string') {
        throw new Error(`program ${program.id} moves must be a string`);
    }
    for (const segment of program.segments || []) {
        if (segment.moves !== undefined && typeof segment.moves !== 'string') {
            throw new Error(`program ${program.id} segment moves must be a string`);
        }
        if (segment.driver !== undefined && !Array.isArray(segment.driver)) {
            throw new Error(`program ${program.id} segment driver must be an array`);
        }
        if (segment.moves !== undefined && segment.driver !== undefined) {
            throw new Error(`program ${program.id} segment cannot have moves and driver`);
        }
    }
}

export function validateSpec(spec) {
    if (spec?.schema !== SPEC_SCHEMA) throw new Error(`expected ${SPEC_SCHEMA}`);
    if (typeof spec.corpusVersion !== 'string' || !spec.corpusVersion) {
        throw new Error('spec corpusVersion is required');
    }
    if (!Array.isArray(spec.characters) || spec.characters.length === 0) {
        throw new Error('spec characters are required');
    }
    if (!Array.isArray(spec.programs) || spec.programs.length === 0) {
        throw new Error('spec programs are required');
    }
    const ids = new Set();
    for (const program of spec.programs) {
        validateProgram(program);
        if (ids.has(program.id)) throw new Error(`duplicate program ${program.id}`);
        ids.add(program.id);
    }
    if (!ids.has(spec.generator?.characterProgram)) {
        throw new Error('generator.characterProgram does not name a program');
    }
    const profiles = expandLegalCharacters(spec);
    const profileKeys = new Set(profiles.map(profile => canonicalJson(profile)));
    if (profiles.length === 0 || profileKeys.size !== profiles.length) {
        throw new Error('legal character matrix is empty or contains duplicates');
    }
    const dateRange = spec.generator?.dateRange;
    derivedDatetime(Buffer.alloc(32, 1), 'spec-validation', dateRange || {});
    const policy = spec.failureSamplePolicy;
    if (!policy || policy.strategy !== 'keyed-rank-per-stratum'
        || !Number.isInteger(policy.maxTotal) || policy.maxTotal < 0
        || !Number.isInteger(policy.maxPerValue) || policy.maxPerValue < 0
        || typeof policy.dimension !== 'string' || !policy.dimension) {
        throw new Error('invalid failureSamplePolicy');
    }
    if (!Number.isInteger(spec.evaluationPolicy?.minAggregateCell)
        || spec.evaluationPolicy.minAggregateCell < 2) {
        throw new Error('evaluationPolicy.minAggregateCell must be at least 2');
    }
    return { profiles, programs: new Map(spec.programs.map(p => [p.id, p])) };
}

function rcFor(secret, label, profile, program, spec) {
    const baseOptions = spec.generator.baseOptions || [];
    const options = [...baseOptions, ...(program.options || [])];
    if (program.playmode !== 'normal') options.push(`playmode:${program.playmode}`);
    options.push(`runmode:${program.runmode}`);
    return [
        `OPTIONS=name:${derivedName(secret, label)},role:${profile.role},race:${profile.race},gender:${profile.gender},align:${profile.alignment}`,
        `OPTIONS=${options.join(',')}`,
        '',
    ].join('\n');
}

function sessionFor(secret, label, profile, program, spec) {
    const seed = derivedSeed(secret, label);
    const datetime = derivedDatetime(secret, label, spec.generator.dateRange);
    const nethackrc = rcFor(secret, label, profile, program, spec);
    const segmentTemplates = program.segments || [{ moves: program.moves || '' }];
    const segments = segmentTemplates.map(segment => {
        const output = {
            seed,
            datetime,
            nethackrc,
            moves: segment.moves || '',
            steps: [],
        };
        if (segment.driver) output.driver = segment.driver;
        return output;
    });
    return {
        document: { version: 5, source: 'c', segments },
        strata: {
            role: profile.role,
            race: profile.race,
            gender: profile.gender,
            alignment: profile.alignment,
            optionFamily: program.optionFamily,
            runmode: program.runmode,
            playmode: program.playmode,
            scenarioFamily: program.id,
            commandFamily: program.commandFamily,
            worldFamily: program.worldFamily,
            lifecycle: segmentTemplates.length > 1 ? 'save-restore' : 'single-process',
            calendarFamily: calendarFamily(datetime),
        },
    };
}

function allowedProfiles(allProfiles, program) {
    if (!Array.isArray(program.roles) || program.roles.length === 0) return allProfiles;
    const allowed = new Set(program.roles);
    const result = allProfiles.filter(profile => allowed.has(profile.role));
    if (result.length === 0) throw new Error(`program ${program.id} permits no profile`);
    return result;
}

function incrementStrata(strata, sessionStrata) {
    for (const [dimension, value] of Object.entries(sessionStrata)) {
        strata[dimension] ||= {};
        strata[dimension][value] = (strata[dimension][value] || 0) + 1;
    }
}

export function buildPrivatePlan({ spec, gateId, secret, revisions }) {
    const { profiles, programs } = validateSpec(spec);
    if (typeof gateId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(gateId)) {
        throw new Error('gateId must be a 3-64 character stable identifier');
    }
    if (!Buffer.isBuffer(secret) || secret.length < SECRET_MIN_BYTES) {
        throw new Error('invalid in-memory gate secret');
    }
    const sessions = [];
    const characterProgram = programs.get(spec.generator.characterProgram);

    for (let i = 0; i < profiles.length; i++) {
        const label = `character\0${i}\0${canonicalJson(profiles[i])}`;
        sessions.push(sessionFor(secret, label, profiles[i], characterProgram, spec));
    }

    for (const program of spec.programs) {
        if (program.id === characterProgram.id) continue;
        const repetitions = program.repetitions || 0;
        if (!Number.isInteger(repetitions) || repetitions < 1) {
            throw new Error(`coverage program ${program.id} needs repetitions >= 1`);
        }
        const choices = allowedProfiles(profiles, program);
        for (let repetition = 0; repetition < repetitions; repetition++) {
            const label = `program\0${program.id}\0${repetition}`;
            const profile = pick(secret, `${label}\0profile`, choices);
            sessions.push(sessionFor(secret, label, profile, program, spec));
        }
    }

    const specSha256 = sha256(canonicalJson(spec));
    const withIds = sessions.map((session, index) => {
        const commitment = hmac(secret, 'session-recipe', {
            gateId, index, strata: session.strata, document: session.document,
        });
        const opaqueId = hmac(secret, 'opaque-session-id', {
            gateId, index, commitment,
        }).slice(0, 32);
        return { opaqueId, commitment, ...session };
    });
    if (new Set(withIds.map(s => s.opaqueId)).size !== withIds.length) {
        throw new Error('opaque session identifier collision');
    }
    const planBase = {
        schema: PLAN_SCHEMA,
        gateId,
        corpusVersion: spec.corpusVersion,
        specSha256,
        revisions,
        sessions: withIds,
    };
    return { ...planBase, commitment: hmac(secret, 'private-plan', planBase) };
}

export function publicManifestFor({ spec, plan, secret }) {
    const strata = {};
    for (const session of plan.sessions) incrementStrata(strata, session.strata);
    const commitments = plan.sessions.map(session => session.commitment).sort();
    return {
        schema: MANIFEST_SCHEMA,
        gateId: plan.gateId,
        corpusVersion: plan.corpusVersion,
        sessionCount: plan.sessions.length,
        strata,
        generationRecipe: {
            algorithm: 'hmac-sha256-stratified-v1',
            specSchema: spec.schema,
            specSha256: plan.specSha256,
            characterExpansion: 'all-legal-role-race-gender-alignment-tuples',
            coverageExpansion: 'declared-program-repetitions',
        },
        revisions: plan.revisions,
        evaluationPolicy: spec.evaluationPolicy,
        failureSamplePolicy: spec.failureSamplePolicy,
        commitments: {
            keyCheck: hmac(secret, 'key-check', plan.gateId),
            privatePlan: plan.commitment,
            sessions: commitments,
        },
    };
}

async function writeExclusive(filePath, value, mode) {
    const handle = await fsp.open(filePath, 'wx', mode);
    try {
        await handle.writeFile(value);
        await handle.sync();
    } finally {
        await handle.close();
    }
    await fsp.chmod(filePath, mode);
}

async function atomicWrite(filePath, value, mode = MUTABLE_PRIVATE_FILE_MODE) {
    const tmp = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
    await fsp.writeFile(tmp, value, { mode, flag: 'wx' });
    await fsp.chmod(tmp, mode);
    await fsp.rename(tmp, filePath);
}

export async function prepareSealedCorpus({ gateRoot, spec, gateId, secret, revisions }) {
    const root = path.resolve(gateRoot);
    if (fs.existsSync(root)) {
        throw new Error('gate root already exists; resampling is forbidden');
    }
    const stageRoot = `${root}.preparing-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
    try {
        await fsp.mkdir(stageRoot, { mode: PRIVATE_DIR_MODE });
        const privateDir = path.join(stageRoot, 'private');
        await fsp.mkdir(privateDir, { mode: PRIVATE_DIR_MODE });
        await fsp.mkdir(path.join(privateDir, 'raw'), { mode: PRIVATE_DIR_MODE });
        await fsp.mkdir(path.join(privateDir, 'state'), { mode: PRIVATE_DIR_MODE });

        const plan = buildPrivatePlan({ spec, gateId, secret, revisions });
        const manifest = publicManifestFor({ spec, plan, secret });
        await writeExclusive(path.join(privateDir, 'plan.json'),
            `${JSON.stringify(plan, null, 2)}\n`, PRIVATE_FILE_MODE);
        await writeExclusive(path.join(stageRoot, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`, PUBLIC_FILE_MODE);
        await fsp.rename(stageRoot, root);
        return { root, plan, manifest };
    } catch (error) {
        await fsp.rm(stageRoot, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

async function readJson(filePath) {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}

export async function loadAndVerifyGate(gateRoot, secret) {
    const root = path.resolve(gateRoot);
    const manifestPath = path.join(root, 'manifest.json');
    const planPath = path.join(root, 'private', 'plan.json');
    const [manifest, plan] = await Promise.all([
        readJson(manifestPath), readJson(planPath),
    ]);
    if (manifest.schema !== MANIFEST_SCHEMA || plan.schema !== PLAN_SCHEMA) {
        throw new Error('unsupported sealed corpus artifact schema');
    }
    if (manifest.gateId !== plan.gateId
        || manifest.corpusVersion !== plan.corpusVersion
        || manifest.sessionCount !== plan.sessions.length) {
        throw new Error('manifest/private plan identity mismatch');
    }
    const expectedKeyCheck = hmac(secret, 'key-check', plan.gateId);
    if (!timingSafeHexEqual(manifest.commitments?.keyCheck, expectedKeyCheck)) {
        throw new Error('gate secret does not match manifest');
    }
    const planBase = { ...plan };
    delete planBase.commitment;
    const expectedPlan = hmac(secret, 'private-plan', planBase);
    if (!timingSafeHexEqual(plan.commitment, expectedPlan)
        || !timingSafeHexEqual(manifest.commitments?.privatePlan, expectedPlan)) {
        throw new Error('private plan commitment mismatch');
    }
    const commitments = [];
    for (let index = 0; index < plan.sessions.length; index++) {
        const session = plan.sessions[index];
        const expected = hmac(secret, 'session-recipe', {
            gateId: plan.gateId,
            index,
            strata: session.strata,
            document: session.document,
        });
        const expectedOpaqueId = hmac(secret, 'opaque-session-id', {
            gateId: plan.gateId, index, commitment: expected,
        }).slice(0, 32);
        if (!timingSafeHexEqual(session.commitment, expected)
            || session.opaqueId !== expectedOpaqueId) {
            throw new Error('session recipe commitment mismatch');
        }
        commitments.push(expected);
    }
    const publicCommitments = [...(manifest.commitments?.sessions || [])].sort();
    if (canonicalJson(commitments.sort()) !== canonicalJson(publicCommitments)) {
        throw new Error('public session commitment set mismatch');
    }
    return { root, manifest, plan, manifestPath, planPath };
}

function sameSegmentIdentity(recorded, planned) {
    return recorded?.seed === planned.seed
        && recorded?.datetime === planned.datetime
        && recorded?.nethackrc === planned.nethackrc
        && (planned.driver
            ? typeof recorded?.moves === 'string' && recorded.moves.length > 0
                && recorded.driver === undefined
            : recorded?.moves === planned.moves);
}

async function validateRecordedSession(rawPath, plannedDocument) {
    const recorded = await readJson(rawPath);
    if (recorded?.version !== 5 || !Array.isArray(recorded.segments)
        || recorded.segments.length !== plannedDocument.segments.length) {
        throw new Error('recorder returned an invalid session shape');
    }
    for (let i = 0; i < recorded.segments.length; i++) {
        if (!sameSegmentIdentity(recorded.segments[i], plannedDocument.segments[i])) {
            throw new Error('recorder changed a sealed session identity');
        }
        if (!Array.isArray(recorded.segments[i].steps)
            || recorded.segments[i].steps.length === 0) {
            throw new Error('recorder returned no C boundaries');
        }
    }
    return recorded;
}

export async function runOwnedChild(command, args, {
    cwd, env, timeoutMs = 120000, maxCaptureBytes = MAX_CAPTURE_BYTES,
} = {}) {
    return await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            env,
            detached: process.platform !== 'win32',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = Buffer.alloc(0);
        let stderr = Buffer.alloc(0);
        let settled = false;
        let timer;
        let forceKillTimer;
        let terminalError = null;
        const killTree = signal => {
            try {
                if (process.platform === 'win32') child.kill(signal);
                else process.kill(-child.pid, signal);
            } catch {}
        };
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            if (forceKillTimer) clearTimeout(forceKillTimer);
            process.off('SIGINT', onInterrupt);
            process.off('SIGTERM', onTerminate);
            if (error) reject(error);
            else resolve(result);
        };
        const append = (current, chunk) => {
            const next = Buffer.concat([current, chunk]);
            if (next.length > maxCaptureBytes) {
                terminate(new Error('owned child exceeded its bounded output allowance'));
                return current;
            }
            return next;
        };
        const terminate = error => {
            if (settled || terminalError) return;
            terminalError = error;
            killTree('SIGTERM');
            forceKillTimer = setTimeout(() => killTree('SIGKILL'), 1000);
            forceKillTimer.unref();
        };
        const onInterrupt = () => {
            terminate(new Error('owned child interrupted'));
        };
        const onTerminate = onInterrupt;
        process.once('SIGINT', onInterrupt);
        process.once('SIGTERM', onTerminate);
        child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
        child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
        child.on('error', error => {
            terminalError = error;
        });
        child.on('close', (code, signal) => {
            if (terminalError) finish(terminalError);
            else finish(null, {
                code, signal, stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'),
            });
        });
        timer = setTimeout(() => {
            terminate(new Error('owned child timed out'));
        }, timeoutMs);
        timer.unref();
    });
}

async function defaultRecorder({ inputPath, outputPath, repoRoot }) {
    const result = await runOwnedChild(process.execPath, [
        path.join(repoRoot, 'scripts', 'record-session.mjs'), inputPath, outputPath,
    ], {
        cwd: repoRoot,
        env: { ...process.env, RECORD_SESSION_QUIET: '1' },
        timeoutMs: Number(process.env.SEALED_RECORD_TIMEOUT_MS || 180000),
    });
    if (result.code !== 0) throw new Error('sealed recorder failed');
}

function rawCorpusCommitment(entries) {
    return sha256(canonicalJson(entries
        .map(entry => ({ opaqueId: entry.opaqueId, sha256: entry.sha256 }))
        .sort((a, b) => a.opaqueId.localeCompare(b.opaqueId))));
}

export async function recordSealedCorpus({
    gateRoot, secret, repoRoot, invokeRecorder = defaultRecorder, onProgress,
}) {
    const gate = await loadAndVerifyGate(gateRoot, secret);
    if (gate.plan.revisions?.recorderBinarySha256
        || gate.plan.revisions?.recorderRuntimeSha256) {
        const currentRuntime = await recorderRuntimeAttestation(repoRoot);
        if (currentRuntime.recorderBinarySha256
                !== gate.plan.revisions.recorderBinarySha256
            || currentRuntime.recorderRuntimeSha256
                !== gate.plan.revisions.recorderRuntimeSha256) {
            throw new Error('C recorder runtime differs from the committed manifest');
        }
    }
    const privateDir = path.join(gate.root, 'private');
    const rawDir = path.join(privateDir, 'raw');
    const statePath = path.join(privateDir, 'state', 'recording.json');
    const privateReceiptPath = path.join(privateDir, 'recording-receipt.json');
    const publicReceiptPath = path.join(gate.root, 'recording-receipt.json');
    if (fs.existsSync(privateReceiptPath) || fs.existsSync(publicReceiptPath)) {
        throw new Error('sealed corpus has already been recorded');
    }
    let state = { schema: RECORDING_SCHEMA, gateId: gate.plan.gateId, entries: [] };
    if (fs.existsSync(statePath)) {
        state = await readJson(statePath);
        if (!verifyState(secret, 'recording-state', state)) {
            throw new Error('recording resume state commitment mismatch');
        }
    }
    if (state.schema !== RECORDING_SCHEMA || state.gateId !== gate.plan.gateId) {
        throw new Error('invalid recording resume state');
    }
    const plannedIds = new Set(gate.plan.sessions.map(session => session.opaqueId));
    const completed = new Map();
    for (const entry of state.entries) {
        if (!plannedIds.has(entry.opaqueId) || completed.has(entry.opaqueId)) {
            throw new Error('recording resume state names an invalid session');
        }
        completed.set(entry.opaqueId, entry);
    }

    for (let index = 0; index < gate.plan.sessions.length; index++) {
        const session = gate.plan.sessions[index];
        const rawPath = path.join(rawDir, `${session.opaqueId}.session.json`);
        const prior = completed.get(session.opaqueId);
        if (prior) {
            const recorded = await validateRecordedSession(rawPath, session.document);
            const digest = sha256(await fsp.readFile(rawPath));
            if (digest !== prior.sha256) throw new Error('recorded trace changed during resume');
            void recorded;
            onProgress?.(index + 1, gate.plan.sessions.length);
            continue;
        }
        const inputPath = path.join(privateDir, 'state', `${session.opaqueId}.input.json`);
        const partialPath = `${rawPath}.partial`;
        // These are incomplete private work files from the same committed
        // recipe, never accepted evidence. An uncheckpointed raw file is also
        // discarded and re-recorded from the identical recipe rather than
        // trusted. This does not select or resample another session.
        await fsp.rm(inputPath, { force: true }).catch(() => {});
        await fsp.rm(partialPath, { force: true }).catch(() => {});
        await fsp.rm(rawPath, { force: true }).catch(() => {});
        await fsp.writeFile(inputPath, `${JSON.stringify(session.document)}\n`, {
            mode: MUTABLE_PRIVATE_FILE_MODE, flag: 'wx',
        });
        try {
            await invokeRecorder({ inputPath, outputPath: partialPath, repoRoot });
            await validateRecordedSession(partialPath, session.document);
            await fsp.chmod(partialPath, PRIVATE_FILE_MODE);
            await fsp.rename(partialPath, rawPath);
            const entry = { opaqueId: session.opaqueId, sha256: sha256(await fsp.readFile(rawPath)) };
            state.entries.push(entry);
            completed.set(entry.opaqueId, entry);
            state = signState(secret, 'recording-state', state);
            await atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`);
        } finally {
            await fsp.rm(inputPath, { force: true }).catch(() => {});
            await fsp.rm(partialPath, { force: true }).catch(() => {});
        }
        onProgress?.(index + 1, gate.plan.sessions.length);
    }
    const corpusCommitment = rawCorpusCommitment(state.entries);
    const privateReceiptBase = {
        schema: RECORDING_SCHEMA,
        gateId: gate.plan.gateId,
        manifestSha256: sha256(await fsp.readFile(gate.manifestPath)),
        sessionCount: state.entries.length,
        corpusCommitment,
        entries: [...state.entries].sort((a, b) => a.opaqueId.localeCompare(b.opaqueId)),
    };
    const privateReceipt = {
        ...privateReceiptBase,
        commitment: hmac(secret, 'recording-receipt', privateReceiptBase),
    };
    const publicReceipt = {
        schema: RECORDING_SCHEMA,
        gateId: gate.plan.gateId,
        manifestSha256: privateReceipt.manifestSha256,
        sessionCount: privateReceipt.sessionCount,
        corpusCommitment,
        privateReceiptCommitment: privateReceipt.commitment,
    };
    await writeExclusive(privateReceiptPath,
        `${JSON.stringify(privateReceipt, null, 2)}\n`, PRIVATE_FILE_MODE);
    await writeExclusive(publicReceiptPath,
        `${JSON.stringify(publicReceipt, null, 2)}\n`, PUBLIC_FILE_MODE);
    await fsp.rm(statePath, { force: true });
    return publicReceipt;
}

async function verifyRecording(gate, secret) {
    const privateReceiptPath = path.join(gate.root, 'private', 'recording-receipt.json');
    const publicReceiptPath = path.join(gate.root, 'recording-receipt.json');
    const [privateReceipt, publicReceipt] = await Promise.all([
        readJson(privateReceiptPath), readJson(publicReceiptPath),
    ]);
    if (privateReceipt.schema !== RECORDING_SCHEMA
        || publicReceipt.schema !== RECORDING_SCHEMA
        || privateReceipt.gateId !== gate.plan.gateId
        || publicReceipt.gateId !== gate.plan.gateId
        || privateReceipt.corpusCommitment !== publicReceipt.corpusCommitment
        || privateReceipt.commitment !== publicReceipt.privateReceiptCommitment
        || privateReceipt.sessionCount !== gate.plan.sessions.length) {
        throw new Error('recording receipt mismatch');
    }
    const privateReceiptBase = { ...privateReceipt };
    delete privateReceiptBase.commitment;
    const expectedReceipt = hmac(secret, 'recording-receipt', privateReceiptBase);
    if (!timingSafeHexEqual(privateReceipt.commitment, expectedReceipt)) {
        throw new Error('recording receipt commitment mismatch');
    }
    const entries = new Map(privateReceipt.entries.map(entry => [entry.opaqueId, entry]));
    for (const session of gate.plan.sessions) {
        const entry = entries.get(session.opaqueId);
        if (!entry) throw new Error('recording receipt omits a planned session');
        const rawPath = path.join(gate.root, 'private', 'raw', `${session.opaqueId}.session.json`);
        const digest = sha256(await fsp.readFile(rawPath));
        if (digest !== entry.sha256) throw new Error('sealed raw trace commitment mismatch');
    }
    if (rawCorpusCommitment(privateReceipt.entries) !== privateReceipt.corpusCommitment) {
        throw new Error('raw corpus commitment mismatch');
    }
    return { privateReceipt, publicReceipt };
}

function emptyAggregate() {
    return {
        sessions: { passed: 0, total: 0, errored: 0 },
        rngCalls: { matched: 0, total: 0 },
        screens: { matched: 0, total: 0 },
    };
}

function addResult(aggregate, result) {
    aggregate.sessions.total++;
    if (result.passed) aggregate.sessions.passed++;
    if (result.error) aggregate.sessions.errored++;
    for (const metric of ['rngCalls', 'screens']) {
        aggregate[metric].matched += Number(result.metrics?.[metric]?.matched || 0);
        aggregate[metric].total += Number(result.metrics?.[metric]?.total || 0);
    }
}

function normalizeEvaluationResult(value) {
    const metrics = {};
    let invalid = false;
    for (const metric of ['rngCalls', 'screens']) {
        const matched = Number(value?.metrics?.[metric]?.matched);
        const total = Number(value?.metrics?.[metric]?.total);
        if (!Number.isFinite(matched) || !Number.isFinite(total)
            || matched < 0 || total < 0 || matched > total) {
            invalid = true;
            metrics[metric] = { matched: 0, total: 0 };
        } else {
            metrics[metric] = { matched, total };
        }
    }
    const error = value?.error ? 'game-error' : (invalid ? 'worker-protocol' : null);
    return {
        passed: value?.passed === true && !error,
        metrics,
        error,
    };
}

function buildAggregate(results, manifest, minAggregateCell) {
    const overall = emptyAggregate();
    const dimensions = {};
    for (const dimension of Object.keys(manifest.strata).sort()) dimensions[dimension] = {};
    for (const item of results) {
        addResult(overall, item.result);
        for (const [dimension, value] of Object.entries(item.strata)) {
            dimensions[dimension][value] ||= emptyAggregate();
            addResult(dimensions[dimension][value], item.result);
        }
    }
    for (const values of Object.values(dimensions)) {
        for (const [value, aggregate] of Object.entries(values)) {
            if (aggregate.sessions.total < minAggregateCell) {
                values[value] = { sessions: { total: aggregate.sessions.total }, suppressed: true };
            }
        }
    }
    return { overall, strata: dimensions };
}

async function defaultEvaluator({ rawPath, repoRoot }) {
    const result = await runOwnedChild(process.execPath, [
        path.join(repoRoot, 'frozen', 'ps_test_runner.mjs'),
        `--worker-session=${rawPath}`,
    ], {
        cwd: repoRoot,
        env: {
            ...process.env,
            TELEPORT_BRIDGE_FREE: '1',
            TELEPORT_DISABLE_FIXTURES: '1',
        },
        timeoutMs: Number(process.env.SEALED_EVAL_TIMEOUT_MS || 120000),
        maxCaptureBytes: 8 * 1024 * 1024,
    });
    if (result.code !== 0) return { passed: false, metrics: {}, error: 'worker-failed' };
    const marker = '__RESULT_ONE__';
    const index = result.stdout.lastIndexOf(marker);
    if (index < 0) return { passed: false, metrics: {}, error: 'worker-protocol' };
    try {
        const parsed = JSON.parse(result.stdout.slice(index + marker.length).trim());
        return {
            passed: parsed.passed === true,
            metrics: parsed.metrics || {},
            error: parsed.error ? 'game-error' : null,
        };
    } catch {
        return { passed: false, metrics: {}, error: 'worker-protocol' };
    }
}

function chooseFailureSample(results, policy, secret, gateId) {
    const failures = results.filter(item => !item.result.passed).map(item => ({
        opaqueId: item.opaqueId,
        value: item.strata[policy.dimension],
        rank: hmac(secret, 'failure-sample-rank', `${gateId}\0${item.opaqueId}`),
    })).sort((a, b) => a.rank.localeCompare(b.rank));
    const perValue = new Map();
    const selected = [];
    for (const failure of failures) {
        if (selected.length >= policy.maxTotal) break;
        const count = perValue.get(failure.value) || 0;
        if (count >= policy.maxPerValue) continue;
        selected.push(failure.opaqueId);
        perValue.set(failure.value, count + 1);
    }
    return selected;
}

export async function evaluateSealedCorpus({
    gateRoot, secret, repoRoot, evaluateSession = defaultEvaluator,
    minAggregateCell, now = () => new Date(), onProgress, evaluationRevision,
}) {
    const gate = await loadAndVerifyGate(gateRoot, secret);
    const declaredAggregateCell = gate.manifest.evaluationPolicy?.minAggregateCell;
    if (!Number.isInteger(declaredAggregateCell) || declaredAggregateCell < 2) {
        throw new Error('manifest lacks a valid aggregate disclosure threshold');
    }
    if (minAggregateCell !== undefined && minAggregateCell !== declaredAggregateCell) {
        throw new Error('aggregate disclosure threshold differs from the committed manifest');
    }
    minAggregateCell = declaredAggregateCell;
    const resultPath = path.join(gate.root, 'gate-result.json');
    const authPath = path.join(gate.root, 'private', 'release-authorization.json');
    const statePath = path.join(gate.root, 'private', 'state', 'evaluation.json');
    if (fs.existsSync(resultPath) && fs.existsSync(authPath)) {
        throw new Error('sealed gate already has a frozen result; rescoring is forbidden');
    }
    if (fs.existsSync(authPath) && !fs.existsSync(resultPath)) {
        throw new Error('release authorization exists without a frozen result');
    }
    const recording = await verifyRecording(gate, secret);
    let state = {
        schema: EVALUATION_STATE_SCHEMA,
        gateId: gate.plan.gateId,
        frozenAt: null,
        entries: [],
    };
    if (fs.existsSync(statePath)) {
        state = await readJson(statePath);
        if (!verifyState(secret, 'evaluation-state', state)) {
            throw new Error('sealed evaluation resume state commitment mismatch');
        }
    }
    if (state.schema !== EVALUATION_STATE_SCHEMA
        || state.gateId !== gate.plan.gateId
        || !Array.isArray(state.entries)) {
        throw new Error('invalid sealed evaluation resume state');
    }
    const planIds = new Set(gate.plan.sessions.map(session => session.opaqueId));
    const completed = new Map();
    for (const entry of state.entries) {
        if (!planIds.has(entry.opaqueId) || completed.has(entry.opaqueId)) {
            throw new Error('sealed evaluation resume state names an invalid session');
        }
        completed.set(entry.opaqueId, normalizeEvaluationResult(entry.result));
    }
    const results = [];
    for (let index = 0; index < gate.plan.sessions.length; index++) {
        const session = gate.plan.sessions[index];
        const rawPath = path.join(gate.root, 'private', 'raw', `${session.opaqueId}.session.json`);
        let result = completed.get(session.opaqueId);
        if (!result) {
            try {
                result = normalizeEvaluationResult(
                    await evaluateSession({ rawPath, repoRoot }),
                );
            } catch {
                result = normalizeEvaluationResult({
                    passed: false, metrics: {}, error: 'worker-failed',
                });
            }
            state.entries.push({ opaqueId: session.opaqueId, result });
            completed.set(session.opaqueId, result);
            state = signState(secret, 'evaluation-state', state);
            await atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`);
        }
        results.push({ opaqueId: session.opaqueId, strata: session.strata, result });
        onProgress?.(index + 1, gate.plan.sessions.length);
    }
    const aggregate = buildAggregate(results, gate.manifest, minAggregateCell);
    if (!state.frozenAt) {
        state.frozenAt = now().toISOString();
        state = signState(secret, 'evaluation-state', state);
        await atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`);
    }
    const frozen = {
        schema: RESULT_SCHEMA,
        gateId: gate.plan.gateId,
        corpusVersion: gate.plan.corpusVersion,
        manifestSha256: recording.publicReceipt.manifestSha256,
        corpusCommitment: recording.publicReceipt.corpusCommitment,
        revisions: {
            ...gate.plan.revisions,
            evaluatedRepositoryCommit: evaluationRevision || 'unattested-test-revision',
        },
        evaluationContract: {
            bridgeFree: true,
            fixturesDisabled: true,
            oneSequentialWorker: true,
            minAggregateCell,
        },
        failureSamplePolicy: gate.manifest.failureSamplePolicy,
        frozenAt: state.frozenAt,
        ...aggregate,
    };
    const frozenBytes = `${JSON.stringify(frozen, null, 2)}\n`;
    if (fs.existsSync(resultPath)) {
        const existing = await fsp.readFile(resultPath, 'utf8');
        if (existing !== frozenBytes) {
            throw new Error('existing frozen result does not match evaluation checkpoint');
        }
    } else {
        await writeExclusive(resultPath, frozenBytes, PUBLIC_FILE_MODE);
    }
    const resultSha256 = sha256(frozenBytes);
    const selected = chooseFailureSample(
        results, gate.manifest.failureSamplePolicy, secret, gate.plan.gateId,
    );
    const authorization = {
        schema: RELEASE_SCHEMA,
        gateId: gate.plan.gateId,
        resultSha256,
        selected,
    };
    await writeExclusive(authPath,
        `${JSON.stringify(authorization, null, 2)}\n`, PRIVATE_FILE_MODE);
    await fsp.rm(statePath, { force: true });
    return { resultPath, resultSha256, frozen };
}

export async function releaseAuthorizedFailures({ gateRoot, journalPath }) {
    const root = path.resolve(gateRoot);
    const resultPath = path.join(root, 'gate-result.json');
    const authPath = path.join(root, 'private', 'release-authorization.json');
    const [resultBytes, authorization, plan, journal] = await Promise.all([
        fsp.readFile(resultPath),
        readJson(authPath),
        readJson(path.join(root, 'private', 'plan.json')),
        fsp.readFile(journalPath, 'utf8'),
    ]);
    const resultSha256 = sha256(resultBytes);
    if (authorization.schema !== RELEASE_SCHEMA
        || authorization.gateId !== plan.gateId
        || authorization.resultSha256 !== resultSha256) {
        throw new Error('release authorization does not match the frozen result');
    }
    const marker = `sealed-gate-result-sha256: ${resultSha256}`;
    if (!journal.includes(marker)) {
        throw new Error('frozen gate result is not acknowledged in the parity journal');
    }
    const planById = new Map(plan.sessions.map(session => [session.opaqueId, session]));
    const releaseDir = path.join(root, 'released-failure-sample');
    await fsp.mkdir(releaseDir, { mode: PRIVATE_DIR_MODE });
    if ((await fsp.readdir(releaseDir)).length > 0) {
        throw new Error('failure sample has already been released');
    }
    const released = [];
    for (let index = 0; index < authorization.selected.length; index++) {
        const opaqueId = authorization.selected[index];
        const session = planById.get(opaqueId);
        if (!session) throw new Error('release authorization names an unknown session');
        const source = path.join(root, 'private', 'raw', `${opaqueId}.session.json`);
        const targetName = `sample-${String(index + 1).padStart(2, '0')}.session.json`;
        await fsp.copyFile(source, path.join(releaseDir, targetName), fs.constants.COPYFILE_EXCL);
        await fsp.chmod(path.join(releaseDir, targetName), PRIVATE_FILE_MODE);
        released.push({ file: targetName, strata: session.strata });
    }
    await writeExclusive(path.join(releaseDir, 'release-manifest.json'),
        `${JSON.stringify({
            schema: RELEASE_SCHEMA,
            gateId: plan.gateId,
            resultSha256,
            samples: released,
        }, null, 2)}\n`, PRIVATE_FILE_MODE);
    return { releaseDir, count: released.length };
}

export function parseCliArgs(argv) {
    const values = {};
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
        const key = arg.slice(2);
        const value = argv[++index];
        if (value === undefined || value.startsWith('--')) {
            throw new Error(`missing value for --${key}`);
        }
        values[key] = value;
    }
    return values;
}
