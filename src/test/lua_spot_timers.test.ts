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

void test('restarting a Lua ice timer delays melting without changing another square', async t => {
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

void test('nh.start_timer_at ignores object timer types like nhlua.c', async t => {
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

    await assert.rejects(lua.executeAsync('nh.start_timer_at(0, 0, "melt", 10)'),
        /Unknown timer type \(line 1/);
});

void test('nh.start_timer_at accepts coordinate tables and lua_tointeger delays', async t => {
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

    assert.equal(game.level.requireAt(10, 5).typ, MOAT,
        'a zeroed delay melts the ice without waiting');
    assert.equal(game.level.requireAt(11, 5).typ, ICE);
});
