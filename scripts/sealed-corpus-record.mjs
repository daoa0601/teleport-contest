#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parseCliArgs, readSecret, recordSealedCorpus,
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
        path.resolve(args['gate-root']), 'record',
    );
    let lastReported = 0;
    let receipt;
    try {
        receipt = await recordSealedCorpus({
            gateRoot: path.resolve(args['gate-root']),
            secret,
            repoRoot: REPO_ROOT,
            onProgress(completed, total) {
                const bucket = Math.floor((completed * 10) / total);
                if (bucket > lastReported || completed === total) {
                    lastReported = bucket;
                    process.stderr.write(`Sealed recording progress: ${completed}/${total}.\n`);
                }
            },
        });
    } finally {
        await releaseLock();
    }
    process.stdout.write(
        `Sealed recording complete: ${receipt.sessionCount} committed sessions.\n`,
    );
}

main().catch(error => {
    process.stderr.write(`sealed corpus recording failed: ${error.message}\n`);
    process.exitCode = 1;
});
