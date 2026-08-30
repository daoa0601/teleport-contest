import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CompatibilityBridgeError, getBridgeUsageLedger, installReplayMovesGuard,
    resetBridgeUsageLedger, useCompatibilityBridge,
} from '../js/bridge_policy.js';
import { paintFixtureScreen } from '../js/fixture_screen.js';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';

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
        const ledger = getBridgeUsageLedger();
        assert.equal(ledger.bridgeFree, true);
        assert.equal(ledger.totalHits, 1);
        assert.equal(ledger.forbiddenHits, 1);
        assert.equal(ledger.bridges['test.seeded-replay'].count, 1);
        assert.match(
            ledger.bridges['test.seeded-replay'].firstCallSite,
            /bridge_free\.test\.js/,
        );
    });
});

test('production replay state is unreadable in bridge-free mode', () => {
    withBridgeFreeMode(() => {
        const state = {};
        installReplayMovesGuard(state);
        assert.throws(
            () => state.replayMoves,
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN',
        );
    });
});

test('fixture painting is unavailable in bridge-free mode', () => {
    withBridgeFreeMode(() => {
        assert.throws(
            () => paintFixtureScreen('', null, {}),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN',
        );
    });
});

test('bridge-free entry executes a live quiet-role turn with zero bridge hits', async () => {
    await withBridgeFreeModeAsync(async () => {
        const result = await runSegment({
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
        assert.equal(game.urole?.key, 'tourist');
        assert.equal(game.moves, 2);
        assert.equal(game.u?.umovement, 12);
        assert.ok(game.u?.ux > 0);
        assert.ok(game.u?.uy > 0);
        assert.deepEqual(result.getBridgeUsageLedger(), {
            bridgeFree: true,
            totalHits: 0,
            forbiddenHits: 0,
            bridges: {},
        });
    });
});
