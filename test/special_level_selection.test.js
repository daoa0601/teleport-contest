import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, HWALL, ROOM, STONE } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
async function levelLua(t) {
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
void test('Lua circles and ellipses carve outlines or filled areas relative to their map', async (t) => {
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
void test('an exhausted Lua selection returns the absent-coordinate sentinel', async (t) => {
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
void test('Lua gradients carve the guaranteed center and exclude terrain beyond their radius', async (t) => {
    const lua = await levelLua(t);
    await lua.executeAsync(`
        local radial = selection.gradient({ x = 15, y = 8, x2 = 15, y2 = 8,
            mindist = 2, maxdist = 2 })
        des.terrain(radial, ".")
        local square = selection.gradient({ type = "square", x = 35, y = 8,
            x2 = 35, y2 = 8, mindist = 2, maxdist = 2 })
        des.terrain(square, ".")
    `);
    const level = requireGameLevel();
    assert.equal(level.requireAt(16, 8).typ, ROOM);
    assert.equal(level.requireAt(18, 10).typ, STONE, 'radial guaranteed center is circular');
    assert.equal(level.requireAt(38, 10).typ, ROOM, 'square guaranteed center includes its corners');
    assert.equal(level.requireAt(16, 13).typ, STONE);
    assert.equal(level.requireAt(36, 13).typ, STONE);
});
void test('Lua level selections preserve point values and support coordinate-table reads', async (t) => {
    const lua = await levelLua(t);
    await lua.executeAsync(`
        des.map({ x = 10, y = 5, map = [[...]] })
        local points = selection.set(1, 0)
        points:set(2, 0, 7)
        first_value = points:get({1, 0})
        second_value = points:get(2, 0)
        points:set(1, 0, 0)
        cleared_value = points:get({x = 1, y = 0})
        des.terrain(points, "#")
    `);
    assert.equal(lua.getGlobal('first_value'), 1);
    assert.equal(lua.getGlobal('second_value'), 7);
    assert.equal(lua.getGlobal('cleared_value'), 0);
    assert.equal(requireGameLevel().requireAt(11, 5).typ, ROOM);
    assert.notEqual(requireGameLevel().requireAt(12, 5).typ, ROOM);
});
void test('Lua level initialization defaults to solid floor and accepts Rogue rooms', async (t) => {
    const lua = await levelLua(t);
    await lua.executeAsync('des.level_init({ lit = 0 })');
    assert.equal(requireGameLevel().requireAt(20, 10).typ, ROOM);
    game.level = new GameMap();
    await lua.executeAsync('des.level_init({ style = "rogue" })');
    assert.ok(requireGameLevel().nroom > 0, 'Rogue style builds its room grid');
});
void test('solid initialization resets cell metadata within the native maze boundaries', async (t) => {
    const lua = await levelLua(t);
    const level = requireGameLevel();
    const previous = level.requireAt(20, 10);
    previous.flags = 3;
    previous.roomno = 4;
    previous.edge = true;
    previous.horizontal = true;
    level.requireAt(1, 5).typ = CORR;
    level.requireAt(79, 5).typ = HWALL;
    await lua.executeAsync('des.level_init({ style = "solidfill", fg = ".", lit = 0 })');
    assert.equal(previous.typ, ROOM);
    assert.equal(previous.flags, 0);
    assert.equal(previous.roomno, 0);
    assert.equal(previous.edge, false);
    assert.equal(previous.horizontal, false);
    assert.equal(level.requireAt(1, 5).typ, CORR);
    assert.equal(level.requireAt(79, 5).typ, HWALL);
});
void test('swamp initialization chooses lighting when omitted and maze grids default to stone', async (t) => {
    const lua = await levelLua(t);
    const lighting = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        initRng(seed);
        await lua.executeAsync('des.level_init({ style = "swamp" })');
        lighting.add(requireGameLevel().requireAt(20, 10).lit);
    }
    assert.equal(lighting.size, 2, 'unspecified swamp lighting can be lit or unlit');
    await lua.executeAsync('des.level_init({ style = "mazegrid" })');
    assert.equal(requireGameLevel().requireAt(20, 10).typ, STONE);
});
//# sourceMappingURL=special_level_selection.test.js.map