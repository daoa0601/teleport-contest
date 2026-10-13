import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTAR } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('room altars occupy separate floor squares', async t => {
    const lua = await roomBindings(t);
    for (let seed = 1; seed <= 16; seed++) {
        game.level = new GameMap();
        initRng(seed);

        await lua.executeAsync(`
            themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", x = 3, y = 3, w = 3, h = 3, lit = 1,
                xalign = "left", yalign = "top", contents = function()
                    des.altar({ align = "law" })
                    des.altar({ align = "neutral" })
                    des.altar({ align = "chaos" })
                end })
            end }}
        `);
        await mklev();

        requirePlayingGame(game);
        const altars = game.level.locations.flat().filter(loc => loc.typ === ALTAR);
        assert.equal(altars.length, 3, `three altars should survive placement, seed ${seed}`);
        assert.deepEqual(altars.map(altar => altar.flags).sort(), [1, 2, 4]);
    }
});
