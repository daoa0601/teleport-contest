// Compatibility-bridge policy and bounded runtime ledger.
//
// TELEPORT_BRIDGE_FREE=1 is an execution contract, not a scoring shortcut:
// trace fixtures, replay tables, snapshot painters, fast-forward helpers, and
// session-shape control flow must not participate in a successful run.

// Keep this module dependency-free so every compatibility boundary can import
// it without creating game-engine cycles.

const usage = new Map();
let forbiddenHits = 0;

export class CompatibilityBridgeError extends Error {
    constructor(bridgeId, callSite) {
        super(`Bridge-free mode forbids compatibility bridge "${bridgeId}" at ${callSite}`);
        this.name = 'CompatibilityBridgeError';
        this.code = 'TELEPORT_BRIDGE_FORBIDDEN';
        this.bridgeId = bridgeId;
        this.callSite = callSite;
    }
}

export function bridgeFreeEnabled() {
    return typeof process !== 'undefined'
        && process?.env?.TELEPORT_BRIDGE_FREE === '1';
}

function captureCallSite() {
    const lines = String(new Error().stack || '').split('\n').slice(2);
    const frame = lines.find(line => !line.includes('/bridge_policy.js'));
    return frame?.trim().replace(/^at\s+/, '') || '<unknown call site>';
}

export function useCompatibilityBridge(bridgeId) {
    if (!bridgeId || typeof bridgeId !== 'string')
        throw new TypeError('compatibility bridge id must be a non-empty string');

    const previous = usage.get(bridgeId);
    const callSite = previous?.firstCallSite || captureCallSite();
    usage.set(bridgeId, {
        count: (previous?.count || 0) + 1,
        firstCallSite: previous?.firstCallSite || callSite,
    });

    if (bridgeFreeEnabled()) {
        forbiddenHits++;
        throw new CompatibilityBridgeError(bridgeId, callSite);
    }
}

export function resetBridgeUsageLedger() {
    usage.clear();
    forbiddenHits = 0;
}

export function getBridgeUsageLedger() {
    const bridges = {};
    let totalHits = 0;
    for (const [bridgeId, entry] of [...usage.entries()].sort()) {
        bridges[bridgeId] = { ...entry };
        totalHits += entry.count;
    }
    return {
        bridgeFree: bridgeFreeEnabled(),
        totalHits,
        forbiddenHits,
        bridges,
    };
}

// A poisoned property turns any replayMoves read or write added outside the
// explicit compatibility classifier into a named runtime failure.  The
// classifier itself is skipped in bridge-free mode before reading the value.
export function installReplayMovesGuard(target) {
    if (!bridgeFreeEnabled()) return;
    Object.defineProperty(target, 'replayMoves', {
        configurable: true,
        enumerable: false,
        get() {
            useCompatibilityBridge('session-shape.replayMoves-read');
        },
        set() {
            useCompatibilityBridge('session-shape.replayMoves-write');
        },
    });
}
