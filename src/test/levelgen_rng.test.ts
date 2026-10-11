import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';

import { COLNO, CORR, DOOR, D_NODOOR, LADDER, M_AP_FURNITURE, ROOM, ROOMOFFSET, ROWNO, SCORR, STAIRS, THEMEROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mkclassAligned, mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { ROCK, STATUE } from '../js/object_data.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { createDungeon } from './support/topology.js';
import { floorObjects } from './support/level-state.js';

for (const terrain of [STAIRS, LADDER]) {
    void test(`water-plane traps retry a selected ${terrain === STAIRS ? 'stair' : 'ladder'} square`, async t => {
        const level = await buildThemedLevel(t, `
            themerooms = {{ frequency = 1, contents = function()
                des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
            end }}
        `);
        const lua = currentLuaLifecycle().getThemedState(game, 0);
        assert.ok(lua);
        await lua.executeAsync('des.map({ coord = {10,6}, map = [[..]] })');
        requirePlayingGame(game);
        game.water_level = { ...game.u.uz, flags: { town: false }, alignment: null };
        level.traps = [];
        level.requireAt(11, 6).typ = terrain;
        initRng(17);

        await lua.executeAsync('des.trap({ type = "pit", victim = false })');

        assert.equal(level.traps.length, 1, 'rejecting a stair or ladder must retry rather than discard the trap');
        const trap = level.traps[0];
        assert.ok(trap);
        assert.equal(trap.tx, 10);
        assert.equal(trap.ty, 6);
        assert.equal(level.requireAt(11, 6).typ, terrain);
    });
}

async function buildThemedLevel(t: TestContext, definition: string) {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({
        dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 30,
        themeRooms: 'themerms.lua',
    })];
    initRng(731);
    init_objects();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'regular level generation should load its themed-room script');
    await lua.executeAsync(definition);
    game.level = new GameMap();
    await mklev();
    return game.level;
}

void test('an explicit room trap falls back from stairs to its room floor', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1,
                contents = function()
                    des.stair("down", 0, 0)
                    des.trap({ type = "pit", x = 0, y = 0, victim = false })
                end })
        end }}
    `);

    const rooms = level.rooms.slice(0, level.nroom).filter(isRoom);
    assert.ok(rooms.length > 0);
    for (const room of rooms) {
        const trap = level.traps.find(candidate =>
            candidate.tx >= room.lx && candidate.tx <= room.hx
            && candidate.ty >= room.ly && candidate.ty <= room.hy);
        assert.ok(trap, `room at ${room.lx},${room.ly} must retain its requested trap`);
        assert.equal(level.requireAt(trap.tx, trap.ty).typ, ROOM);
        assert.equal(level.requireAt(room.lx, room.ly).typ, STAIRS);
    }
});

void test('random corridors leave unjoined irregular regions sealed', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.map({ map = [[-----
|...|
|...|
-----]], contents = function()
                des.region({ region = {1,1,3,2}, type = "themed",
                    irregular = true, joined = false, lit = 1 })
            end })
        end }}
    `);

    const rooms = level.rooms.slice(0, level.nroom).filter(isRoom);
    assert.ok(rooms.length > 2, 'the level should contain several sealed chambers');
    for (const room of rooms) {
        assert.equal(room.rtype, THEMEROOM);
        assert.equal(room.needjoining, false, 'the region must retain its joining policy');
        assert.equal(room.doorct, 0, 'corridor generation must not open a sealed chamber');
    }
});

void test('arboreal levels join rooms with open ground', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.level_flags("arboreal")
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);

    const rooms = level.rooms.slice(0, level.nroom).filter(isRoom);
    assert.ok(rooms.some(room => room.doorct > 0), 'rooms should have corridor entrances');
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            assert.ok(![CORR, SCORR].includes(level.requireAt(x, y).typ),
                `arboreal passage at ${x},${y} should be open ground`);
});

void test('maze initialization preserves the whole-level coordinate origin', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);

    await lua.executeAsync(`
        des.level_init({ style = "maze", corrwid = 1, wallthick = 1 })
        des.engraving({ x = 0, y = 0, type = "burn", text = "maze origin", degrade = false })
    `);

    const engraving = level.engravings?.find(entry => entry.text === 'maze origin');
    assert.ok(engraving, 'the explicit engraving should be created');
    assert.equal(engraving.x, 1, 'column zero in Lua is the first usable map column');
    assert.equal(engraving.y, 0);
});

void test('random contents of an irregular region stay in its connected area', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.map({ map = [[---------
|.......|
|.-----.|
|.|...|.|
|.|...|.|
|.-----.|
|.......|
---------]], contents = function()
                des.region({ region = {1,1,7,6}, type = "themed",
                    irregular = true, joined = false, lit = 1,
                    contents = function()
                        for i = 1, 30 do des.object("rock") end
                    end })
            end })
        end }}
    `);

    const rocks = floorObjects(level).filter(object => object.otyp === ROCK);
    assert.ok(rocks.length > 0, 'each ring should have contents');
    for (const object of rocks)
        assert.ok(level.requireAt(object.ox, object.oy).roomno >= ROOMOFFSET,
            `object at ${object.ox},${object.oy} should belong to its irregular room`);
});

void test('a class-defined statue represents the species chosen before object initialization', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);

    for (let seed = 1; seed <= 12; seed++) {
        initRng(seed);
        const species = mkclassAligned(29, 0x0200 | 0x8000); // S_CENTAUR, G_NOGEN | G_IGNORE
        assert.ok(species !== null);
        const previousObjects = new Set(floorObjects(level));
        initRng(seed);
        await lua.executeAsync('des.object({ id = "statue", x = 0, y = 0, montype = "C" })');

        const statue = floorObjects(level).find(object =>
            object.otyp === STATUE && !previousObjects.has(object));
        assert.ok(statue);
        assert.equal(statue.corpsenm, species,
            `statue initialization must not change the class choice (seed ${seed})`);
    }
});

void test('deep corridor doors can become door-disguised mimics', async t => {
    await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    requirePlayingGame(game);
    game.u.uz.dlevel = 20;
    game.level = new GameMap();
    initRng(125);

    await mklev();

    const mimic = game.level.monsters.find(monster =>
        MONSTER_NAME[monster.mnum]?.includes('mimic'));
    assert.ok(mimic, 'deep corridors should sometimes create a mimic in place of a trapped door');
    const door = game.level.requireAt(mimic.mx, mimic.my);
    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_NODOOR, 'the mimic replaces the trapped door');
    assert.equal(mimic.m_ap_type, M_AP_FURNITURE);
});
