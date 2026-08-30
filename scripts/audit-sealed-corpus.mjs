#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FORBIDDEN_PRODUCTION_TOKENS = [
    '.sealed-corpus',
    'sealed-corpus-manifest',
    'sealed-corpus-private-plan',
    'sealed-corpus-recording',
    'sealed-corpus-result',
    'released-failure-sample',
];

export function auditSealedCorpusBoundary(repoRoot = REPO_ROOT) {
    const failures = [];
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
        .split('\n').map(line => line.trim());
    if (!gitignore.includes('.sealed-corpus/')) {
        failures.push('.gitignore: private sealed corpus root is not ignored');
    }
    const jsRoot = path.join(repoRoot, 'js');
    const productionFiles = fs.readdirSync(jsRoot)
        .filter(filename => filename.endsWith('.js')).sort();
    for (const filename of productionFiles) {
        const source = fs.readFileSync(path.join(jsRoot, filename), 'utf8');
        for (const token of FORBIDDEN_PRODUCTION_TOKENS) {
            if (source.includes(token)) {
                failures.push(`${filename}: production references sealed custody token ${token}`);
            }
        }
    }
    const gateSource = fs.readFileSync(
        path.join(repoRoot, 'scripts', 'lib', 'sealed-corpus.mjs'), 'utf8',
    );
    for (const contract of [
        "TELEPORT_BRIDGE_FREE: '1'",
        "TELEPORT_DISABLE_FIXTURES: '1'",
        'oneSequentialWorker: true',
    ]) {
        if (!gateSource.includes(contract)) {
            failures.push(`sealed evaluator lacks required contract: ${contract}`);
        }
    }
    return { productionFiles, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = auditSealedCorpusBoundary();
    if (result.failures.length > 0) {
        for (const failure of result.failures) process.stderr.write(`${failure}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write(
            `Sealed corpus boundary audit passed: ${result.productionFiles.length} `
            + 'production files cannot name sealed custody artifacts, and the '
            + 'private gate root is ignored.\n',
        );
    }
}
