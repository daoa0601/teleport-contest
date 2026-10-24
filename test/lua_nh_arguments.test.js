import test from 'node:test';
import assert from 'node:assert/strict';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
// nhlua.c raises nhl_error("Wrong args") (or the per-function variant) when
// these bindings receive any other argument count.
void test('nh bindings reject the argument counts nhlua.c rejects', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(733n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    await assert.rejects(lua.executeAsync('nh.impossible("a", "b")'), /Wrong args \(line 1/);
    await assert.rejects(lua.executeAsync('nh.parse_config("OPTIONS=color", true)'), /Wrong args \(line 1/);
    await assert.rejects(lua.executeAsync('nh.level_difficulty(1)'), /level_difficulty should not have any args \(line 1/);
    await assert.rejects(lua.executeAsync('nh.debug_themerm(true, true)'), /debug_themerm should have 1 boolean arg \(line 1/);
});
//# sourceMappingURL=lua_nh_arguments.test.js.map