import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

for (const [option, female] of [['female', true], ['!female', false], ['male', false], ['!male', true]] as const) {
    void test(`${option} selects the initial gender without an extra prompt`, async () => {
        const engine = await runSegment({
            seed: 47, datetime: '20260801120000', moves: '', storage: memoryStorage(),
            nethackrc: `OPTIONS=name:Traveler,role:priest,race:human,align:neutral,${option},!legacy,!tutorial,pettype:none`,
        });
        await engine.lua.destroy();

        assert.equal(game.moves, 1, 'all four character facets were specified');
        assert.equal(game.flags.female, female);
        assert.equal(game.flags.initgend, Number(female));
    });
}
