import assert from 'node:assert/strict';
import type { Monster } from '../../js/monster_types.js';
import type { WormMonster } from '../../js/monster_worm.js';

export function assertWormBody(monster: Monster): asserts monster is WormMonster {
    assert.ok(monster.wormno !== undefined, 'A worm body needs its reserved slot');
    assert.ok(monster.wormHead, 'A worm body needs its hidden head');
    assert.ok(monster.wormSegments, 'A worm body needs its tail list');
    assert.ok(monster.wormGrowTime !== undefined, 'A worm body needs its growth deadline');
}
