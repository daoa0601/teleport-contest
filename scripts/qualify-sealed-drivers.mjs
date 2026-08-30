#!/usr/bin/env node

// This is deliberately unsealed: it uses a published constant key, records
// one disposable C session per adaptive or stateful scenario, exposes no
// trace content, and deletes every result. Its only claim is that semantic
// drivers can select their live destinations and save/restore can complete.

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildPrivatePlan, runOwnedChild,
} from './lib/sealed-corpus.mjs';
import { assertNoContestProcesses } from './lib/contest-process-safety.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
    assertNoContestProcesses();
    const spec = JSON.parse(await fsp.readFile(
        path.join(REPO_ROOT, 'sealed-corpus', 'spec.v1.json'), 'utf8',
    ));
    const plan = buildPrivatePlan({
        spec,
        gateId: 'unsealed-driver-qualification',
        secret: Buffer.alloc(32, 0x42),
        revisions: { qualification: 'public-constant-key' },
    });
    const byScenario = new Map();
    for (const session of plan.sessions) {
        if (session.document.segments.length < 2
            && !session.document.segments.some(segment => segment.driver)) continue;
        if (!byScenario.has(session.strata.scenarioFamily)) {
            byScenario.set(session.strata.scenarioFamily, session);
        }
    }
    const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'teleport-driver-qualification-'));
    try {
        for (const session of byScenario.values()) {
            const inputPath = path.join(tmpRoot, 'input.session.json');
            const outputPath = path.join(tmpRoot, 'output.session.json');
            await fsp.writeFile(inputPath, JSON.stringify(session.document), { mode: 0o600 });
            const child = await runOwnedChild(process.execPath, [
                path.join(REPO_ROOT, 'scripts', 'record-session.mjs'),
                inputPath,
                outputPath,
            ], {
                cwd: REPO_ROOT,
                env: { ...process.env, RECORD_SESSION_QUIET: '1' },
                timeoutMs: 180000,
            });
            if (child.code !== 0) throw new Error('an adaptive C driver failed qualification');
            const recorded = JSON.parse(await fsp.readFile(outputPath, 'utf8'));
            if (!Array.isArray(recorded.segments)
                || recorded.segments.length !== session.document.segments.length
                || recorded.segments.some(segment =>
                    'driver' in segment || !segment.moves || !segment.steps?.length)) {
                throw new Error('an adaptive C driver produced an invalid replay input');
            }
            await fsp.rm(inputPath, { force: true });
            await fsp.rm(outputPath, { force: true });
        }
    } finally {
        await fsp.rm(tmpRoot, { recursive: true, force: true });
    }
    process.stdout.write(
        `Qualified ${byScenario.size} adaptive/stateful scenarios against the C recorder.\n`,
    );
}

main().catch(error => {
    process.stderr.write(`adaptive driver qualification failed: ${error.message}\n`);
    process.exitCode = 1;
});
