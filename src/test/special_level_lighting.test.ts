import test from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';

import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import type { LuaGameState } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { cansee, vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

async function levelLua(t: TestContext): Promise<LuaGameState> {
    freshGame({ flags: { bones: false } });
    initRng(731);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation should install the Lua des bindings');
    game.level = new GameMap();
    game.in_mklev = true;
    return lua;
}

function mappedOrigin(lua: LuaGameState): { x: number; y: number } {
    const x = lua.getGlobal('map_x');
    const y = lua.getGlobal('map_y');
    assert.ok(typeof x === 'number' && typeof y === 'number', 'map bounds should give its origin');
    return { x, y };
}

void test('a string map replaces lit fill with a dark room that arrival does not reveal', async t => {
    const lua = await levelLua(t);
    await lua.executeAsync(`
        des.level_init({ style = "solidfill", fg = " ", lit = 1 })
        local map = des.map([[----------
|........|
|........|
|........|
----------]])
        local bounds = map:bounds()
        map_x, map_y = bounds.lx, bounds.ly
    `);
    const { x, y } = mappedOrigin(lua);
    requirePlayingGame(game);
    game.u.ux = x + 1;
    game.u.uy = y + 2;
    game.in_mklev = false;

    vision_reset_new_level();
    vision_recalc();

    const distant = game.level.requireAt(x + 7, y + 2);
    assert.equal(distant.lit, false, 'des.map(string) defaults to unlit');
    assert.equal(cansee(x + 7, y + 2), false);
    assert.equal(distant.remembered_glyph, undefined, 'arrival must not remember unseen floor');
    assert.equal(distant.disp_ch, ' ');
    assert.equal(cansee(x + 2, y + 2), true, 'adjacent floor remains visible in the dark');
    assert.equal(game.level.requireAt(1, 0).lit, true, 'the map only replaces its own cells');
});

for (const lighting of [undefined, false, true]) {
    void test(`a positioned map uses ${lighting === undefined ? 'unlit by default' : lighting ? 'explicit light' : 'explicit darkness'}`, async t => {
        const lua = await levelLua(t);
        await lua.executeAsync(`
            des.level_init({ style = "solidfill", fg = " ", lit = 1 })
            des.map({ x = 10, y = 6, ${lighting === undefined ? '' : `lit = ${String(lighting)},`}
                map = [[.xLZA]] })
        `);

        requirePlayingGame(game);
        assert.equal(game.level.requireAt(10, 6).lit, lighting ?? false);
        assert.equal(game.level.requireAt(11, 6).lit, true, 'transparent map cells retain fill lighting');
        assert.equal(game.level.requireAt(12, 6).lit, true, 'lava pools emit permanent light');
        assert.equal(game.level.requireAt(13, 6).lit, true, 'lava walls emit permanent light');
        assert.equal(game.level.requireAt(14, 6).lit, lighting ?? false, 'air uses the requested map lighting');
    });
}

void test('a randomly placed themed map honors explicit lighting and lava light', async t => {
    const lua = await levelLua(t);
    await lua.executeAsync(`
        local map = des.map({ lit = true, map = [[...]] })
        local bounds = map:bounds()
        map_x, map_y = bounds.lx, bounds.ly
    `);
    const litOrigin = mappedOrigin(lua);
    requirePlayingGame(game);
    assert.equal(game.level.requireAt(litOrigin.x, litOrigin.y).lit, true);

    await lua.executeAsync(`
        local map = des.map({ lit = false, map = [[.L.]] })
        local bounds = map:bounds()
        map_x, map_y = bounds.lx, bounds.ly
    `);
    const darkOrigin = mappedOrigin(lua);
    assert.equal(game.level.requireAt(darkOrigin.x, darkOrigin.y).lit, false);
    assert.equal(game.level.requireAt(darkOrigin.x + 1, darkOrigin.y).lit, true);
});

for (const lighting of [false, true]) {
    void test(`an irregular ${lighting ? 'lit' : 'unlit'} room changes its floor and preserves unrelated corridor lighting`, async t => {
        const lua = await levelLua(t);
        await lua.executeAsync(`
            themerooms = {{ name = "Elbow room", frequency = 1, contents = function()
                des.map({ map = [[-----
|...|
|.---
|.|xx
---xx]], contents = function()
                    local bounds = selection.area(0,0,0,0):bounds()
                    map_x, map_y = bounds.lx, bounds.ly
                    des.region(selection.area(0,0,4,4), "lit")
                    des.terrain({ x = 3, y = 3, typ = "#", lit = 0 })
                    des.region({ region = {1,1,1,1}, irregular = true,
                        lit = ${lighting ? 1 : 0}, filled = 0 })
                end })
            end }}
        `);

        await mklev();

        const { x, y } = mappedOrigin(lua);
        requirePlayingGame(game);
        assert.equal(game.level.requireAt(x + 1, y + 1).lit, lighting);
        assert.equal(game.level.requireAt(x + 1, y + 3).lit, lighting);
        assert.equal(game.level.requireAt(x + 2, y + 3).lit, true, 'unlit regions leave their boundary walls lit');
        assert.equal(game.level.requireAt(x + 3, y + 3).lit, false, 'a room bounding box does not illuminate unrelated terrain');
        const room = game.level.rooms.filter(isRoom).find(candidate =>
            candidate.lx === x + 1 && candidate.ly === y + 1);
        assert.ok(room, 'the elbow floor should belong to an irregular room');
        assert.equal(room.rlit, lighting ? 1 : 0);
    });
}
