import test from 'node:test';
import assert from 'node:assert/strict';
import { A_LAWFUL, ALTAR, Amask2align, F_LOOTED, FOUNTAIN, F_WARNED, THEMEROOM } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { roomBindings } from './support/themed-room-bindings.js';
async function buildRoom(t, contents) {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'Expected lua to be initialized');
    await lua.executeAsync(`
        themerooms = {{ name = "Reader chamber", frequency = 1,
            contents = function()
                des.room({ type = "themed", w = 8, h = 4, filled = 0, contents = function()
                    ${contents}
                end })
            end
        }}
    `);
    game.level = new GameMap();
    await mklev();
    requirePlayingGame(game);
    const room = game.level.rooms.slice(0, game.level.nroom).filter(isRoom).find(r => r.rtype === THEMEROOM);
    assert.ok(room, 'the Lua room definition should build a chamber');
    return room;
}
void test('lowercase object buc options bless and curse the placed objects', async (t) => {
    const room = await buildRoom(t, `
        des.object({ id = "fedora", buc = "blessed", x = 2, y = 1 })
        des.object({ id = "bullwhip", buc = "cursed", x = 3, y = 1 })
    `);
    const level = requireGameLevel();
    const fedora = (level.objects[room.lx + 2]?.[room.ly + 1] ?? []).at(-1);
    const bullwhip = (level.objects[room.lx + 3]?.[room.ly + 1] ?? []).at(-1);
    if (!fedora || !bullwhip)
        throw new Error('the two level objects must be placed');
    assert.equal(fedora.blessed, true);
    assert.equal(fedora.cursed, false);
    assert.equal(bullwhip.cursed, true);
});
void test('the lowercase law option creates a lawful altar', async (t) => {
    const room = await buildRoom(t, `
        des.altar({ align = "law", x = 2, y = 1 })
    `);
    const altar = requireGameLevel().at(room.lx + 2, room.ly + 1);
    assert.ok(altar, 'the altar square must exist');
    assert.equal(altar.typ, ALTAR);
    assert.equal(Amask2align(altar.flags), A_LAWFUL);
});
for (const buc of ['Blessed', 'CuRsEd', 'constructor', '__proto__', 'unknown']) {
    void test(`object buc=${buc} is rejected without placing an object`, async (t) => {
        const lua = await roomBindings(t);
        await lua.executeAsync('des.map({ x = 10, y = 6, map = "." })');
        await assert.rejects(lua.executeAsync(`des.object({ id = "fedora", buc = "${buc}", x = 0, y = 0 })`), /unsupported Lua buc/);
        assert.equal(requireGameLevel().objects[10]?.[6]?.length ?? 0, 0);
    });
}
for (const align of ['Law', 'constructor', '__proto__', 'unknown']) {
    void test(`altar align=${align} is rejected without changing the terrain`, async (t) => {
        const lua = await roomBindings(t);
        await lua.executeAsync('des.map({ x = 10, y = 6, map = "." })');
        const cell = requireGameLevel().requireAt(10, 6);
        const previousType = cell.typ;
        const previousFlags = cell.flags;
        await assert.rejects(lua.executeAsync(`des.altar({ align = "${align}", x = 0, y = 0 })`), /unsupported Lua alignment/);
        assert.equal(cell.typ, previousType);
        assert.equal(cell.flags, previousFlags);
    });
}
void test('a region table requires a region array when explicit corners are absent', async (t) => {
    const lua = await roomBindings(t);
    await lua.executeAsync('des.map({ x = 10, y = 6, map = "...." })');
    const level = requireGameLevel();
    await assert.rejects(lua.executeAsync('des.region({ type = "ordinary", lit = 0 })'), /region/);
    assert.equal(level.nroom, 0);
    assert.equal(level.requireAt(10, 6).lit, false);
});
void test('feature flag fields set the furniture flags of the placed feature', async (t) => {
    const room = await buildRoom(t, `
        des.feature({ type = "fountain", looted = true, warned = false, x = 2, y = 1 })
    `);
    const fountain = requireGameLevel().at(room.lx + 2, room.ly + 1);
    assert.ok(fountain, 'the fountain square must exist');
    assert.equal(fountain.typ, FOUNTAIN);
    assert.notEqual((fountain.looted ?? 0) & F_LOOTED, 0, 'looted sets F_LOOTED');
    assert.equal((fountain.looted ?? 0) & F_WARNED, 0, 'warned = false clears F_WARNED');
});
//# sourceMappingURL=special_level_table_readers.test.js.map