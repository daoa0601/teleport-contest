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
// sp_lev.c's table readers are case-insensitive C lookups (get_table_option
// uses strcmpi; get_table_buc and get_table_align share it), and
// lspo_feature's flag fields reach l_table_getset_feature_flag().
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
void test('an object buc name is matched case-insensitively like get_table_buc', async (t) => {
    const room = await buildRoom(t, `
        des.object({ id = "fedora", buc = "Blessed", x = 2, y = 1 })
        des.object({ id = "bullwhip", buc = "CuRsEd", x = 3, y = 1 })
    `);
    const level = requireGameLevel();
    const fedora = (level.objects[room.lx + 2]?.[room.ly + 1] ?? []).at(-1);
    const bullwhip = (level.objects[room.lx + 3]?.[room.ly + 1] ?? []).at(-1);
    if (!fedora || !bullwhip)
        throw new Error('the two level objects must be placed');
    assert.equal(fedora.blessed, true, '"Blessed" blesses the fedora');
    assert.equal(fedora.cursed, false);
    assert.equal(bullwhip.cursed, true, '"CuRsEd" curses the bullwhip');
});
void test('an altar alignment name is matched case-insensitively like get_table_align', async (t) => {
    const room = await buildRoom(t, `
        des.altar({ align = "Law", x = 2, y = 1 })
    `);
    const altar = requireGameLevel().at(room.lx + 2, room.ly + 1);
    assert.ok(altar, 'the altar square must exist');
    assert.equal(altar.typ, ALTAR);
    assert.equal(Amask2align(altar.flags), A_LAWFUL, '"Law" resolves to a lawful altar');
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