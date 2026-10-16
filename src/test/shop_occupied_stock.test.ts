import assert from 'node:assert/strict';
import test from 'node:test';

import { SHOPBASE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('shop stocking puts merchandise beneath worm tails instead of attempting a mimic there', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    // At depth 100 every unoccupied shelf tries to become a mimic.
    dungeon.depth_start = 99;
    game.u.uz = { dnum: 0, dlevel: 2 };
    game.specialLevels?.clear();
    game.branches = [];
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "potion shop", w = 8, h = 4, filled = 1,
                contents = function()
                    des.monster({ id = "long worm", x = 4, y = 2, asleep = 1 })
                end })
        end }}
        function post_level_generate() end
    `);
    initRng(67);

    await mklev();

    const shops = game.level.rooms.filter(isRoom).filter(room => room.rtype === SHOPBASE + 3);
    const shelfSegments = game.level.monsters
        .filter(monster => monster.mnum === MONSTER_NAME.indexOf('long worm'))
        .flatMap(monster => monster.wormSegments ?? [])
        .filter(({ x, y }) => shops.some(room =>
            x > room.lx && x < room.hx && y > room.ly && y < room.hy));
    assert.ok(shelfSegments.length > 0, 'the generated worms must occupy interior shop shelves');
    for (const { x, y } of shelfSegments)
        assert.ok(game.level.objects[x]?.[y]?.some(object => object.oclass === 8),
            `the worm segment at ${x},${y} must have potion stock beneath it`);
});
