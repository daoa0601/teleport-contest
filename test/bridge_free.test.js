import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    CompatibilityBridgeError, getBridgeUsageLedger, installReplayMovesGuard,
    resetBridgeUsageLedger, useCompatibilityBridge,
} from '../js/bridge_policy.js';
import { fastforward_pre_mklev } from '../js/fastforward.js';
import { paintFixtureScreen } from '../js/fixture_screen.js';
import { replayRogueTurn } from '../js/rogue_explore.js';
import { runSegment } from '../js/jsmain.js';
import {
    COLS_80, ROWS_24, decodeScreen, diffCell,
} from '../frozen/screen-decode.mjs';
import { auditBridgeFreeSource } from '../scripts/audit-bridge-free.mjs';

function normalizedRngSlice(entries) {
    return (entries || [])
        .filter(entry => typeof entry === 'string'
            && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry))
        .map(entry => entry.replace(/\s*@\s.*$/, '')
            .replace(/^\d+\s+/, '').trim());
}

function firstSequenceDifference(actual, expected) {
    const length = Math.max(actual.length, expected.length);
    let index = 0;
    while (index < length && actual[index] === expected[index]) index++;
    return index === length ? null : {
        index,
        actualLength: actual.length,
        expectedLength: expected.length,
        actual: actual.slice(Math.max(0, index - 2), index + 3),
        expected: expected.slice(Math.max(0, index - 2), index + 3),
    };
}

function firstScreenDifference(actualEncoded, expectedEncoded) {
    const actual = decodeScreen(actualEncoded || '');
    const expected = decodeScreen(expectedEncoded || '');
    for (let y = 0; y < ROWS_24; y++) {
        for (let x = 0; x < COLS_80; x++) {
            if (!diffCell(actual[y][x], expected[y][x])) continue;
            return {
                x, y,
                actual: actual[y][x],
                expected: expected[y][x],
            };
        }
    }
    return null;
}

function assertBoundedSessionParity(result, segment) {
    const screens = result.getScreens();
    const cursors = result.getCursors();
    const rngSlices = result.getRngSlices();
    assert.equal(screens.length, segment.steps.length);
    assert.equal(cursors.length, segment.steps.length);
    assert.equal(rngSlices.length, segment.steps.length);
    for (let step = 0; step < segment.steps.length; step++) {
        const expected = segment.steps[step];
        const rng = firstSequenceDifference(
            normalizedRngSlice(rngSlices[step]),
            normalizedRngSlice(expected.rng),
        );
        const screen = firstScreenDifference(screens[step], expected.screen);
        const cursor = firstSequenceDifference(
            cursors[step] || [], expected.cursor || [],
        );
        if (rng || screen || cursor) {
            assert.fail(`step ${step} parity mismatch ${JSON.stringify({
                rng, screen, cursor,
            })}`);
        }
    }
}

function withBridgeFreeMode(callback) {
    const previous = process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_BRIDGE_FREE = '1';
    try {
        return callback();
    } finally {
        if (previous === undefined) delete process.env.TELEPORT_BRIDGE_FREE;
        else process.env.TELEPORT_BRIDGE_FREE = previous;
    }
}

async function withBridgeFreeModeAsync(callback) {
    const previous = process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_BRIDGE_FREE = '1';
    try {
        return await callback();
    } finally {
        if (previous === undefined) delete process.env.TELEPORT_BRIDGE_FREE;
        else process.env.TELEPORT_BRIDGE_FREE = previous;
    }
}

test('bridge-free policy fails loudly and records a bounded call site', () => {
    resetBridgeUsageLedger();
    withBridgeFreeMode(() => {
        assert.throws(
            () => useCompatibilityBridge('test.seeded-replay'),
            error => error instanceof CompatibilityBridgeError
                && error.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error.bridgeId === 'test.seeded-replay'
                && error.callSite.includes('bridge_free.test.js'),
        );
        assert.deepEqual(getBridgeUsageLedger(), {
            bridgeFree: true,
            totalHits: 1,
            forbiddenHits: 1,
            bridges: {
                'test.seeded-replay': {
                    count: 1,
                    firstCallSite: getBridgeUsageLedger()
                        .bridges['test.seeded-replay'].firstCallSite,
                },
            },
        });
    });
});

test('replayMoves is poisoned and known replay boundaries are guarded', () => {
    withBridgeFreeMode(() => {
        for (const invoke of [
            () => {
                const state = {};
                installReplayMovesGuard(state);
                return state.replayMoves;
            },
            () => fastforward_pre_mklev(),
            () => replayRogueTurn(2),
            () => paintFixtureScreen('', null, {}),
        ]) {
            resetBridgeUsageLedger();
            assert.throws(invoke, error =>
                error?.code === 'TELEPORT_BRIDGE_FORBIDDEN');
            assert.equal(getBridgeUsageLedger().forbiddenHits, 1);
        }
    });
});

test('mechanical source audit covers fixture and replay additions', () => {
    const result = auditBridgeFreeSource();
    assert.deepEqual(result.failures, []);
    assert.ok(result.fixtureModules.length > 0);
    assert.ok(result.guardedModules.includes('fastforward.js'));
    assert.ok(result.guardedModules.includes('rogue_explore.js'));
});

test('bridge-free entry executes a live quiet-role turn with zero bridge hits', async () => {
    await withBridgeFreeModeAsync(async () => {
        const game = await runSegment({
            seed: 8000,
            datetime: '20260401090000',
            nethackrc: [
                'OPTIONS=name:Contestant,role:Tourist,race:human,gender:female,align:neutral',
                'OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen,pettype:none',
                'OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.3.1',
                'OPTIONS=symset:DECgraphics',
                '',
            ].join('\n'),
            moves: '.',
        });
        assert.ok(game.getScreens().length > 0);
        assert.ok(game.getRngLog().length > 0);
        assert.deepEqual(game.getBridgeUsageLedger(), {
            bridgeFree: true,
            totalHits: 0,
            forbiddenHits: 0,
            bridges: {},
        });
    });
});

test('bridge-free Samurai owns live pet, run, and prayer turns', async () => {
    await withBridgeFreeModeAsync(async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0017-samurai-altar-pray.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const result = await runSegment({ ...session, storage: new Map() });

        assertBoundedSessionParity(result, session);
        assert.deepEqual(result.getBridgeUsageLedger(), {
            bridgeFree: true,
            totalHits: 0,
            forbiddenHits: 0,
            bridges: {},
        });
    });
});
