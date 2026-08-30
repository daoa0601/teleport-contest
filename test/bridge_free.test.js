import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CompatibilityBridgeError, getBridgeUsageLedger, installReplayMovesGuard,
    resetBridgeUsageLedger, useCompatibilityBridge,
} from '../js/bridge_policy.js';
import { fastforward_pre_mklev } from '../js/fastforward.js';
import { paintFixtureScreen } from '../js/fixture_screen.js';
import { replayCavemanTurn } from '../js/caveman_explore.js';
import { runSegment } from '../js/jsmain.js';
import { auditBridgeFreeSource } from '../scripts/audit-bridge-free.mjs';

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
            () => replayCavemanTurn(2),
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
    assert.ok(result.guardedModules.includes('caveman_explore.js'));
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
