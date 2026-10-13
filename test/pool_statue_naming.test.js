import assert from 'node:assert/strict';
import test from 'node:test';
import { CORPSTAT_GENDER } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { STATUE } from '../js/object_data.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
void test('random Lua statues retain their birth gender for object descriptions', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    const existing = new Set(game.level.objects.flat(2));
    await lua.executeAsync('for i = 1, 40 do des.object({ class = "`", x = 3, y = 3 }) end');
    const statues = game.level.objects.flat(2).filter(object => object?.otyp === STATUE && !existing.has(object));
    assert.ok(statues.length > 0, 'the rock-class objects include a statue');
    for (const statue of statues) {
        assert.ok(statue);
        assert.notEqual((statue.spe ?? 0) & CORPSTAT_GENDER, 0, 'a random statue has a known gender');
    }
});
//# sourceMappingURL=pool_statue_naming.test.js.map