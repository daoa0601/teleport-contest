import assert from 'node:assert/strict';
import test from 'node:test';

import { FOUNTAIN, G_GENOD, SHOPBASE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_SYMBOL } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('shop stocking places merchandise on interior fountains', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 2 };
    for (const [species, vital] of (game.mvitals ?? []).entries())
        if (MONSTER_SYMBOL[species] === 13) vital.mvflags |= G_GENOD; // S_MIMIC
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "potion shop", w = 8, h = 4, filled = 1,
                contents = function()
                    des.feature({ type = "fountain", x = 3, y = 2 })
                end })
        end }}
        function post_level_generate() end
    `);
    initRng(67);

    await mklev();

    const shops = game.level.rooms.filter(isRoom).filter(room => room.rtype === SHOPBASE + 3);
    assert.ok(shops.length > 0, 'the level generator must create potion shops');
    for (const room of shops) {
        const x = room.lx + 3, y = room.ly + 2;
        assert.equal(game.level.requireAt(x, y).typ, FOUNTAIN);
        assert.ok(game.level.objects[x]?.[y]?.some(object => object.oclass === 8),
            `the fountain at ${x},${y} must receive potion stock`);
    }
});
