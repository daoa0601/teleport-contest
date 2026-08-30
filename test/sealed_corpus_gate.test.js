import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    buildPrivatePlan,
    canonicalJson,
    evaluateSealedCorpus,
    loadAndVerifyGate,
    prepareSealedCorpus,
    publicManifestFor,
    recordSealedCorpus,
    releaseAuthorizedFailures,
    runOwnedChild,
} from '../scripts/lib/sealed-corpus.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const REVISIONS = {
    repositoryCommit: 'repo-test-revision',
    cSourceTree: 'c-test-revision',
    recorderSourceTree: 'recorder-test-revision',
    generatorSha256: 'generator-test-revision',
};

function smallSpec() {
    return {
        schema: 'teleport.sealed-corpus-spec.v1',
        corpusVersion: 'test-v1',
        generator: {
            characterProgram: 'start',
            dateRange: { start: '2030-01-01', end: '2030-12-31' },
            baseOptions: ['!tutorial'],
        },
        characters: [{
            role: 'Wizard',
            genders: ['female'],
            races: [{ race: 'human', alignments: ['neutral'] }],
        }],
        programs: [
            {
                id: 'start',
                commandFamily: 'startup',
                worldFamily: 'dungeon-start',
                optionFamily: 'default',
                runmode: 'walk',
                playmode: 'normal',
                moves: '.',
            },
            {
                id: 'move',
                commandFamily: 'movement',
                worldFamily: 'ordinary-dungeon',
                optionFamily: 'default',
                runmode: 'run',
                playmode: 'normal',
                moves: 'hjkl',
                repetitions: 3,
            },
        ],
        evaluationPolicy: { minAggregateCell: 2 },
        failureSamplePolicy: {
            strategy: 'keyed-rank-per-stratum',
            dimension: 'commandFamily',
            maxPerValue: 1,
            maxTotal: 2,
        },
    };
}

async function temporaryRoot(t) {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'teleport-sealed-test-'));
    t.after(() => fsp.rm(root, { recursive: true, force: true }));
    return root;
}

function collectKeys(value, keys = new Set()) {
    if (Array.isArray(value)) {
        for (const item of value) collectKeys(item, keys);
    } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            keys.add(key);
            collectKeys(item, keys);
        }
    }
    return keys;
}

async function prepareTestGate(t, suffix = 'gate') {
    const parent = await temporaryRoot(t);
    const secret = Buffer.alloc(32, 0x5a);
    const gateRoot = path.join(parent, suffix);
    const prepared = await prepareSealedCorpus({
        gateRoot,
        spec: smallSpec(),
        gateId: `test-${suffix}`,
        secret,
        revisions: REVISIONS,
    });
    return { ...prepared, gateRoot, secret, parent };
}

async function syntheticRecord({ inputPath, outputPath }) {
    const document = JSON.parse(await fsp.readFile(inputPath, 'utf8'));
    for (const segment of document.segments) {
        segment.steps = [{
            key: null,
            rng: [],
            screen: 'synthetic C boundary',
            cursor: [0, 0, 1],
        }];
    }
    await fsp.writeFile(outputPath, JSON.stringify(document));
}

test('sealed preparation is deterministic and its public manifest omits identities', async t => {
    const secret = Buffer.alloc(32, 0x31);
    const spec = smallSpec();
    const rootA = path.join(await temporaryRoot(t), 'a');
    const rootB = path.join(await temporaryRoot(t), 'b');
    const first = await prepareSealedCorpus({
        gateRoot: rootA, spec, gateId: 'deterministic-gate', secret, revisions: REVISIONS,
    });
    const second = await prepareSealedCorpus({
        gateRoot: rootB, spec, gateId: 'deterministic-gate', secret, revisions: REVISIONS,
    });
    assert.equal(canonicalJson(first.plan), canonicalJson(second.plan));
    assert.equal(canonicalJson(first.manifest), canonicalJson(second.manifest));

    const keys = collectKeys(first.manifest);
    for (const privateKey of [
        'opaqueId', 'document', 'seed', 'datetime', 'nethackrc', 'moves', 'steps',
        'driver',
    ]) {
        assert.equal(keys.has(privateKey), false, `${privateKey} leaked into manifest`);
    }
    assert.equal(first.manifest.sessionCount, 4);
    assert.equal(first.manifest.strata.commandFamily.startup, 1);
    assert.equal(first.manifest.strata.commandFamily.movement, 3);
    assert.equal(fs.statSync(path.join(rootA, 'private')).mode & 0o077, 0);
    assert.equal(fs.statSync(path.join(rootA, 'private', 'plan.json')).mode & 0o177, 0);
});

