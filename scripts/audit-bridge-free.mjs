#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_ROOT = join(ROOT, 'js');

function lineNumber(source, offset) {
    return source.slice(0, offset).split('\n').length;
}

export function auditBridgeFreeSource() {
    const failures = [];
    const files = readdirSync(JS_ROOT)
        .filter(file => file.endsWith('.js'))
        .sort();
    const sources = new Map(files.map(file => [file,
        readFileSync(join(JS_ROOT, file), 'utf8')]));

    // replayMoves may exist only at the runner installation boundary, the
    // one compatibility classifier gate, the poisoned policy property, and
    // save-state's explicit non-serialized key list.
    const allowedReplayMoveFiles = new Set([
        'allmain.js', 'bridge_policy.js', 'jsmain.js', 'save.js',
    ]);
    for (const [file, source] of sources) {
        if (!source.includes('replayMoves')) continue;
        if (!allowedReplayMoveFiles.has(file)) {
            failures.push(`${file}: replayMoves escaped the centralized gate`);
        }
    }
    const allmain = sources.get('allmain.js');
    const directAllmainReads = [...allmain.matchAll(/\bg\.replayMoves\b/g)];
    if (directAllmainReads.length !== 1) {
        failures.push(`allmain.js: expected one guarded g.replayMoves read, found ${directAllmainReads.length}`);
    }
    const jsmain = sources.get('jsmain.js');
    if (!jsmain.includes('const fixturesEnabled = !bridgeFreeEnabled()'))
        failures.push('jsmain.js: top-level fixtures are not gated by bridge-free mode');
    if (!jsmain.includes('installReplayMovesGuard(g)'))
        failures.push('jsmain.js: replayMoves poison guard is not installed');

    // Top-level fixture modules must remain reachable only from the dynamic
    // legacy router.  Bridge-free jsmain must not statically import or decode
    // any fixture payload.
    for (const [file, source] of sources) {
        if (file === 'session_fixtures.js') continue;
        const fixtureImport = /from\s+['"]\.\/[A-Za-z0-9_]+_fixture\.js['"]/g;
        for (const match of source.matchAll(fixtureImport)) {
            failures.push(`${file}:${lineNumber(source, match.index)} imports a top-level fixture`);
        }
    }
    if (!jsmain.includes("await import('./session_fixtures.js')"))
        failures.push('jsmain.js: legacy fixture router is not dynamically imported');
    const fixtureModules = files.filter(file => file.endsWith('_fixture.js'));
    const fixtureRouter = sources.get('session_fixtures.js') || '';
    for (const fixtureModule of fixtureModules) {
        if (!fixtureRouter.includes(`from './${fixtureModule}'`))
            failures.push(`session_fixtures.js: missing ${fixtureModule}`);
    }

    // Discover seeded-replay and fast-forward exporters mechanically.  Every
    // owning module must invoke the centralized runtime policy; adding a new
    // replay file without a guard fails this audit.
    const bridgeExporter = /export\s+(?:async\s+)?function\s+(?:replay[A-Za-z0-9_]*|fastforward_[A-Za-z0-9_]*)\s*\(/;
    const guardedModules = [];
    for (const [file, source] of sources) {
        if (!bridgeExporter.test(source)) continue;
        guardedModules.push(file);
        if (!source.includes("from './bridge_policy.js'"))
            failures.push(`${file}: replay exporter lacks bridge policy import`);
        if (!source.includes('useCompatibilityBridge('))
            failures.push(`${file}: replay exporter lacks a runtime bridge guard`);
    }
    const fixtureScreen = sources.get('fixture_screen.js');
    if (!fixtureScreen.includes("useCompatibilityBridge('snapshot-painter.fixture-screen')"))
        failures.push('fixture_screen.js: snapshot painter lacks a runtime bridge guard');
    if (!allmain.includes("useCompatibilityBridge('seeded-replay.wizard-bind-maintenance')"))
        failures.push('allmain.js: internal Wizard replay lacks a runtime bridge guard');

    return {
        failures,
        filesAudited: files.length,
        guardedModules,
        fixtureModules,
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const result = auditBridgeFreeSource();
    if (result.failures.length) {
        console.error('Bridge-free source audit failed:');
        for (const failure of result.failures) console.error(`- ${failure}`);
        process.exitCode = 1;
    } else {
        console.log(JSON.stringify({
            ok: true,
            filesAudited: result.filesAudited,
            guardedModules: result.guardedModules.length,
            fixtureModules: result.fixtureModules.length,
        }));
    }
}
