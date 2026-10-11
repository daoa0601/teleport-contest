import assert from 'node:assert/strict';
export function assertWormBody(monster) {
    assert.ok(monster.wormno !== undefined, 'A worm body needs its reserved slot');
    assert.ok(monster.wormHead, 'A worm body needs its hidden head');
    assert.ok(monster.wormSegments, 'A worm body needs its tail list');
    assert.ok(monster.wormGrowTime !== undefined, 'A worm body needs its growth deadline');
}
//# sourceMappingURL=worms.js.map