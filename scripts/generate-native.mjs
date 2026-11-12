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
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
];
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
];
function readOutput(path) {
    try {
        return readFileSync(join(root, path), 'utf8');
    }
    catch {
        return null;
    }
}
function run(command, args) {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0)
        throw new Error(`${command} ${args.join(' ')} exited with status ${result.status ?? 'signal'}`);
}
function regenerateArtifacts() {
    const cache = join(root, '.cache');
    mkdirSync(cache, { recursive: true });
    const build = mkdtempSync(join(cache, 'generate-native-'));
    try {
        // The artifact tool imports object_data.js. Compile into this directory
        // so --check never overwrites workspace emissions or source maps.
        run('npm', ['run', 'compile', '--', '--outDir', build]);
        mkdirSync(join(build, 'src', 'js'), { recursive: true });
        run(process.execPath, [join(build, 'tools', 'gen-artifacts.mjs'), '--source', sourceTree]);
        copyFileSync(join(build, 'src', 'js', 'artifact_data.ts'), join(root, 'src', 'js', 'artifact_data.ts'));
    }
    finally {
        rmSync(build, { recursive: true, force: true });
    }
}
function lineDelta(before, after) {
    // Multiset line difference: enough to size a change without a diff tool.
    const counts = new Map();
    for (const line of before.split('\n'))
        counts.set(line, (counts.get(line) ?? 0) + 1);
    let added = 0;
    for (const line of after.split('\n')) {
        const remaining = counts.get(line) ?? 0;
        if (remaining > 0)
            counts.set(line, remaining - 1);
        else
            added++;
    }
    let removed = 0;
    for (const remaining of counts.values())
        removed += remaining;
    return ` (+${added}/-${removed} lines)`;
}
const snapshots = outputs.map(path => ({ path, content: readOutput(path) }));
process.stderr.write(`C sources: ${sourceTree}\n`);
// Restore every watched file to its pre-run bytes; --check calls this on
// both drift and failure so a check run never leaves overwrites behind.
function restoreWatchedFiles() {
    const restored = [];
    for (const snapshot of snapshots) {
        const after = readOutput(snapshot.path);
        if (after === snapshot.content)
            continue;
        if (snapshot.content === null) {
            if (after !== null) {
                rmSync(join(root, snapshot.path));
                restored.push(`${snapshot.path} (removed)`);
            }
            continue;
        }
        writeFileSync(join(root, snapshot.path), snapshot.content);
        restored.push(snapshot.path);
    }
    return restored;
}
const artifactProjection = generators[generators.length - 1];
try {
    for (const generator of generators) {
        process.stderr.write(`${generator}\n`);
        // The artifact projection resolves object constants through the emitted
        // object_data.js, so use an isolated build when this pass changed it.
        if (generator === artifactProjection) {
            const objectData = snapshots.find(snapshot => snapshot.path === 'src/js/object_data.ts');
            if (objectData !== undefined && objectData.content !== null
                && objectData.content !== readOutput('src/js/object_data.ts')) {
                process.stderr.write('object_data.ts changed; compiling the artifact projection in .cache/\n');
                regenerateArtifacts();
                continue;
            }
        }
        run(process.execPath, [join(root, generator), '--source', sourceTree]);
    }
}
catch (error) {
    if (check) {
        const restored = restoreWatchedFiles();
        if (restored.length)
            process.stderr.write(`--check: generator failed; restored ${restored.join(', ')}\n`);
    }
    throw error;
}
const drifted = [];
for (const snapshot of snapshots) {
    const after = readOutput(snapshot.path);
    if (after === snapshot.content)
        continue;
    const delta = snapshot.content === null
        ? ' (new file)' : after === null ? ' (deleted)' : lineDelta(snapshot.content, after);
    process.stderr.write(`${snapshot.path}: changed${delta}\n`);
    drifted.push(snapshot.path);
}
if (!drifted.length) {
    process.stderr.write('All generated outputs are unchanged.\n');
}
else if (check) {
    restoreWatchedFiles();
    process.stderr.write(`--check: ${drifted.length} output(s) drifted from the C tree and were restored: `
        + `${drifted.join(', ')}\n`);
    process.exitCode = 1;
}
else {
    process.stderr.write(`${drifted.length} output(s) changed; run \`npm run compile\` before committing.\n`);
}
//# sourceMappingURL=generate-native.mjs.map