#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), '..',
);

const FORBIDDEN_BEHAVIORAL_PATTERNS = [
    {
        id: 'recorded-session-input',
        pattern: /(?:\.\.\/)?sessions\/[^'"`\s]+\.session\.json/g,
    },
    {
        id: 'public-parity-helper',
        pattern: /\b(?:assertRngSliceExact|expectedRngSlice)\b/g,
    },
    {
        id: 'mock-or-spy-api',
        pattern: /\b(?:mock|spyOn|stub)\s*(?:\.|\()/g,
    },
    {
        id: 'call-transcript-collector',
        pattern: /\b(?:const|let)\s+(?:calls|callOrder|invocations)\s*=\s*\[\]/g,
    },
    {
        id: 'same-implementation-mode-oracle',
        pattern: /\b(?:outcomesAcrossModes|assertLiveAcrossModes)\b/g,
    },
    {
        id: 'same-implementation-world-comparison',
        pattern: /assert\.deepEqual\(\s*(?:normal|legacy)\.world\s*,\s*bridgeFree\.world/g,
    },
    {
        id: 'test-self-discovery-oracle',
        pattern: /\bresult\.files\.(?:includes|some)\s*\(/g,
    },
];

export function auditBehavioralTestLane(repoRoot = REPO_ROOT) {
    const testDir = path.join(repoRoot, 'test');
    const files = fs.readdirSync(testDir)
        .filter(filename => filename.endsWith('.test.js'))
        .sort();
    const failures = [];

    for (const filename of files) {
        const source = fs.readFileSync(path.join(testDir, filename), 'utf8');
        const lines = source.split('\n');
        for (const { id, pattern } of FORBIDDEN_BEHAVIORAL_PATTERNS) {
            pattern.lastIndex = 0;
            for (const match of source.matchAll(pattern)) {
                const line = source.slice(0, match.index).split('\n').length;
                failures.push({ id, file: filename, line, text: lines[line - 1] });
            }
        }
    }

    return { files, failures };
}

if (process.argv[1] && path.resolve(process.argv[1])
    === fileURLToPath(import.meta.url)) {
    const result = auditBehavioralTestLane();
    if (result.failures.length > 0) {
        for (const failure of result.failures) {
            console.error(
                `${failure.file}:${failure.line} ${failure.id}: ${failure.text.trim()}`,
            );
        }
        process.exitCode = 1;
    } else {
        console.log(
            `Behavioral lane audit passed: ${result.files.length} files, `
            + 'no recorded-session, public-parity, mock/spy, or '
            + 'same-implementation/call-transcript dependencies.',
        );
    }
}
