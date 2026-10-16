import assert from 'node:assert/strict';
import test from 'node:test';
import { init_dungeons } from '../js/dungeon.js';
import { game } from '../js/gstate.js';
import { dungeonDepth } from '../js/hacklib.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { createDungeon } from './support/topology.js';

void test('dungeon initialization places the dummy surface at zero and Earth at minus one', async () => {
    freshGame({ flags: { debug: true } });
    initRng(271n);

    await init_dungeons();

    const dummy = game.specialLevels?.get('dummy');
    const earth = game.earth_level;
    assert.ok(dummy && earth);
    const dungeon = game.dungeons[dummy.dnum];
    assert.ok(dungeon);
    assert.equal(dungeon.depth_start + dummy.dlevel - 1, 0);
    assert.equal(dungeon.depth_start + earth.dlevel - 1, -1);
});

void test('depth uses the configured dungeon start even for the Elemental Planes', () => {
    const planes = createDungeon({ dname: 'The Elemental Planes', depth_start: -7, num_dunlevs: 8 });

    assert.equal(dungeonDepth(0, 1, [planes]), -7);
    assert.equal(dungeonDepth(0, 8, [planes]), 0);
});
