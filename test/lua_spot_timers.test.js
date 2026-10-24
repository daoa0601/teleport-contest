import assert from 'node:assert/strict';
import test from 'node:test';
import { ICE, MOAT } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { runDueTimers } from '../js/timer_effects.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
void test('restarting a Lua ice timer delays melting without changing another square', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    const start = game.moves;
    await lua.executeAsync(`
        des.map({ map = "II", x = 10, y = 5 })
        nh.start_timer_at(0, 0, "melt-ice", 10)
        nh.start_timer_at(0, 0, "melt-ice", 20)
        nh.start_timer_at(1, 0, "melt-ice", 10)
    `);
    game.moves = start + 10;
    await runDueTimers();
    assert.equal(game.level.requireAt(10, 5).typ, ICE, 'the replacement postpones melting');
    assert.equal(game.level.requireAt(11, 5).typ, MOAT, 'another square still melts on time');
    game.moves = start + 20;
    await runDueTimers();
    assert.equal(game.level.requireAt(10, 5).typ, MOAT, 'the replacement timer eventually melts the ice');
});
void test('nh.start_timer_at ignores object timer types like nhlua.c', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(734n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    await lua.executeAsync('des.map({ map = "II", x = 10, y = 5 })');
    const start = game.moves;
    // nhl_get_timertype() accepts these names; timer_is_pos() rejects
    // them, so the call schedules nothing and melts no ice.
    await lua.executeAsync(`
        nh.start_timer_at(0, 0, "rot-organic", 10)
        nh.start_timer_at(1, 0, "burn-obj", 10)
    `);
    game.moves = start + 10;
    await runDueTimers();
    assert.equal(game.level.requireAt(10, 5).typ, ICE);
    assert.equal(game.level.requireAt(11, 5).typ, ICE);
    // luaL_checkoption() reports the invalid name through luaL_argerror
    // with the stack index nhl_get_timertype() was given.
    await assert.rejects(lua.executeAsync('nh.start_timer_at(0, 0, "melt", 10)'), /bad argument #-2 to 'start_timer_at' \(invalid option 'melt'\)/);
    // With one argument, Lua stack index -2 is the called function itself.
    await assert.rejects(lua.executeAsync('nh.start_timer_at(5)'), /bad argument #-2 to 'start_timer_at' \(string expected, got function\)/);
    await assert.rejects(lua.executeAsync('nh.start_timer_at(0, 0, 8, 10)'), /bad argument #-2 to 'start_timer_at' \(invalid option '8'\)/);
});
void test('nh.start_timer_at accepts coordinate tables and lua_tointeger delays', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(735n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    await lua.executeAsync('des.map({ map = "II", x = 10, y = 5 })');
    // get_coord() reads { x = , y = } tables; lua_tointeger() turns the
    // non-numeric delay into zero, so the ice melts at the current move.
    await lua.executeAsync(`
        nh.start_timer_at({ x = 0, y = 0 }, "melt-ice", "soon")
    `);
    await runDueTimers();
    assert.equal(game.level.requireAt(10, 5).typ, MOAT, 'a zeroed delay melts the ice without waiting');
    assert.equal(game.level.requireAt(11, 5).typ, ICE);
});
void test('nh.start_timer_at wraps coordinates as signed 16-bit values before map bounds checks', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(740n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    const start = game.moves;
    await lua.executeAsync('des.map({ map = "II\\nII", x = 10, y = 5 })');
    game.level.requireAt(9, 4).typ = ICE;
    await lua.executeAsync(`
        nh.start_timer_at(65536, 0, "melt-ice", 10)
        nh.start_timer_at({ x = 1, y = 65536 }, "melt-ice", 10)
        nh.start_timer_at({ -65536, -65535 }, "melt-ice", 10)
        nh.start_timer_at(32769, 1, "melt-ice", 10)
        nh.start_timer_at(9007199254740991, 9007199254740991, "melt-ice", 10)
    `);
    game.moves = start + 10;
    await runDueTimers();
    assert.equal(game.level.requireAt(10, 5).typ, MOAT, 'the positional x wraps to zero');
    assert.equal(game.level.requireAt(11, 5).typ, MOAT, 'the named y wraps to zero');
    assert.equal(game.level.requireAt(10, 6).typ, MOAT, 'negative array entries wrap before adding the map origin');
    assert.equal(game.level.requireAt(11, 6).typ, ICE, 'a signed coordinate outside the map schedules nothing');
    assert.equal(game.level.requireAt(9, 4).typ, MOAT, 'large integer coordinates narrow before adding the map origin');
});
void test('nh.start_timer_at coordinate tables validate like get_coord', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(739n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    await lua.executeAsync('des.map({ map = "II", x = 10, y = 5 })');
    // get_coord() converts x with luaL_checkinteger before reading y.
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ x = {} }, "melt-ice", 10)'), /bad argument #-1 to 'start_timer_at' \(number expected, got table\)/);
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ x = "home" }, "melt-ice", 10)'), /bad argument #-1 to 'start_timer_at' \(number expected, got string\)/);
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ x = 0 }, "melt-ice", 10)'), /Not a coordinate \(line 1/);
    // Two-entry array coordinates: get_table_intarray_entry() converts
    // numbers with lua_tointeger and reports the C's hardcoded entry
    // number for anything else.
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ "a", 0 }, "melt-ice", 10)'), /Array entry #1 is string, expected number \(line 1/);
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ 0 }, "melt-ice", 10)'), /Not a coordinate \(line 1/);
    // A non-integral array entry becomes zero, like lua_tointeger().
    await lua.executeAsync('nh.start_timer_at({ 1.5, 0 }, "melt-ice", 0)');
    await runDueTimers();
    assert.equal(game.level.requireAt(10, 5).typ, MOAT, 'the non-integral entry reads as coordinate zero');
    assert.equal(game.level.requireAt(11, 5).typ, ICE);
});
void test('timer arguments convert Lua numeral strings by luaO_str2num rules', async (t) => {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(741n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    await lua.executeAsync('des.map({ map = "II", x = 10, y = 5 })');
    // "0b1" and "Infinity" are JavaScript numbers, not Lua numbers, so
    // lua_isnumber rejects them and luaL_checkinteger blames the type.
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ x = "0b1", y = 0 }, "melt-ice", 10)'), /bad argument #-1 to 'start_timer_at' \(number expected, got string\)/);
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ x = "Infinity", y = 0 }, "melt-ice", 10)'), /bad argument #-1 to 'start_timer_at' \(number expected, got string\)/);
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ "0b1", 0 }, "melt-ice", 10)'), /Array entry #1 is string, expected number \(line 1/);
    // A string that converts but has no integer representation keeps
    // intererror()'s other message.
    await assert.rejects(lua.executeAsync('nh.start_timer_at({ x = "1.5", y = 0 }, "melt-ice", 10)'), /bad argument #-1 to 'start_timer_at' \(number has no integer representation\)/);
    // Hex floats convert: both coordinates and the delay read 0x0p0 as 0,
    // so the ice melts on the current move.
    await lua.executeAsync('nh.start_timer_at({ "0x0p0", 0 }, "melt-ice", "0x0p0")');
    await runDueTimers();
    assert.equal(game.level.requireAt(10, 5).typ, MOAT, 'hex float numerals name coordinate zero');
    assert.equal(game.level.requireAt(11, 5).typ, ICE);
    // A delay string outside Lua's grammar converts as zero, not three:
    // the second sheet melts without waiting for move three.
    await lua.executeAsync('nh.start_timer_at(1, 0, "melt-ice", "0b11")');
    await runDueTimers();
    assert.equal(game.level.requireAt(11, 5).typ, MOAT, 'a non-numeral delay reads as zero, not JavaScript 0b11');
});
//# sourceMappingURL=lua_spot_timers.test.js.map