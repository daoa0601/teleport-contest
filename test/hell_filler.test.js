import { createDungeon, createSpecialLevel } from './support/topology.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ICE, IS_LAVA, IS_POOL, ROOM, VIBRATING_SQUARE } from '../js/const.js';
import { BOULDER } from '../js/object_data.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { generateHellFillerLevel } from '../js/mklev.js';
import { countTerrain, levelStairs } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
async function buildHell({ seed = 173, invocation = false } = {}) {
    const active = freshSpecialLevel({
        prototype: 'hellfill', seed,
        depth: invocation ? 29 : 20,
    });
    game.dungeons[0] = createDungeon({
        dname: 'Gehennom', depth_start: 1, num_dunlevs: 30,
        flags: { hellish: true },
    });
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    await generateHellFillerLevel(active);
}
void test('Hell filler builds playable populated levels', async () => {
    for (const seed of [173, 1038]) {
        await buildHell({ seed });
        assert.ok(requireGameLevel(game).flags.is_maze_lev
            || requireGameLevel(game).flags.is_cavernous_lev);
        assert.equal(levelStairs(game).length, 2);
        assert.ok(countTerrain(requireGameLevel(), ROOM, ICE) > 20);
        assert.ok(requireGameLevel(game).monsters.length >= 8);
    }
});
void test('Hell filler removes boulders from liquid before the level is entered', async () => {
    for (const seed of [173, 178, 1038]) {
        await buildHell({ seed });
        const level = requireGameLevel();
        for (const column of level.objects) {
            for (const pile of column ?? []) {
                for (const object of pile ?? []) {
                    if (object.otyp !== BOULDER)
                        continue;
                    const terrain = level.requireAt(object.ox, object.oy).typ;
                    assert.equal(IS_LAVA(terrain) || IS_POOL(terrain), false, `seed ${seed}: boulder remains on liquid at ${object.ox},${object.oy}`);
                }
            }
        }
    }
});
void test('the invocation level has a vibrating square instead of a down stair', async () => {
    await buildHell({ seed: 519, invocation: true });
    assert.equal(levelStairs(game).length, 1);
    assert.equal(requireGameLevel(game).traps.filter(trap => trap.ttyp === VIBRATING_SQUARE).length, 1);
});
//# sourceMappingURL=hell_filler.test.js.map