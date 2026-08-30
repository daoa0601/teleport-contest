#!/usr/bin/env node

import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    evaluateSealedCorpus, parseCliArgs, readSecret,
} from './lib/sealed-corpus.mjs';
import {
    acquireGateOperationLock, assertCleanGateInputs, assertNoContestProcesses,
} from './lib/contest-process-safety.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
    const args = parseCliArgs(process.argv.slice(2));
    for (const required of ['gate-root', 'secret-file']) {
        if (!args[required]) throw new Error(`--${required} is required`);
    }
    assertCleanGateInputs(REPO_ROOT);
    assertNoContestProcesses();
    const secret = await readSecret(path.resolve(args['secret-file']));
    const releaseLock = await acquireGateOperationLock(
        path.resolve(args['gate-root']), 'evaluate',
    );
    let lastReported = 0;
    let result;
    try {
        result = await evaluateSealedCorpus({
            gateRoot: path.resolve(args['gate-root']),
            secret,
            repoRoot: REPO_ROOT,
            evaluationRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
                cwd: REPO_ROOT, encoding: 'utf8',
            }).trim(),
            onProgress(completed, total) {
                const bucket = Math.floor((completed * 10) / total);
                if (bucket > lastReported || completed === total) {
                    lastReported = bucket;
                    process.stderr.write(`Sealed evaluation progress: ${completed}/${total}.\n`);
                }
            },
        });
    } finally {
        await releaseLock();
    }
    process.stdout.write(
        `Frozen aggregate result. sealed-gate-result-sha256: ${result.resultSha256}\n`,
    );
}

main().catch(error => {
    process.stderr.write(`sealed corpus evaluation failed: ${error.message}\n`);
    process.exitCode = 1;
});
