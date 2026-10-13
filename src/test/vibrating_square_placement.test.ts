import assert from 'node:assert/strict';
import test from 'node:test';
import { VIBRATING_SQUARE } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev, mkstairs } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { levelStairs } from './support/level-state.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

void test('Lua vibrating squares ignore requested coordinates and leave space for the invocation area', async t => {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation must install the Lua des bindings');
    requirePlayingGame(game);
    game.level = new GameMap();
    game.u.uz.dlevel = 8;
    game.stairs = null;
    game.in_mklev = true;
    initRng(97n);

    await lua.executeAsync('des.level_init({ style = "solidfill", fg = "." })');
    mkstairs(10, 10, true, null);
    await lua.executeAsync('des.trap({ type = "vibrating square", x = 1, y = 0 })');

    requirePlayingGame(game);
    const trap = game.level.traps.find(candidate => candidate.ttyp === VIBRATING_SQUARE);
    assert.ok(trap, 'Lua must create the vibrating square');
    assert.ok(trap.tx >= 7 && trap.tx <= 73, `unsafe invocation x: ${trap.tx}`);
    assert.ok(trap.ty >= 6 && trap.ty <= 16, `unsafe invocation y: ${trap.ty}`);
    const up = levelStairs(game).find(stair => stair.up);
    assert.ok(up, 'Lua must create the upstairs');
    const dx = Math.abs(trap.tx - up.sx), dy = Math.abs(trap.ty - up.sy);
    assert.ok(Math.max(dx, dy) > 11, 'the invocation area must stay away from the upstairs');
    assert.ok(dx > 0 && dy > 0 && dx !== dy, 'the vibrating square must not line up with the upstairs');
});
