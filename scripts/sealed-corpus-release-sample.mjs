#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parseCliArgs, releaseAuthorizedFailures,
} from './lib/sealed-corpus.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
    const args = parseCliArgs(process.argv.slice(2));
    if (!args['gate-root']) throw new Error('--gate-root is required');
    const released = await releaseAuthorizedFailures({
        gateRoot: path.resolve(args['gate-root']),
        journalPath: path.resolve(args.journal || path.join(REPO_ROOT, 'docs', 'research', 'journal.md')),
    });
    process.stdout.write(
        `Released ${released.count} predeclared failing sample${released.count === 1 ? '' : 's'}.\n`,
    );
}

main().catch(error => {
    process.stderr.write(`sealed failure-sample release failed: ${error.message}\n`);
    process.exitCode = 1;
});
