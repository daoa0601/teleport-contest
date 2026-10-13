import test from 'node:test';
import assert from 'node:assert/strict';
import { D_BROKEN, DOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { init_dungeons } from '../js/dungeon.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
async function levelScript(t) {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary level generation loads the Lua level API');
    return lua;
}
void test('a Lua random door at fixed coordinates can be broken', async (t) => {
    const lua = await levelScript(t);
    requirePlayingGame(game);
    const level = game.level;
    let broken = false;
    await lua.executeAsync('des.map({ map = "...", x = 10, y = 5 })');
    for (let sample = 0; sample < 40; sample++) {
        await lua.executeAsync('des.door("random", 1, 0)');
        const door = level.requireAt(11, 5);
        assert.equal(door.typ, DOOR);
        broken ||= door.doormask === D_BROKEN;
    }
    assert.ok(broken, 'the native random door choices include a broken door');
});
//# sourceMappingURL=lua_doors.test.js.map
