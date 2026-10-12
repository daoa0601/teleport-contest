import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';

import { A_LAWFUL, ARROW_TRAP, COLNO, CORR, DOOR, D_NODOOR, G_EXTINCT, G_GENOD, HOLE, LADDER, LAVAPOOL, LEVEL_TELEP, M_AP_FURNITURE, PIT, POOL, ROCKTRAP, ROOM, ROOMOFFSET, ROWNO, SCORR, STAIRS, TELEP_TRAP, THEMEROOM, TRAPDOOR, WEB } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { resetInputState } from '../js/input.js';
import { isRoom } from '../js/map_types.js';
import { maketrap, mkclassAligned, mklev } from '../js/mklev.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from '../js/monster_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { ROCK, STATUE } from '../js/object_data.js';
import { DRY, getLocationCoord } from '../js/special_location.js';
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

for (const unavailable of [G_GENOD, G_EXTINCT]) {
    for (const explicit of [false, true]) {
        void test(`${unavailable === G_GENOD ? 'genocided' : 'extinct'} Lua monster classes create a random monster at ${explicit ? 'explicit' : 'random dry'} coordinates`, async t => {
            const level = await buildThemedLevel(t, `
                themerooms = {{ frequency = 1, contents = function()
                    des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
                end }}
            `);
            const lua = currentLuaLifecycle().getThemedState(game, 0);
            assert.ok(lua);
            requirePlayingGame(game);
            assert.ok(game.mvitals);
            for (const [species, vital] of game.mvitals.entries())
                if (MONSTER_SYMBOL[species] === 29) vital.mvflags |= unavailable; // S_CENTAUR

            for (let seed = 1; seed <= 8; seed++) {
                level.monsters = [];
                await lua.executeAsync('des.map({ coord = {10,6}, map = [[.PL\n.P.]] })');
                initRng(seed);

                await lua.executeAsync(`des.monster({ class = "C", ${explicit ? 'x = 0, y = 0,' : ''}
                    ${unavailable === G_EXTINCT ? 'align = "law",' : ''}
                    group = false, countbirth = false, peaceful = true, asleep = true,
                    name = "class survivor" })`);

                if (unavailable === G_GENOD)
                    assert.equal(level.monsters.length, 1, 'ordinary creation honors group=false');
                const survivors = level.monsters.filter(monster => monster.name === 'class survivor');
                assert.equal(survivors.length, 1, `the fallback must create the requested monster (seed ${seed})`);
                const monster = survivors[0];
                assert.ok(monster);
                assert.notEqual(MONSTER_SYMBOL[monster.mnum], 29, 'the fallback cannot use the unavailable class');
                assert.equal(level.requireAt(monster.mx, monster.my).typ, ROOM, 'a missing species uses dry placement');
                if (explicit) {
                    assert.equal(monster.mx, 10);
                    assert.equal(monster.my, 6);
                }
                assert.equal(monster.mpeaceful, 1);
                assert.equal(monster.msleeping, 1);
                assert.equal(monster.name, 'class survivor');
                if (unavailable === G_EXTINCT) assert.equal(monster.emin?.min_align, 1);
            }
        });
    }
}

for (const explicit of [false, true]) {
    void test(`aligned unavailable classes allow companions and count births at ${explicit ? 'explicit' : 'random'} coordinates despite Lua flags`, async t => {
        const level = await buildThemedLevel(t, `
            themerooms = {{ frequency = 1, contents = function()
                des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
            end }}
        `);
        const lua = currentLuaLifecycle().getThemedState(game, 0);
        assert.ok(lua);
        requirePlayingGame(game);
        assert.ok(game.mvitals);
        const jackalSpecies = MONSTER_NAME.indexOf('jackal');
        const jackalVital = game.mvitals[jackalSpecies];
        assert.ok(jackalVital);
        // Leave one ordinary group-forming species available, so fallback
        // groups do not depend on which species happens to be selected.
        for (const [species, vital] of game.mvitals.entries())
            if (species !== jackalSpecies) vital.mvflags |= G_GENOD;
        game.u.ualign.type = A_LAWFUL;
        const birthsBefore = jackalVital.born ?? 0;
        let created = 0;
        let companions = 0;

        for (let seed = 1; seed <= 32; seed++) {
            level.monsters = [];
            await lua.executeAsync('des.map({ coord = {10,6}, map = [[.......\n.......\n.......\n.......\n.......]] })');
            initRng(seed);

            await lua.executeAsync(`des.monster({ class = "C", align = "law",
                ${explicit ? 'x = 3, y = 2,' : ''}
                group = false, countbirth = false, peaceful = true, asleep = true,
                name = "class survivor" })`);

            const survivors = level.monsters.filter(monster => monster.name === 'class survivor');
            assert.equal(survivors.length, 1, `the fallback must create the requested roamer (seed ${seed})`);
            const roamer = survivors[0];
            assert.ok(roamer);
            assert.equal(roamer.mnum, jackalSpecies);
            assert.equal(roamer.emin?.min_align, A_LAWFUL);
            assert.equal(roamer.mpeaceful, 1, 'Lua attributes apply to the requested roamer');
            assert.equal(roamer.msleeping, 1);
            for (const member of level.monsters.filter(monster => monster !== roamer)) {
                assert.equal(member.mnum, jackalSpecies, 'companions share the fallback species');
                assert.equal(member.mpeaceful, 0, 'group companions keep their native hostile attitude');
                companions++;
            }
            created += level.monsters.length;
        }

        assert.ok(companions > 0, 'mk_roamer allows fallback companions even with group=false');
        assert.equal((jackalVital.born ?? 0) - birthsBefore, created,
            'mk_roamer counts the roamer and companion births even with countbirth=false');
    });
}

