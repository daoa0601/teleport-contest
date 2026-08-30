#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parseCliArgs, prepareSealedCorpus, readSecret, recorderRuntimeAttestation,
    sha256,
} from './lib/sealed-corpus.mjs';
import { assertCleanGateInputs } from './lib/contest-process-safety.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function gitObject(name) {
    return execFileSync('git', ['rev-parse', name], {
        cwd: REPO_ROOT, encoding: 'utf8',
    }).trim();
}

async function generatorDigest(specBytes) {
    const sources = await Promise.all([
        fsp.readFile(new URL('./lib/sealed-corpus.mjs', import.meta.url)),
        fsp.readFile(fileURLToPath(import.meta.url)),
    ]);
    return sha256(Buffer.concat([...sources, specBytes]));
}

async function main() {
    const args = parseCliArgs(process.argv.slice(2));
    for (const required of ['gate-root', 'gate-id', 'secret-file']) {
        if (!args[required]) throw new Error(`--${required} is required`);
    }
    const specPath = path.resolve(args.spec || path.join(REPO_ROOT, 'sealed-corpus', 'spec.v1.json'));
    assertCleanGateInputs(REPO_ROOT);
    const specBytes = await fsp.readFile(specPath);
    const spec = JSON.parse(specBytes);
    const secret = await readSecret(path.resolve(args['secret-file']));
    const revisions = {
        preparationRepositoryCommit: gitObject('HEAD'),
        cSourceTree: gitObject('HEAD:nethack-c/upstream'),
        recorderSourceTree: gitObject('HEAD:nethack-c'),
        generatorSha256: await generatorDigest(specBytes),
        ...await recorderRuntimeAttestation(REPO_ROOT),
    };
    const prepared = await prepareSealedCorpus({
        gateRoot: path.resolve(args['gate-root']),
        gateId: args['gate-id'],
        spec,
        secret,
        revisions,
    });
    process.stdout.write(
        `Prepared sealed gate ${prepared.manifest.gateId} with `
        + `${prepared.manifest.sessionCount} committed sessions.\n`,
    );
}

main().catch(error => {
    process.stderr.write(`sealed corpus preparation failed: ${error.message}\n`);
    process.exitCode = 1;
});
