import test from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';

import { D_BROKEN, DOOR, SDOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

async function levelScript(t: TestContext) {
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

void test('a Lua random door at fixed coordinates can be broken', async t => {
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

void test('a Lua room door with a random wall can use its only open west side', async t => {
    const lua = await levelScript(t);
    requirePlayingGame(game);
    await lua.executeAsync(`
        function pre_themerooms_generate()
        des.map({ map = [[
------------
|...|......|
|...|......|
|...|......|
|...|......|
------------]], x = 10, y = 5 })
        des.region({ region = {5,1,10,4}, type = "temple", lit = 1,
            contents = function()
                des.door({ wall = "random", state = "secret" })
            end })
        end
    `);
    game.level = new GameMap();
    await mklev();
    requirePlayingGame(game);
    const level = game.level;
    const westDoors = [6, 7, 8, 9].filter(y => level.requireAt(14, y).typ === SDOOR);
    assert.equal(westDoors.length, 1, 'the only reachable wall must receive the secret door');
});