test('adaptive recorder driver selects a named destination across menu pages', () => {
    const driver = createSessionDriver([
        { type: 'keys', value: 'x' },
        { type: 'select-menu-entry', target: 'soko1:' },
        { type: 'keys', value: '.' },
    ]);
    assert.equal(driver.nextKey([]), 'x');
    assert.equal(driver.nextKey([]), 'm');
    assert.equal(driver.nextKey([]), '\x16');
    assert.equal(driver.nextKey([
        ' Level teleport to where:',
        ' a - oracle: 8',
        ' (1 of 2)',
    ]), ' ');
    assert.equal(driver.nextKey([
        ' Level teleport to where:',
        ' B -   soko1: 12',
        ' (2 of 2)',
    ]), 'B');
    assert.equal(driver.nextKey([]), '.');
    assert.equal(driver.nextKey([]), null);
    assert.equal(driver.exhausted, true);
});

test('adaptive recorder driver fails rather than relabeling an absent destination', () => {
    const driver = createSessionDriver([
        { type: 'select-menu-entry', target: 'minetn:' },
    ]);
    assert.equal(driver.nextKey([]), 'm');
    assert.equal(driver.nextKey([]), '\x16');
    assert.throws(() => driver.nextKey([
        ' Level teleport to where:',
        ' z - castle: 25',
        ' (3 of 3)',
    ]), /absent/);
});

test('a private recipe mutation fails commitment verification', async t => {
    const gate = await prepareTestGate(t, 'tamper-plan');
    const planPath = path.join(gate.gateRoot, 'private', 'plan.json');
    const plan = JSON.parse(await fsp.readFile(planPath, 'utf8'));
    plan.sessions[0].document.segments[0].seed += 1;
    await fsp.chmod(planPath, 0o600);
    await fsp.writeFile(planPath, JSON.stringify(plan));
    await assert.rejects(
        loadAndVerifyGate(gate.gateRoot, gate.secret),
        /commitment mismatch/,
    );
});

test('the committed corpus specification spans every required acceptance family', () => {
    const spec = JSON.parse(fs.readFileSync(
        path.join(REPO_ROOT, 'sealed-corpus', 'spec.v1.json'), 'utf8',
    ));
    const secret = Buffer.alloc(32, 0x23);
    const plan = buildPrivatePlan({
        spec, gateId: 'coverage-contract', secret, revisions: REVISIONS,
    });
    const manifest = publicManifestFor({ spec, plan, secret });
    assert.deepEqual(
        Object.keys(manifest.strata.role).sort(),
        [
            'Archeologist', 'Barbarian', 'Caveman', 'Healer', 'Knight', 'Monk',
            'Priest', 'Ranger', 'Rogue', 'Samurai', 'Tourist', 'Valkyrie', 'Wizard',
        ].sort(),
    );
    for (const family of [
        'movement', 'inventory', 'combat', 'spell', 'prayer', 'trap',
        'projectile', 'travel', 'transition', 'debug-command',
    ]) {
        assert.ok(manifest.strata.commandFamily[family] >= 4, family);
    }
    for (const runmode of ['teleport', 'run', 'walk', 'crawl']) {
        assert.ok(manifest.strata.runmode[runmode] > 0, runmode);
    }
    for (const world of [
        'mines-depth', 'medusa-special', 'gehennom-depth',
        'big-room-special-layout', 'sokoban-special-layout',
        'quest-special-layout',
    ]) {
        assert.ok(manifest.strata.worldFamily[world] >= 4, world);
    }
    assert.equal(manifest.strata.lifecycle['save-restore'], 4);
});

