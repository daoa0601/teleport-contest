#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { inspectCandidate, summarizeCorpus } from './holdout/inspect.mjs';
import { decodeManifest } from './holdout/types.mjs';
import { decodeSession, errorMessage, hasErrorCode } from './lib/session-types.mjs';
async function main() {
    const directories = process.argv.slice(2);
    if (!directories.length || directories.includes('--help')) {
        console.log('Usage: node scripts/inspect-holdout.mjs BATCH_DIR [BATCH_DIR ...]');
        return;
    }
    const publicSeeds = new Set();
    const publicDirectory = new URL('../sessions/', import.meta.url);
    for (const name of await fs.readdir(publicDirectory)) {
        if (!name.endsWith('.session.json'))
            continue;
        const raw = JSON.parse(await fs.readFile(new URL(name, publicDirectory), 'utf8'));
        const session = decodeSession(raw);
        for (const segment of session.segments)
            publicSeeds.add(segment.seed);
    }
    const seeds = new Set();
    const rows = [];
    const batches = [];
    const invalidRecordings = [];
    for (const directory of directories) {
        const batch = path.resolve(directory);
        try {
            await fs.access(path.join(batch, '.active'));
            throw new Error(`${directory}: generation is still active or has an unresolved lock`);
        }
        catch (error) {
            if (!hasErrorCode(error, 'ENOENT'))
                throw error;
        }
        const manifestJson = JSON.parse(await fs.readFile(path.join(batch, 'manifest.json'), 'utf8'));
        const manifest = decodeManifest(manifestJson);
        if (manifest.pending.length)
            throw new Error(`${directory}: unresolved interrupted recordings; resume generation first`);
        const files = (await fs.readdir(path.join(batch, 'sessions'))).filter(name => name.endsWith('.session.json'));
        const listed = new Set(manifest.accepted.map(row => path.basename(row.file)));
        if (listed.size !== manifest.accepted.length || files.length !== listed.size
            || files.some(file => !listed.has(file))) {
            throw new Error(`${directory}: session files and manifest disagree`);
        }
        for (const row of manifest.accepted) {
            const sessionJson = JSON.parse(await fs.readFile(path.join(batch, row.file), 'utf8'));
            const session = decodeSession(sessionJson);
            const localSeeds = new Set(session.segments.map(segment => segment.seed));
            for (const seed of localSeeds) {
                if (publicSeeds.has(seed))
                    throw new Error(`${directory}: a recording reused a public seed`);
                if (seeds.has(seed))
                    throw new Error(`${directory}: different recordings reused a seed`);
                seeds.add(seed);
            }
            try {
                rows.push({ ...row, metrics: inspectCandidate(row.spec, session) });
            }
            catch (error) {
                invalidRecordings.push({ file: path.join(directory, row.file), reason: errorMessage(error) });
            }
        }
        batches.push({ directory, sessions: manifest.accepted.length, rejected: manifest.rejected.length });
    }
    console.log(JSON.stringify({ ...summarizeCorpus(rows), batches, uniqueSeeds: seeds.size,
        valid: invalidRecordings.length === 0, invalidRecordings }, null, 2));
    if (invalidRecordings.length)
        process.exitCode = 1;
}
void main().catch((error) => { console.error(errorMessage(error)); process.exitCode = 1; });
//# sourceMappingURL=inspect-holdout.mjs.map