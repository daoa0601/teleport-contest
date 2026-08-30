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
    // Compatibility classifiers may remain for the legacy public-regression
    // path, but bridge-free mode must make each one structurally unreachable
    // rather than relying on an empty replay string or lucky coordinates.
    const compatibilityClassifiers = [
        '_knightCombatPath',
        '_wizardBindPath', '_wizardPolyPath', '_wizardQuaffPath',
        '_touristExplorePath',
        '_knightPonyPath',
    ];
    for (const classifier of compatibilityClassifiers) {
        const explicitLegacyGate = new RegExp(
            `g\\.${classifier}\\s*=\\s*!bridgeFree\\s*&&`,
        );
        if (!explicitLegacyGate.test(allmain))
            failures.push(`allmain.js: ${classifier} lacks an explicit legacy gate`);
    }
    const forbiddenSamuraiReplayTokens = [
        'SAMURAI_DOG_RNG', 'SAMURAI_NORTH_ROOM_DOG_RNG',
        'SAMURAI_ALTAR_PATH_RNG', 'SAMURAI_ALTAR_HERO_PATHS',
        'SAMURAI_ALTAR_PET_POSITIONS', 'samuraiMonsterActionRng',
        'samuraiAltarActionRng', '_samuraiTimedActions',
        '_samuraiAltarPath', 'SAMURAI_ALTAR_PRAYER_TURN_RNG',
    ];
    for (const token of forbiddenSamuraiReplayTokens) {
        for (const file of ['allmain.js', 'cmd.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy Samurai replay token ${token}`);
        }
    }
    const cmd = sources.get('cmd.js');
    const forbiddenSamuraiTracePredicates = [
        /urole\?\.key === ['"]samurai['"]\s*&&\s*monster\.mnum === 158/,
        /urole\?\.key === ['"]samurai['"]\s*&&\s*newx === 43\s*&&\s*newy === 18/,
    ];
    for (const predicate of forbiddenSamuraiTracePredicates) {
        if (predicate.test(cmd))
            failures.push(`cmd.js: trace-shaped Samurai predicate ${predicate}`);
    }
    const forbiddenRogueReplayTokens = [
        '_rogueExplorePath', '_rogueFriday13Path', '_rogueOrcPath',
        '_rogueChargenPath', '_rogueFriday13RngReplayed',
        '_rogueFriday13Commands', '_rogueOrcTimedActions',
        'ROGUE_PET_POSITIONS', 'replayRogue', 'rogueFriday13Command',
        'rogueOrcTimedAction', '_friday13ElapsedTurns',
        '_friday13ForceFight', '_rogueFriday13SavePath',
    ];
    for (const token of forbiddenRogueReplayTokens) {
        for (const file of ['allmain.js', 'cmd.js', 'insight.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy Rogue replay token ${token}`);
        }
    }
    for (const file of [
        'rogue_explore.js', 'rogue_friday13.js', 'rogue_orc.js',
    ]) {
        if (sources.has(file))
            failures.push(`${file}: legacy Rogue replay module still exists`);
    }
    const forbiddenPriestReplayTokens = [
        '_priestExtcmdPath', '_priestCastPath', 'priestDogSearchRng',
        'placePriestPet', 'replayPriestExtcmdBoundary',
        'paintPriestExtcmdScreen', 'seeded-replay.priest-extcmd',
        'priest.passive-projectile',
    ];
    for (const token of forbiddenPriestReplayTokens) {
        for (const file of ['allmain.js', 'cmd.js', 'jsmain.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy Priest replay token ${token}`);
        }
    }
    if (sources.has('priest_extcmd.js'))
        failures.push('priest_extcmd.js: legacy Priest replay module still exists');
    const forbiddenStartupReplayTokens = [
        'fastforward_pre_mklev', 'fastforward_post_mklev',
        'fastforward_fill_mineralize', 'fastforward.pre-mklev',
        'fastforward.post-mklev', 'fastforward.mineralize',
        'realRoleStartup',
    ];
    for (const token of forbiddenStartupReplayTokens) {
        for (const file of ['allmain.js', 'fastforward.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy startup replay token ${token}`);
        }
    }
    for (const token of ['_valkChatPath', 'valkyrie.chat']) {
        if (allmain.includes(token))
            failures.push(`allmain.js: legacy Valkyrie chat token ${token}`);
    }
    const forbiddenValkyrieReplayTokens = [
        '_valkPitPath', 'valkPit', 'replayValkPit',
        'seeded-replay.valkyrie-pit',
    ];
    for (const token of forbiddenValkyrieReplayTokens) {
        for (const file of ['allmain.js', 'cmd.js', 'detect.js', 'mklev.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy Valkyrie pit token ${token}`);
        }
    }
    if (sources.has('valk_pit.js'))
        failures.push('valk_pit.js: legacy Valkyrie replay module still exists');
    const forbiddenRangerReplayTokens = [
        '_rangerNamePath', 'rangerNameMonsterActionRng',
        'fastforward_ranger_step', 'fastforward.ranger-turn',
        'ranger.named-start', 'dorangerfire', 'rangerMore',
    ];
    for (const token of forbiddenRangerReplayTokens) {
        for (const file of ['allmain.js', 'cmd.js', 'fastforward.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy Ranger replay token ${token}`);
        }
    }
    const forbiddenHealerReplayTokens = [
        '_healerNewmoonPath', 'HEALER_EARLY_TURN_RNG',
        'healerEarlyTurnRng', 'replayHealerSleepRay',
        'replayHealerWake', 'replayHealerLateSearch',
        'placeHealerPet', 'removeHealerFloorGold',
        'seeded-replay.healer-newmoon', 'healer.newmoon',
    ];
    for (const token of forbiddenHealerReplayTokens) {
        for (const file of ['allmain.js', 'cmd.js', 'detect.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy Healer replay token ${token}`);
        }
    }
    if (sources.has('healer_newmoon.js'))
        failures.push('healer_newmoon.js: legacy Healer replay module still exists');
    const forbiddenMonkReplayTokens = [
        '_monkNorthPath', '_monkNorthSearches', '_monkNorthMovementIndex',
        'replayMonkTurn', 'placeMonkMonster', 'placeMonkHero',
        'monkNorthFinish', 'monkNorthCorpse', 'monkNorthMovement',
        'monkNorthPickup', 'seeded-replay.monk-search',
    ];
    for (const token of forbiddenMonkReplayTokens) {
        for (const file of ['allmain.js', 'cmd.js', 'detect.js', 'display.js']) {
            if (sources.get(file)?.includes(token))
                failures.push(`${file}: legacy Monk replay token ${token}`);
        }
    }
    if (sources.has('monk_search.js'))
        failures.push('monk_search.js: legacy Monk replay module still exists');
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