test('recording is sequential, resumable, and commits raw traces without public identities', async t => {
    const gate = await prepareTestGate(t, 'record');
    let active = 0;
    let peak = 0;
    let recordedCount = 0;
    let attempts = 0;
    const interruptedRecorder = async input => {
        active++;
        peak = Math.max(peak, active);
        try {
            attempts++;
            if (attempts === 3) throw new Error('simulated interruption');
            await new Promise(resolve => setTimeout(resolve, 2));
            await syntheticRecord(input);
            recordedCount++;
        } finally {
            active--;
        }
    };
    await assert.rejects(
        recordSealedCorpus({
            gateRoot: gate.gateRoot,
            secret: gate.secret,
            repoRoot: REPO_ROOT,
            invokeRecorder: interruptedRecorder,
        }),
        /simulated interruption/,
    );
    const receipt = await recordSealedCorpus({
        gateRoot: gate.gateRoot,
        secret: gate.secret,
        repoRoot: REPO_ROOT,
        async invokeRecorder(input) {
            active++;
            peak = Math.max(peak, active);
            try {
                await syntheticRecord(input);
                recordedCount++;
            } finally {
                active--;
            }
        },
    });
    assert.equal(peak, 1);
    assert.equal(recordedCount, 4);
    assert.equal(receipt.sessionCount, 4);
    assert.deepEqual(
        Object.keys(receipt).sort(),
        [
            'corpusCommitment', 'gateId', 'manifestSha256',
            'privateReceiptCommitment', 'schema', 'sessionCount',
        ].sort(),
    );
    await assert.rejects(
        recordSealedCorpus({
            gateRoot: gate.gateRoot,
            secret: gate.secret,
            repoRoot: REPO_ROOT,
            invokeRecorder: syntheticRecord,
        }),
        /already been recorded/,
    );
});

test('an interrupted evaluation resumes without evaluating completed sessions again', async t => {
    const gate = await prepareTestGate(t, 'resume-evaluation');
    await recordSealedCorpus({
        gateRoot: gate.gateRoot,
        secret: gate.secret,
        repoRoot: REPO_ROOT,
        invokeRecorder: syntheticRecord,
    });
    let firstRunCount = 0;
    await assert.rejects(
        evaluateSealedCorpus({
            gateRoot: gate.gateRoot,
            secret: gate.secret,
            repoRoot: REPO_ROOT,
            async evaluateSession() {
                firstRunCount++;
                return {
                    passed: true,
                    metrics: {
                        rngCalls: { matched: 1, total: 1 },
                        screens: { matched: 1, total: 1 },
                    },
                    error: null,
                };
            },
            onProgress(completed) {
                if (completed === 2) throw new Error('simulated gate interruption');
            },
        }),
        /simulated gate interruption/,
    );
    assert.equal(firstRunCount, 2);
    let resumedCount = 0;
    const result = await evaluateSealedCorpus({
        gateRoot: gate.gateRoot,
        secret: gate.secret,
        repoRoot: REPO_ROOT,
        async evaluateSession() {
            resumedCount++;
            return {
                passed: true,
                metrics: {
                    rngCalls: { matched: 1, total: 1 },
                    screens: { matched: 1, total: 1 },
                },
                error: null,
            };
        },
    });
    assert.equal(resumedCount, 2);
    assert.equal(result.frozen.overall.sessions.passed, 4);
});

