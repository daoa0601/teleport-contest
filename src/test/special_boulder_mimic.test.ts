import test from 'node:test';
import assert from 'node:assert/strict';

import { M_AP_OBJECT } from '../js/const.js';
import { HOLE } from '../js/mklev.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { init_dungeons } from '../js/dungeon.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

// C sp_lev.c:create_monster() gives a randomly placed mimic its requested
// boulder disguise and then, at sp_lev.c:2041, would retry the placement off
// bad spots. The guard re-tests m->x after sp_lev.c:1992 has recorded the
// placed monster's mx there, so it is never negative and the pinned C never
// retries: a boulder mimic keeps its first random spot even when that spot
// is a trap, and keeps the boulder disguise instead of restyling through
// set_mimic_sym(). The floor below is nothing but holes, so a retrying
// implementation would move the mimics off traps or restyle them, and both
// are observable deviations from the C behavior.
async function buildHoleFloorLevel() {
    freshGame({ flags: { bones: false } });
    initRng(4211n);
    init_objects();
    await init_dungeons();
}

void test('a randomly placed boulder mimic keeps its trap spot and disguise', async t => {
    await buildHoleFloorLevel();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation should install the Lua des bindings');
    game.level = new GameMap();
    game.in_mklev = true;
    initRng(97n);

    await lua.executeAsync(`
        des.level_init({ style = "solidfill", fg = " " })
        des.map({ map = [[
----------------
|..............|
|..............|
|..............|
|..............|
|..............|
|..............|
|..............|
|..............|
----------------
        ]] })
        for x = 1, 14 do
            for y = 1, 8 do
                des.trap("hole", x, y)
            end
        end
        des.monster({ id = "giant mimic", appear_as = "obj:boulder" })
        des.monster({ id = "giant mimic", appear_as = "obj:boulder" })
    `);

    requirePlayingGame(game);
    const level = game.level;
    const giantMimic = MONSTER_NAME.indexOf('giant mimic');
    const mimics = level.monsters.filter(monster => monster.mnum === giantMimic);
    assert.equal(mimics.length, 2, 'both Lua boulder mimics must be created');

    for (const mimic of mimics) {
        assert.equal(mimic.m_ap_type, M_AP_OBJECT);
        assert.equal(mimic.mappearance ?? -1, BOULDER,
            'an unretried boulder mimic keeps its requested disguise');
        assert.ok(
            level.traps.some(trap =>
                trap.ttyp === HOLE && trap.tx === mimic.mx && trap.ty === mimic.my),
            `the mimic stays on the hole it was first placed on (<${mimic.mx},${mimic.my}>)`);
    }
});

