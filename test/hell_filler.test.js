import test from 'node:test';
import assert from 'node:assert/strict';

import { ICE, ROOM, VIBRATING_SQUARE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateHellFillerLevel } from '../js/mklev.js';
import { countTerrain, levelStairs } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildHell({ seed = 173, invocation = false } = {}) {
    const active = freshSpecialLevel({
        prototype: 'hellfill', seed,
        depth: invocation ? 29 : 20,
    });
    game.dungeons[0] = {
        dname: 'Gehennom', depth_start: 1, num_dunlevs: 30,
        flags: { hellish: true },
    };
    await generateHellFillerLevel(active);
}

test('Hell filler builds playable populated levels', async () => {
    for (const seed of [173, 1038]) {
        await buildHell({ seed });
        assert.ok(game.level.flags.is_maze_lev
            || game.level.flags.is_cavernous_lev);
        assert.equal(levelStairs(game).length, 2);
        assert.ok(countTerrain(game.level, ROOM, ICE) > 20);
        assert.ok(game.level.monsters.length >= 8);
    }
});

test('the invocation level has a vibrating square instead of a down stair',
    async () => {
        await buildHell({ seed: 519, invocation: true });
        assert.equal(levelStairs(game).length, 1);
        assert.equal(game.level.traps.filter(
            trap => trap.ttyp === VIBRATING_SQUARE,
        ).length, 1);
    });
