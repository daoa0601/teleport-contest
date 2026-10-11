import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';

import { COLNO, MOAT, POOL, ROOM, ROWNO, STONE, WATER, W_NONDIGGABLE } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { GOLD_PIECE, KELP_FROND, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { objectWeight } from '../js/weight.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
import { memoryStorage } from './support/memory-storage.js';
import { startLuaCore } from './support/lua-game.js';

const GEM_CLASS = 13;

function prepareMines(seed = 271) {
    freshSpecialLevel({ prototype: 'minefill', seed, depth: 2 });
    requirePlayingGame(game);
    assert.ok(game.specialLevels);
    game.specialLevels.clear();
    game.flags.bones = false;
    game.mines_dnum = 0;
    game.dungeons[0] = {
        dname: 'The Gnomish Mines', depth_start: 3, num_dunlevs: 10,
        levelFill: 'minefill', entry_lev: 1, dunlev_ureached: 1,
        bonetag: undefined, protofile: undefined, themeRooms: undefined,
        flags: { maze_like: false, hellish: false, alignment: null },
    };
}

function mineralDeposits() {
    const level = requireGameLevel();
    return [...floorObjects(level), ...(level.buriedObjects || [])]
        .filter(object => (object.otyp === GOLD_PIECE || object.oclass === GEM_CLASS)
            && level.requireAt(object.ox, object.oy).typ === STONE);
}

void test('ordinary Lua Mine fillers receive gold and gems in surrounding rock', async () => {
    prepareMines();
    requirePlayingGame(game);

    await mklev();

    assert.equal(game.level.flags.is_special, true);
    assert.ok(mineralDeposits().length > 0,
        'a fill script is not a named special level and must receive mineral deposits');
    assert.ok(mineralDeposits().some(object => object.otyp === GOLD_PIECE));
});

void test('a raw Gehennom maze receives maze treasure but no rock mineral deposits', async () => {
    prepareMines(173);
    requirePlayingGame(game);
    game.dungeons[0] = {
        dname: 'Gehennom', depth_start: 25, num_dunlevs: 30,
        entry_lev: 1, dunlev_ureached: 1,
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
        flags: { hellish: true, maze_like: false, alignment: null },
    };
    game.valley_level = { dnum: 0, dlevel: 1, flags: { town: false }, alignment: null };
    game.mines_dnum = -1;

    await mklev();

    assert.equal(game.level.flags.is_maze_lev, true);
    assert.ok(floorObjects(game.level).some(object => object.otyp === GOLD_PIECE));
    assert.equal(mineralDeposits().length, 0);
});

void test('named non-town Mines levels receive minerals while Minetown does not', async () => {
    for (const prototype of ['minend', 'minetn']) {
        prepareMines();
        requirePlayingGame(game);
        game.flags.debug = true;
        await init_dungeons();
        const descriptor = game.specialLevels?.get(prototype);
        assert.ok(descriptor);
        game.u.uz = { dnum: descriptor.dnum, dlevel: descriptor.dlevel };
        game._specialLevelPrototype = prototype;

        await mklev();

        if (prototype === 'minend') assert.ok(mineralDeposits().length > 0);
        else assert.equal(mineralDeposits().length, 0);
    }
});

async function mineralizingLua(t: TestContext) {
    freshSpecialLevel({ prototype: 'themerms', seed: 173, depth: 3 });
    requirePlayingGame(game);
    assert.ok(game.specialLevels);
    game.specialLevels.clear();
    game.flags.bones = false;
    game.medusa_level = { dnum: 0, dlevel: 20, flags: { town: false }, alignment: null };
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'ordinary generation must create the real Lua level bindings');
    game.level = new GameMap();
    game.stairs = null;
    return lua;
}

