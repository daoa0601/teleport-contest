import assert from 'node:assert/strict';
import test from 'node:test';
import { dosounds } from '../js/ambient_sounds.js';
import { FOUNTAIN } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { flush_screen } from '../js/display.js';
import { GameMap } from '../js/game.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { countLevelFeatures, mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
void test('Lua room features stay silent until the native feature recount boundary', async (t) => {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation must install the Lua des bindings');
    game.level = new GameMap();
    game.in_mklev = true;
    await lua.executeAsync(`
        des.level_init({ style = "solidfill", fg = "." })
        des.feature("fountain", 10, 10)
    `);
    requirePlayingGame(game);
    assert.equal(game.level.requireAt(11, 10).typ, FOUNTAIN);
    game.in_mklev = false;
    game.nhDisplay = new GameDisplay(null);
    initRng(262n);
    await dosounds();
    await flush_screen();
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trim(), '');
    countLevelFeatures();
    initRng(262n);
    await dosounds();
    await flush_screen();
    assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '', /You hear bubbling water\./);
});
//# sourceMappingURL=lua_feature_sounds.test.js.map