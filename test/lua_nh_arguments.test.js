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
void test('nh.rn2 and nh.random reject other argument counts with Wrong args', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(736n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    const core = currentLuaLifecycle().core;
    assert.ok(core, 'the core Lua state is running');
    await assert.rejects(core.executeAsync('nh.rn2()'), /Wrong args \(line 1/);
    await assert.rejects(core.executeAsync('nh.rn2(1, 2)'), /Wrong args \(line 1/);
    await assert.rejects(core.executeAsync('nh.random()'), /Wrong args \(line 1/);
    await assert.rejects(core.executeAsync('nh.random(1, 2, 3)'), /Wrong args \(line 1/);
    await assert.rejects(core.executeAsync('nh.pline()'), /Wrong args \(line 1/);
    await assert.rejects(core.executeAsync('nh.pline("a", true, true)'), /Wrong args \(line 1/);
});
void test('nh.eckey returns nothing for any other argument count', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(737n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    const core = currentLuaLifecycle().core;
    assert.ok(core, 'the core Lua state is running');
    core.execute(`
        empty = nh.eckey()
        extra = nh.eckey("adjust", true)
        bound = nh.eckey("adjust")
    `);
    assert.equal(core.getGlobal('empty'), null);
    assert.equal(core.getGlobal('extra'), null);
    assert.equal(typeof core.getGlobal('bound'), 'string');
});
void test('nh bindings read their string arguments with luaL_checkstring', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(738n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    const core = currentLuaLifecycle().core;
    assert.ok(core, 'the core Lua state is running');
    await assert.rejects(core.executeAsync('nh.impossible(nil)'), /bad argument #1 to 'impossible' \(string expected, got nil\)/);
    await assert.rejects(core.executeAsync('nh.parse_config({})'), /bad argument #1 to 'parse_config' \(string expected, got table\)/);
    await assert.rejects(core.executeAsync('nh.eckey(nil)'), /bad argument #1 to 'eckey' \(string expected, got nil\)/);
    await assert.rejects(core.executeAsync('nh.pline(true)'), /bad argument #1 to 'pline' \(string expected, got boolean\)/);
    // luaL_checkstring converts numbers, so an unbound numeric name is an
    // empty key description rather than an error or nil.
    core.execute('numeric = nh.eckey(123)');
    assert.equal(core.getGlobal('numeric'), '');
});
//# sourceMappingURL=lua_nh_arguments.test.js.map