void test('Lua mineralization creates owned deposits only inside diggable solid rock', async t => {
    const lua = await mineralizingLua(t);
    requirePlayingGame(game);
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            game.level.requireAt(x, y).wall_info = W_NONDIGGABLE;
    }
    const eligible = [{ x: 20, y: 10 }, { x: 24, y: 10 }, { x: 28, y: 10 }];
    for (const point of eligible) game.level.requireAt(point.x, point.y).wall_info = 0;
    game.level.requireAt(32, 10).wall_info = 0;
    game.level.requireAt(33, 11).typ = ROOM;
    initRng(145n);

    await lua.executeAsync(`des.mineralize({gold_prob=1000, gem_prob=1000, kelp_pool=0, kelp_moat=0})`);

    const deposits = mineralDeposits();
    const coins = deposits.filter(object => object.otyp === GOLD_PIECE);
    assert.equal(coins.length, eligible.length);
    assert.ok(deposits.some(object => object.oclass === GEM_CLASS));
    assert.ok(deposits.some(object => object.where === 'buried'));
    assert.ok(deposits.some(object => object.where === 'floor'));
    assert.ok(deposits.every(object => object.otyp !== ROCK));
    for (const deposit of deposits) {
        assert.ok(eligible.some(point => point.x === deposit.ox && point.y === deposit.oy));
        assert.equal(deposit.owt, objectWeight(deposit));
        if (deposit.where === 'buried') {
            assert.equal(deposit.buried, true);
            assert.ok(game.level.buriedObjects?.includes(deposit));
            assert.ok(!floorObjects(game.level).includes(deposit));
        } else {
            assert.equal(deposit.where, 'floor');
            assert.ok(floorObjectsAt(game.level, deposit.ox, deposit.oy).includes(deposit));
        }
    }
});

void test('forced Lua kelp respects water-plane WATER exclusion and map margins', async t => {
    const lua = await mineralizingLua(t);
    requirePlayingGame(game);
    game.astral_level = { dnum: 0, dlevel: 1, flags: { town: false }, alignment: null };
    game.water_level = { dnum: 0, dlevel: 3, flags: { town: false }, alignment: null };
    for (const [x, typ] of [[10, POOL], [11, WATER], [12, MOAT], [1, POOL]] satisfies [number, number][])
        game.level.requireAt(x, 10).typ = typ;

    await lua.executeAsync(`des.mineralize({gold_prob=0, gem_prob=0, kelp_pool=1, kelp_moat=1})`);

    const kelp = floorObjects(game.level).filter(object => object.otyp === KELP_FROND);
    assert.equal(kelp.length, 2);
    assert.ok(kelp.some(object => object.ox === 10 && object.oy === 10));
    assert.ok(kelp.some(object => object.ox === 12 && object.oy === 10));

    await lua.executeAsync('des.mineralize()');

    assert.ok(!floorObjects(game.level).some(object =>
        object.otyp === KELP_FROND && object.ox === 11 && object.oy === 10));
});

void test('loaded dungeon identities, town admission metadata and buried deposits survive restore', async () => {
    prepareMines();
    requirePlayingGame(game);
    game.flags.debug = true;
    await init_dungeons();
    for (const [dnum, name] of [
        [game.mines_dnum, 'The Gnomish Mines'], [game.quest_dnum, 'The Quest'], [game.tower_dnum, "Vlad's Tower"],
    ] satisfies [number | undefined, string][]) {
        assert.ok(dnum !== undefined);
        assert.equal(game.dungeons[dnum]?.dname, name);
    }
    assert.equal(game.specialLevels?.get('minetn')?.flags.town, true);
    assert.equal(game.specialLevels?.get('minend')?.flags.town, false);
    assert.ok(game.mines_dnum !== undefined);
    game.u.uz = { dnum: game.mines_dnum, dlevel: 1 };
    await mklev();
    const buriedCount = mineralDeposits().filter(object => object.where === 'buried').length;
    assert.ok(buriedCount > 0);
    const storage = memoryStorage();
    game.mines_dnum = game.quest_dnum = game.tower_dnum = -1;
    assert.equal(await saveGame(storage), true);

    assert.equal(restoreGame(game.plname || 'player', storage), true);

    assert.equal(game.dungeons[game.mines_dnum]?.dname, 'The Gnomish Mines');
    assert.equal(game.specialLevels?.get('minetn')?.flags.town, true);
    assert.equal(game.specialLevels?.get('minend')?.flags.town, false);
    const buried = mineralDeposits().filter(object => object.where === 'buried');
    assert.equal(buried.length, buriedCount);
    assert.ok(buried.every(object => object.buried && object.owt === objectWeight(object)));
});
