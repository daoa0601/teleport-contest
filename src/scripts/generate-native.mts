#!/usr/bin/env node

// Run every C-derived table generator against one source tree, in a fixed
// order, and report which generated outputs changed.
//
//   node scripts/generate-native.mjs [--source DIR] [--check]
//
// --source defaults to the shared generator resolution (nethack-c/upstream,
// NETHACK_SOURCE, or the recorded upstream link). --check regenerates, fails
// listing any output that would change, and restores the previous bytes, so
// CI can hold the committed tables to their sources.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGeneratorArguments, resolveGeneratorSource } from './lib/generator-source.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const requested = parseGeneratorArguments(process.argv.slice(2)).source;
const check = process.argv.includes('--check');
const sourceTree = resolveGeneratorSource(requested);

// Fixed order: the scripts/ generators read only the C tree (alphabetical),
// then the artifact projection, which also reads the emitted object_data.js
// built from generate-object-name-data.mjs's output.
const generators = [
    'scripts/generate-command-data.mjs',
    'scripts/generate-lua-assets.mjs',
    'scripts/generate-monster-attack-types.mjs',
    'scripts/generate-monster-color-data.mjs',
    'scripts/generate-monster-experience-data.mjs',
    'scripts/generate-monster-food-data.mjs',
    'scripts/generate-monster-growth-data.mjs',
    'scripts/generate-monster-name-data.mjs',
    'scripts/generate-object-name-data.mjs',
    'scripts/generate-quest-data.mjs',
    'scripts/generate-random-text-data.mjs',
    'scripts/generate-shop-data.mjs',
    'scripts/generate-version-data.mjs',
    'tools/gen-artifacts.mjs',
] as const;

// Every file a generator above can write. monster_data.ts carries five
// regions and const.ts and shknam.ts one each; snapshots are whole files.
const outputs = [
    'src/js/artifact_data.ts',
    'src/js/command_data.ts',
    'src/js/const.ts',
    'src/js/generated/lua_sources.ts',
    'src/js/monster_attack_types.ts',
    'src/js/monster_data.ts',
    'src/js/object_data.ts',
    'src/js/quest_data.ts',
    'src/js/random_text_data.ts',
    'src/js/shknam.ts',
] as const;

interface Snapshot {
    readonly path: string;
    readonly content: string | null;
}

function readOutput(path: string): string | null {
    try {
        return readFileSync(join(root, path), 'utf8');
    } catch {
        return null;
    }
}

function run(command: string, args: readonly string[]): void {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0)
        throw new Error(`${command} ${args.join(' ')} exited with status ${result.status ?? 'signal'}`);
}

function lineDelta(before: string, after: string): string {
    // Multiset line difference: enough to size a change without a diff tool.
    const counts = new Map<string, number>();
    for (const line of before.split('\n')) counts.set(line, (counts.get(line) ?? 0) + 1);
    let added = 0;
    for (const line of after.split('\n')) {
        const remaining = counts.get(line) ?? 0;
        if (remaining > 0) counts.set(line, remaining - 1);
        else added++;
    }
    let removed = 0;
    for (const remaining of counts.values()) removed += remaining;
    return ` (+${added}/-${removed} lines)`;
}

const snapshots: Snapshot[] = outputs.map(path => ({ path, content: readOutput(path) }));
process.stderr.write(`C sources: ${sourceTree}\n`);

const artifactProjection = generators[generators.length - 1];
for (const generator of generators) {
    // The artifact projection resolves object constants through the emitted
    // object_data.js, so refresh the build when this pass changed it.
    if (generator === artifactProjection) {
        const objectData = snapshots.find(snapshot => snapshot.path === 'src/js/object_data.ts');
        if (objectData !== undefined && objectData.content !== null
            && objectData.content !== readOutput('src/js/object_data.ts')) {
            process.stderr.write('object_data.ts changed; recompiling for the artifact projection\n');
            run('npm', ['run', 'compile']);
        }
    }
    process.stderr.write(`${generator}\n`);
    run(process.execPath, [join(root, generator), '--source', sourceTree]);
}

const drifted: string[] = [];
for (const snapshot of snapshots) {
    const after = readOutput(snapshot.path);
    if (after === snapshot.content) continue;
    const delta = snapshot.content === null
        ? ' (new file)' : after === null ? ' (deleted)' : lineDelta(snapshot.content, after);
    process.stderr.write(`${snapshot.path}: changed${delta}\n`);
    drifted.push(snapshot.path);
}

if (!drifted.length) {
    process.stderr.write('All generated outputs are unchanged.\n');
} else if (check) {
    for (const snapshot of snapshots) {
        if (!drifted.includes(snapshot.path) || snapshot.content === null) continue;
        writeFileSync(join(root, snapshot.path), snapshot.content);
    }
    process.stderr.write(`--check: ${drifted.length} output(s) drifted from the C tree and were restored: `
        + `${drifted.join(', ')}\n`);
    process.exitCode = 1;
} else {
    process.stderr.write(`${drifted.length} output(s) changed; run \`npm run compile\` before committing.\n`);
}
