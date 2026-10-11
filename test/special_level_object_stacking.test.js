import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMEROOM } from '../js/const.js';
import { CORPSE } from '../js/object_data.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
// sp_lev.c create_object() passes each placed object through stackobj(),
// so identical objects a level file puts on one square form one stack.
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
        themerooms = {{ name = "Stacking chamber", frequency = 1,
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
    return game.level.objects[room.lx + 2]?.[room.ly + 1] ?? [];
}
void test('identical corpses placed on one square by a level file form one stack', async (t) => {
    const pile = await buildRoom(t, `
        des.object({ id = "corpse", montype = "newt", x = 2, y = 1 })
        des.object({ id = "corpse", montype = "newt", x = 2, y = 1 })
        des.object({ id = "corpse", montype = "jackal", x = 2, y = 1 })
    `);
    const corpses = pile.filter(object => object.otyp === CORPSE);
    assert.equal(corpses.length, 2, 'the two newt corpses merge; the jackal corpse stays separate');
    assert.deepEqual(corpses.map(corpse => corpse.quan).sort(), [1, 2]);
});
void test('level-file objects on different squares do not stack', async (t) => {
    const pile = await buildRoom(t, `
        des.object({ id = "corpse", montype = "newt", x = 2, y = 1 })
        des.object({ id = "corpse", montype = "newt", x = 3, y = 1 })
    `);
    assert.deepEqual(pile.filter(object => object.otyp === CORPSE).map(corpse => corpse.quan), [1]);
});
//# sourceMappingURL=special_level_object_stacking.test.js.map