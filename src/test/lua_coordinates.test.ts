import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { ALTAR, DOOR, FOUNTAIN, GRAVE, LADDER, MOAT, ROOM, STAIRS } from '../js/const.js';
import { GOLD_PIECE, ROCK } from '../js/object_data.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { init_dungeons } from '../js/dungeon.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

async function levelScript(t: TestContext) {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.level = new GameMap();
    game.in_mklev = true;
    await lua.executeAsync('des.level_init({ style = "solidfill", fg = "." })');
    requirePlayingGame(game);
    return { lua, level: game.level };
}

void test('explicit Lua stairs replace ladder terrain with regular stairs', async t => {
    const { lua, level } = await levelScript(t);
    game.u.uz = { dnum: 0, dlevel: 2 };
    await lua.executeAsync('des.ladder({ dir = "down", x = 12, y = 7 })');
    assert.equal(level.requireAt(13, 7).typ, LADDER);

    await lua.executeAsync('des.stair({ dir = "up", x = 12, y = 7 })');

    assert.equal(level.requireAt(13, 7).typ, STAIRS);
    assert.equal(level.requireAt(13, 7).ladder, 1);
    assert.ok(game.stairs?.up);
    assert.equal(game.stairs?.isladder, false);
    assert.equal(game.stairs?.tolev.dlevel, 1);
});

void test('explicit Lua stairs force floor even when a dungeon endpoint forbids the stairs', async t => {
    const { lua, level } = await levelScript(t);
    game.u.uz = { dnum: 0, dlevel: 1 };
    await lua.executeAsync('des.ladder({ dir = "down", x = 12, y = 7 })');

    await lua.executeAsync('des.stair({ dir = "up", x = 12, y = 7 })');

    assert.equal(level.requireAt(13, 7).typ, ROOM);
    assert.equal(game.stairs?.isladder, true);
    assert.equal(game.stairs?.up, false);
});

for (const [binding, options, terrain] of [
    ['terrain', 'typ = "}"', MOAT],
    ['door', 'state = "closed"', DOOR],
    ['stair', 'dir = "down"', STAIRS],
    ['ladder', 'dir = "down"', LADDER],
    ['feature', 'type = "fountain"', FOUNTAIN],
    ['grave', 'text = "Here lies a reviewer"', GRAVE],
    ['altar', 'align = "noalign"', ALTAR],
] as const) {
    void test(`des.${binding} prefers explicit axes to coord`, async t => {
        const { lua, level } = await levelScript(t);

        await lua.executeAsync(`des.${binding}({ ${options}, x = 12, y = 7, coord = {20, 9} })`);

        assert.equal(level.requireAt(13, 7).typ, terrain);
        assert.notEqual(level.requireAt(21, 9).typ, terrain);
    });
}

void test('Lua object, gold, monster, trap and engraving placement prefers explicit axes', async t => {
    const { lua, level } = await levelScript(t);

    await lua.executeAsync(`
        des.object({ id = "rock", x = 12, y = 7, coord = {20, 9} })
        des.gold({ amount = 50, x = 12, y = 7, coord = {20, 9} })
        des.monster({ id = "lichen", x = 12, y = 7, coord = {20, 9} })
        des.trap({ type = "arrow", x = 12, y = 7, coord = {20, 9} })
        des.engraving({ text = "Elbereth", degrade = false, x = 12, y = 7, coord = {20, 9} })
    `);

    assert.ok(level.objects[13]?.[7]?.some(object => object.otyp === ROCK));
    assert.ok(level.objects[13]?.[7]?.some(object => object.otyp === GOLD_PIECE && object.quan === 50));
    assert.ok(level.monsters.some(monster => monster.mx === 13 && monster.my === 7));
    assert.ok(level.traps.some(trap => trap.tx === 13 && trap.ty === 7));
    assert.ok(level.engravings?.some(engraving => engraving.x === 13 && engraving.y === 7));
});

void test('Lua maps prefer explicit axes and use coord when both axes are the random sentinel', async t => {
    const { lua, level } = await levelScript(t);

    await lua.executeAsync('des.map({ map = "}", x = 12, y = 7, coord = {20, 9} })');
    assert.equal(level.requireAt(12, 7).typ, MOAT);
    await lua.executeAsync('des.map({ map = "}", x = -1, y = -1, coord = {20, 9} })');
    assert.equal(level.requireAt(20, 9).typ, MOAT);
});

void test('explicit Lua axes ignore an unused malformed coord', async t => {
    const { lua, level } = await levelScript(t);

    await lua.executeAsync('des.feature({ type = "fountain", x = 12, y = 7, coord = false })');

    assert.equal(level.requireAt(13, 7).typ, FOUNTAIN);
});
