import { isRoom } from '../js/map_types.js';
import { createSpecialLevel } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { SHOPBASE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import {
    CORPSE, EGG, ENORMOUS_MEATBALL, MEATBALL, MEAT_RING, MEAT_STICK,
    OBJECT_MATERIAL, TIN, TRIPE_RATION,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObjects } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
import { startLuaCore } from './support/lua-game.js';

void test('Lua-generated health food shops stock actual vegetarian food', async t => {
    freshSpecialLevel({ prototype: 'themerms', seed: 271, depth: 3 });
    requirePlayingGame(game);
    assert.ok(game.specialLevels != null, 'Expected game.specialLevels to be initialized');
    game.specialLevels.clear();
    game.flags.bones = false;
    game.medusa_level = createSpecialLevel({ dnum: 0, dlevel: 20 });
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.themeRooms = 'themerms.lua';
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua != null, 'Expected lua to be initialized');
    assert.ok(lua);
    await lua.executeAsync(`
        function themerooms_generate()
            des.room({type="health food shop", filled=1})
        end
    `);
    initRng(145n);

    await mklev();

    const shops = game.level.rooms.filter(isRoom).filter(room => room.rtype === SHOPBASE + 10);
    assert.ok(shops.length > 0, 'the Lua room generator must create a health food shop');
    const stock = floorObjects(game.level).filter(object => object.oclass === 7
        && shops.some(room => object.ox >= room.lx && object.ox <= room.hx
            && object.oy >= room.ly && object.oy <= room.hy));
    assert.ok(stock.length > 10, 'health food shelves must contain real food objects');
    assert.ok(stock.some(object => ![CORPSE, EGG, TIN].includes(object.otyp)
        && OBJECT_MATERIAL[object.otyp] === 3)); // VEGGY
    assert.ok(stock.every(object => ![
        TRIPE_RATION, MEATBALL, MEAT_STICK, ENORMOUS_MEATBALL, MEAT_RING,
    ].includes(object.otyp)), 'health food shops must not stock meat products');
});
