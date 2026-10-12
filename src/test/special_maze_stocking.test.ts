import test from 'node:test';
import assert from 'node:assert/strict';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

void test('transparent Lua map cells remain available for maze stocking', async t => {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation should install the Lua des bindings');
    game.level = new GameMap();
    game.in_mklev = true;
    const rows = Array.from({ length: 21 }, (_, y) =>
        y === 3 ? 'xx.' + 'x'.repeat(76) : 'x'.repeat(79));
    initRng(97n);

    await lua.executeAsync(`
        des.level_init({ style = "solidfill", fg = "." })
        des.map({ x = 1, y = 0, map = [[${rows.join('\n')}]] })
        des.mazewalk({ x = 2, y = 3, dir = "east", stocked = true })
    `);

    requirePlayingGame(game);
    const objects = game.level.objects.flat(2).filter(object => object != null);
    assert.ok(objects.length > 0, 'unused maze passages should receive objects');
    assert.ok(game.level.monsters.length > 0, 'unused maze passages should receive monsters');
    assert.ok(game.level.traps.length > 0, 'unused maze passages should receive traps');
    assert.ok(objects.every(object => (object.ox % 2) && (object.oy % 2)));
    assert.equal(game.level.objects[3]?.[3]?.length ?? 0, 0, 'the one mapped floor cell stays unstocked');
});