for (const terrain of [POOL, LAVAPOOL]) {
    void test(`Lua traps leave an existing trap untouched when its square becomes ${terrain === POOL ? 'water' : 'lava'}`, async t => {
        const level = await buildThemedLevel(t, `
            themerooms = {{ frequency = 1, contents = function()
                des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
            end }}
        `);
        const lua = currentLuaLifecycle().getThemedState(game, 0);
        assert.ok(lua);
        await lua.executeAsync('des.map({ coord = {10,6}, map = [[.]] })');
        level.traps = [];
        const original = await maketrap(10, 6, PIT);
        assert.ok(original);
        level.requireAt(10, 6).typ = terrain;

        await lua.executeAsync('des.trap({ type = "arrow", x = 0, y = 0, seen = true, victim = false })');

        assert.equal(original.ttyp, PIT, 'mktrap rejects explicit liquid coordinates before constructing a replacement');
        assert.equal(original.tseen, false);
        assert.equal(level.traps.length, 1);
    });
}

void test('rejecting random traps in water and lava leaves the following dry trap choice unchanged', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    await lua.executeAsync('des.map({ coord = {10,6}, map = [[.PL]] })');

    for (let seed = 1; seed <= 32; seed++) {
        level.traps = [];
        initRng(seed);
        await lua.executeAsync('des.trap({ x = 0, y = 0, spider_on_web = false, victim = false })');
        const control = level.traps[0];
        assert.ok(control);
        const expectedKind = control.ttyp;
        level.traps = [];
        initRng(seed);

        await lua.executeAsync(`
            des.trap({ x = 1, y = 0, spider_on_web = false, victim = false })
            des.trap({ x = 2, y = 0, spider_on_web = false, victim = false })
            des.trap({ x = 0, y = 0, spider_on_web = false, victim = false })
        `);

        assert.equal(level.traps.length, 1, 'only the dry square can receive a trap');
        assert.equal(level.traps[0]?.ttyp, expectedKind,
            `rejected explicit liquid coordinates must not change subsequent trap choices (seed ${seed})`);
    }
});

void test('Lua holes and trapdoors become falling-rock traps when the level cannot be fallen through', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    await lua.executeAsync('des.map({ coord = {10,6}, map = [[..]] }); des.level_flags("hardfloor")');
    level.traps = [];

    await lua.executeAsync(`
        des.trap({ type = "hole", x = 0, y = 0, victim = false })
        des.trap({ type = "trap door", x = 1, y = 0, victim = false })
    `);

    assert.equal(level.traps.length, 2);
    for (const trap of level.traps) assert.equal(trap.ttyp, ROCKTRAP);
});

void test('shallow random Lua traps allow spiderless webs and obey teleport and falling restrictions', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    await lua.executeAsync('des.map({ coord = {10,6}, map = [[.]] }); des.level_flags("hardfloor", "noteleport")');
    const kinds = new Set<number>();

    for (let seed = 1; seed <= 128; seed++) {
        level.traps = [];
        initRng(seed);
        await lua.executeAsync('des.trap({ x = 0, y = 0, spider_on_web = false, victim = false })');

        const trap = level.traps[0];
        assert.ok(trap, `a dry square should receive a trap (seed ${seed})`);
        assert.ok(![TELEP_TRAP, LEVEL_TELEP, HOLE, TRAPDOOR].includes(trap.ttyp),
            `trap kind ${trap.ttyp} violates the level's restrictions`);
        kinds.add(trap.ttyp);
    }
    assert.ok(kinds.has(WEB), 'without a resident spider, webs are eligible even on the first level');
    assert.ok(kinds.has(ARROW_TRAP), 'ordinary shallow traps remain eligible');
});

