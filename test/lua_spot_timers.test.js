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
//# sourceMappingURL=lua_spot_timers.test.js.map