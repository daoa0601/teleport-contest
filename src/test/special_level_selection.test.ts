import test from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';

import { ROOM, STONE } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

async function levelLua(t: TestContext) {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level creation should install the Lua selection API');
    game.level = new GameMap();
    game.in_mklev = true;
    return lua;
}

void test('Lua circles and ellipses carve outlines or filled areas relative to their map', async t => {
    const lua = await levelLua(t);
    await lua.executeAsync(`
        des.map({ x = 10, y = 5, map = [[xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx]] })
        des.terrain(selection.circle(4, 4, 2), ".")
        des.terrain(selection.circle(12, 4, 2, 1), ".")
        local oval = selection.new()
        oval:ellipse(21, 4, 3, 1, 1)
        des.terrain(oval, ".")
    `);
    const level = requireGameLevel();
    assert.equal(level.requireAt(14, 9).typ, STONE, 'an outline leaves its center intact');
    assert.equal(level.requireAt(14, 7).typ, ROOM);
    assert.equal(level.requireAt(22, 9).typ, ROOM, 'a filled circle includes its center');
    assert.equal(level.requireAt(31, 9).typ, ROOM, 'method form updates its selection');
    assert.equal(level.requireAt(34, 9).typ, ROOM, 'the ellipse reaches its horizontal radius');
    assert.equal(level.requireAt(31, 11).typ, STONE, 'the ellipse respects its vertical radius');
});

void test('an exhausted Lua selection returns the absent-coordinate sentinel', async t => {
    const lua = await levelLua(t);
    await lua.executeAsync(`
        des.map({ x = 10, y = 5, map = [[...]] })
        local remaining = selection.area(1, 0, 1, 0)
        local first = remaining:rndcoord(1)
        des.object({ id = "rock", coord = first })
        local absent = remaining:rndcoord()
        absent_x, absent_y = absent.x, absent.y
    `);
    assert.equal(lua.getGlobal('absent_x'), -1);
    assert.equal(lua.getGlobal('absent_y'), -1);
    assert.equal(requireGameLevel().objects[11]?.[5]?.length, 1);
});
