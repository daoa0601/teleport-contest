import assert from 'node:assert/strict';
import test from 'node:test';
import { MARK } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
async function graffitiAtDepth(t, seed, branchLevel, depthStart) {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.depth_start = depthStart;
    dungeon.num_dunlevs = branchLevel + 1;
    game.u.uz = { dnum: 0, dlevel: branchLevel };
    game.oracle_level = { dnum: 0, dlevel: 1, flags: { town: false }, alignment: null };
    game.medusa_level = undefined;
    game.specialLevels?.clear();
    game.branches = [];
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 6, h = 4, lit = 1, filled = 1 })
        end }}
        function post_level_generate() end
    `);
    initRng(seed);
    await mklev();
    return (requireGameLevel().engravings ?? []).filter(engraving => engraving.engr_type === MARK).length;
}
void test('ordinary-room graffiti chances depend on absolute depth rather than branch numbering', async (t) => {
    for (let seed = 1; seed <= 12; seed++) {
        const mainDungeon = await graffitiAtDepth(t, seed, 39, 1);
        const deeperBranch = await graffitiAtDepth(t, seed, 3, 37);
        assert.equal(deeperBranch, mainDungeon, `equivalent levels at absolute depth 39 must have the same graffiti chances (seed ${seed})`);
    }
});
//# sourceMappingURL=mklev_fill_depth.test.js.map