test('evaluation freezes aggregates once and releases only its predeclared sample after journal acknowledgement', async t => {
    const gate = await prepareTestGate(t, 'evaluate');
    await recordSealedCorpus({
        gateRoot: gate.gateRoot,
        secret: gate.secret,
        repoRoot: REPO_ROOT,
        invokeRecorder: syntheticRecord,
    });
    let evaluatedCount = 0;
    const evaluated = await evaluateSealedCorpus({
        gateRoot: gate.gateRoot,
        secret: gate.secret,
        repoRoot: REPO_ROOT,
        minAggregateCell: 2,
        now: () => new Date('2031-02-03T04:05:06.000Z'),
        async evaluateSession() {
            const index = evaluatedCount++;
            return {
                passed: index === 0 || index === 3,
                metrics: {
                    rngCalls: { matched: index + 1, total: 5 },
                    screens: { matched: index, total: 4 },
                },
                error: index === 2 ? 'private absolute path and diagnostic' : null,
            };
        },
    });
    assert.equal(evaluated.frozen.overall.sessions.total, 4);
    assert.equal(evaluated.frozen.overall.sessions.passed, 2);
    assert.equal(evaluated.frozen.overall.sessions.errored, 1);
    assert.equal(evaluated.frozen.strata.commandFamily.startup.suppressed, true);
    assert.equal(evaluated.frozen.strata.commandFamily.movement.sessions.total, 3);
    const publicText = await fsp.readFile(evaluated.resultPath, 'utf8');
    for (const session of gate.plan.sessions) {
        assert.equal(publicText.includes(session.opaqueId), false);
    }
    assert.equal(publicText.includes('private absolute path and diagnostic'), false);
    await assert.rejects(
        evaluateSealedCorpus({
            gateRoot: gate.gateRoot,
            secret: gate.secret,
            repoRoot: REPO_ROOT,
            evaluateSession: async () => ({ passed: true, metrics: {}, error: null }),
        }),
        /rescoring is forbidden/,
    );

    const journalPath = path.join(gate.parent, 'journal.md');
    await fsp.writeFile(journalPath, 'not acknowledged\n');
    await assert.rejects(
        releaseAuthorizedFailures({ gateRoot: gate.gateRoot, journalPath }),
        /not acknowledged/,
    );
    await fsp.writeFile(
        journalPath,
        `sealed-gate-result-sha256: ${evaluated.resultSha256}\n`,
    );
    const released = await releaseAuthorizedFailures({
        gateRoot: gate.gateRoot, journalPath,
    });
    assert.equal(released.count, 1);
    const releaseFiles = (await fsp.readdir(released.releaseDir)).sort();
    assert.deepEqual(releaseFiles, ['release-manifest.json', 'sample-01.session.json']);
});

test('evaluation refuses a raw C trace changed after recording', async t => {
    const gate = await prepareTestGate(t, 'tamper-raw');
    await recordSealedCorpus({
        gateRoot: gate.gateRoot,
        secret: gate.secret,
        repoRoot: REPO_ROOT,
        invokeRecorder: syntheticRecord,
    });
    const rawDir = path.join(gate.gateRoot, 'private', 'raw');
    const rawPath = path.join(rawDir, (await fsp.readdir(rawDir))[0]);
    await fsp.chmod(rawPath, 0o600);
    await fsp.appendFile(rawPath, ' ');
    await assert.rejects(
        evaluateSealedCorpus({
            gateRoot: gate.gateRoot,
            secret: gate.secret,
            repoRoot: REPO_ROOT,
            evaluateSession: async () => ({ passed: true, metrics: {}, error: null }),
        }),
        /raw trace commitment mismatch/,
    );
});

test('owned child timeout terminates its complete process group', {
    skip: process.platform === 'win32',
}, async t => {
    const root = await temporaryRoot(t);
    const marker = `sealed-owned-${path.basename(root)}`;
    const helperPath = path.join(root, 'owned-helper.mjs');
    await fsp.writeFile(helperPath, [
        "import { spawn } from 'node:child_process';",
        `spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '${marker}'], { stdio: 'ignore' });`,
        'setInterval(() => {}, 1000);',
        '',
    ].join('\n'));
    await assert.rejects(
        runOwnedChild(process.execPath, [helperPath, marker], { timeoutMs: 40 }),
        /timed out/,
    );
    await new Promise(resolve => setTimeout(resolve, 40));
    const processes = execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' });
    assert.equal(processes.includes(marker), false);
});
