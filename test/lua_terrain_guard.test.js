import assert from 'node:assert/strict';
import test from 'node:test';
import { LADDER, LAVAPOOL, ROOM, STAIRS } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
void test('Lua terrain replacements preserve stairs, ladders, their light and flags', async (t) => {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.level = new GameMap();
    await lua.executeAsync('des.level_init({ style = "solidfill", fg = "." })');
    requirePlayingGame(game);
    const stairs = game.level.requireAt(13, 7);
    const ladder = game.level.requireAt(14, 7);
    stairs.typ = STAIRS;
    ladder.typ = LADDER;
    stairs.ladder = 1;
    ladder.ladder = 2;
    stairs.lit = ladder.lit = false;
    await lua.executeAsync(`
        des.terrain({ x = 12, y = 7, typ = "L", lit = 1 })
        des.terrain({ selection = selection.area(12,7,14,7), typ = "L", lit = 1 })
    `);
    assert.equal(stairs.typ, STAIRS);
    assert.equal(ladder.typ, LADDER);
    assert.equal(stairs.lit, false);
    assert.equal(ladder.lit, false);
    assert.equal(stairs.ladder, 1);
    assert.equal(ladder.ladder, 2);
    assert.equal(game.level.requireAt(15, 7).typ, LAVAPOOL);
    assert.equal(game.level.requireAt(16, 7).typ, ROOM);
    game.iflags.debug_overwrite_stairs = true;
    await lua.executeAsync('des.terrain({ x = 12, y = 7, typ = "L", lit = 1 })');
    assert.equal(stairs.typ, LAVAPOOL, 'the native debugging override permits replacement');
    assert.equal(stairs.lit, true);
});
//# sourceMappingURL=lua_terrain_guard.test.js.map