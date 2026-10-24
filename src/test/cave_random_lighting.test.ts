import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOM } from '../js/const.js';
import { mkmap } from '../js/mkmap.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';

for (const depth of [100, -100]) {
    void test(`random cave lighting allows lit and dark floors at depth ${depth}`, async () => {
        const { level } = freshGame({ hero: { uz: { dnum: 0, dlevel: depth } } });
        const lighting = new Set<boolean>();
        for (let seed = 1; seed <= 32; seed++) {
            initRng(seed);

            await mkmap({ lit: -1, joined: false, walled: false });

            const floor = level.locations.flat().find(loc => loc.typ === ROOM);
            assert.ok(floor, 'the cave must contain foreground terrain');
            lighting.add(floor.lit);
        }
        assert.ok(lighting.has(false), 'deep caves are sometimes dark');
        assert.ok(lighting.has(true), 'deep caves can still be lit');
    });
}