void test('deep random Lua traps reject both teleport kinds on a no-teleport level', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    requirePlayingGame(game);
    game.u.uz.dlevel = 12;
    await lua.executeAsync('des.map({ coord = {10,6}, map = [[.]] }); des.level_flags("noteleport")');

    for (let seed = 1; seed <= 64; seed++) {
        level.traps = [];
        initRng(seed);
        await lua.executeAsync('des.trap({ x = 0, y = 0, spider_on_web = false, victim = false })');

        const trap = level.traps[0];
        assert.ok(trap, `a dry square should receive a trap (seed ${seed})`);
        assert.ok(trap.ttyp !== TELEP_TRAP && trap.ttyp !== LEVEL_TELEP,
            `trap kind ${trap.ttyp} violates no-teleport admission`);
    }
});

void test('an unavailable monster class uses dry placement without species retries', async t => {
    const level = await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    for (const vital of game.mvitals) vital.mvflags |= G_GENOD;
    const area = { xstart: 10, ystart: 6, width: 7, height: 3 };
    const solidMap = 'des.map({ coord = {10,6}, map = [[       \n       \n       ]] })';
    const dryMap = 'des.map({ coord = {10,6}, map = [[.......\n.......\n.......]] })';

    for (let seed = 1; seed <= 3; seed++) {
        await lua.executeAsync(solidMap);
        resetInputState().feed(' '.repeat(20));
        initRng(seed);
        const species = mkclassAligned(29, 0x0200); // S_CENTAUR, G_NOGEN
        assert.equal(species, null, 'the centaur class is unavailable');
        // With no species, create_monster() uses the same DRY lookup as
        // other dry contents, even when the map has no suitable square.
        await getLocationCoord(area, null, DRY);
        await lua.executeAsync(dryMap);
        const expected = await getLocationCoord(area, null, DRY);

        await lua.executeAsync(solidMap);
        level.traps = [];
        resetInputState().feed(' '.repeat(20));
        initRng(seed);
        await lua.executeAsync('des.monster({ class = "C", align = "law" })');
        await lua.executeAsync(dryMap);
        await lua.executeAsync('des.trap({ type = "pit", victim = false })');

        const trap = level.traps[0];
        assert.ok(trap, 'the following dry content should be placed');
        assert.deepEqual({ x: trap.tx, y: trap.ty }, expected,
            `failed monster placement must preserve the next dry placement (seed ${seed})`);
    }
});

void test('ordinary themed regions stop at 40 rooms and only light excess regions', async t => {
    await buildThemedLevel(t, `
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 5, h = 3, filled = 0, lit = 1 })
        end }}
    `);
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    await lua.executeAsync(`
        function themerooms_generate()
            des.map({ coord = {1,0}, map = [[${('.'.repeat(61) + '\n').repeat(20)}]] })
            for i = 1, 50 do
                local x = 2 + ((i - 1) % 10) * 6
                local y = 1 + math.floor((i - 1) / 10) * 4
                des.region({ region = {x,y,x,y}, type = "ordinary",
                    joined = false, filled = 0, lit = i > 40 and 1 or 0,
                    contents = function()
                        des.engraving({ x = 0, y = 0, type = "burn",
                            text = "admitted region " .. i, degrade = false })
                    end })
            end
        end
    `);
    resetInputState().feed(' '.repeat(40));

    await mklev();

    const level = game.level;
    assert.ok(level);
    assert.equal(level.nroom, 40, 'one theme must not exceed the native room capacity');
    const engravings = level.engravings?.filter(entry => entry.text.startsWith('admitted region '));
    assert.equal(engravings?.length, 40, 'excess regions must skip their contents');
    assert.ok(engravings?.some(entry => entry.text === 'admitted region 40'),
        'the last available room must still run its contents');
    assert.equal(level.requireAt(3, 17).roomno, 0, 'an excess region must not assign a room number');
    assert.equal(level.requireAt(3, 17).lit, true, 'an excess region must still apply its lighting');
    assert.equal(level.requireAt(2, 16).lit, true, 'lit regions include their one-cell perimeter');

    await lua.executeAsync(`
        des.map({ coord = {10,6}, map = [[.L]], lit = 1 })
        des.region({ region = {0,0,1,0}, type = "themed", lit = 0 })
    `);

    assert.equal(level.nroom, 40, 'special room types must obey the same limit');
    assert.equal(level.requireAt(10, 6).lit, false, 'unlit excess regions darken ordinary terrain');
    assert.equal(level.requireAt(11, 6).typ, LAVAPOOL);
    assert.equal(level.requireAt(11, 6).lit, true, 'lava stays lit when a region is darkened');
});

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
