import { parse } from '@babel/parser';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Measurement integrity, after the decompilation lesson that agents will
// edit the checker or special-case the checked inputs if allowed to.
//
//   node src/scripts/check-measurement-guard.mts seeds
//     Fails if game sources contain a literal recorded seed (>= 10000) or a
//     recorded session identifier. Session fixtures and seed branches are
//     forbidden; this makes the rule mechanical.
//
//   node src/scripts/check-measurement-guard.mts hash [--expect HEX]
//     Prints one SHA-256 over the scorer, triage, oracle, frozen, and native
//     patch sources. CI compares it with a secret the agent cannot read.

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const GAME_SOURCES = join(ROOT, 'src/js');
const MIN_SEED = 10000;
const MEASUREMENT_PATHS = [
    'frozen', 'nethack-c/patches', 'nethack-c/probe',
    'src/scripts/lib/score-session.mts', 'src/scripts/lib/replay-capture.mts', 'src/scripts/lib/frozen-adapters.mts',
    'src/scripts/lib/session-types.mts', 'src/scripts/lib/corpus-lock.mts', 'src/scripts/lib/state-digest.mts',
    'src/scripts/lib/state-replay.mts', 'src/scripts/triage-holdout.mts', 'src/scripts/rng-function-table.mts',
    'src/scripts/state-oracle.mts', 'src/scripts/check-measurement-guard.mts',
];

function files(path: string): string[] {
    if (!existsSync(path)) return [];
    if (!statSync(path).isDirectory()) return [path];
    return readdirSync(path).sort().flatMap(entry => files(join(path, entry)));
}

function readJson(path: string): unknown {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return data;
}

function field(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? new Map(Object.entries(value)).get(key) : undefined;
}

// Seeds and identifiers of every recording available in this checkout.
function recordedIdentity(): { seeds: Set<number>; ids: Set<string> } {
    const seeds = new Set<number>(), ids = new Set<string>();
    const sessionDir = join(ROOT, 'sessions');
    for (const name of existsSync(sessionDir) ? readdirSync(sessionDir) : []) {
        if (!name.endsWith('.session.json')) continue;
        ids.add(name.replace(/\.session\.json$/, ''));
        const data = readJson(join(sessionDir, name));
        const segments = field(data, 'segments');
        for (const segment of Array.isArray(segments) ? segments : [data]) {
            const seed = field(segment, 'seed');
            if (typeof seed === 'number' && seed >= MIN_SEED) seeds.add(seed);
        }
    }
    for (const stratum of ['adaptive', 'deep', 'scenarios']) {
        const manifest = join(ROOT, '.cache/holdout-dev', stratum, 'manifest.json');
        if (!existsSync(manifest)) continue;
        const accepted = field(readJson(manifest), 'accepted');
        for (const entry of Array.isArray(accepted) ? accepted : []) {
            const seed = field(field(entry, 'spec'), 'seed');
            if (typeof seed === 'number' && seed >= MIN_SEED) seeds.add(seed);
            const file = field(entry, 'file');
            if (typeof file === 'string') ids.add(file.replace(/^.*\//, '').replace(/\.session\.json$/, ''));
        }
    }
    return { seeds, ids };
}

function checkSeeds(): void {
    const { seeds, ids } = recordedIdentity();
    let violations = 0;
    for (const path of files(GAME_SOURCES).filter(p => /\.(?:ts|mts)$/.test(p))) {
        const parsed = parse(readFileSync(path, 'utf8'), { sourceType: 'module', plugins: ['typescript'], tokens: true });
        for (const token of parsed.tokens ?? []) {
            const label = field(field(token, 'type'), 'label');
            const value: unknown = field(token, 'value');
            const line = field(field(field(token, 'loc'), 'start'), 'line');
            const where = `${relative(ROOT, path)}:${typeof line === 'number' ? line : 1}`;
            if (label === 'num' && typeof value === 'number' && seeds.has(value)) {
                console.error(`${where}: literal ${value} is a recorded session seed; game code must not depend on recorded inputs.`);
                violations++;
            } else if ((label === 'string' || label === 'template') && typeof value === 'string'
                && [...ids].some(id => value.includes(id))) {
                console.error(`${where}: string names a recorded session; game code must not depend on recorded inputs.`);
                violations++;
            }
        }
    }
    if (violations) process.exitCode = 1;
}

function measurementHash(): string {
    const hash = createHash('sha256');
    for (const path of MEASUREMENT_PATHS.flatMap(p => files(join(ROOT, p)))) {
        hash.update(relative(ROOT, path)).update('\0').update(readFileSync(path)).update('\0');
    }
    return hash.digest('hex');
}

const [command, flag, expected] = process.argv.slice(2);
if (command === 'seeds') checkSeeds();
else if (command === 'hash') {
    const actual = measurementHash();
    if (flag === '--expect') {
        if (actual !== expected) {
            console.error('Measurement sources differ from the approved hash. Re-approve deliberately, out of band.');
            process.exitCode = 1;
        }
    } else console.log(actual);
} else {
    console.error('usage: check-measurement-guard.mts {seeds | hash [--expect HEX]}');
    process.exitCode = 2;
}
