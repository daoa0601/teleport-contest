import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOPBASE, VAULT } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
import { levelStairs } from './support/level-state.js';
void test('a staircase inside the room prevents conversion to a shop', async (t) => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 2 };
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "ordinary", w = 6, h = 4, lit = 0,
                contents = function()
                    des.stair("up", 0, 0)
                end })
        end }}
    `);
    for (let seed = 1; seed <= 16; seed++) {
        game.level = new GameMap();
        initRng(seed);
        await mklev();
        const rooms = game.level.rooms.filter(isRoom).filter(room => room.rtype !== VAULT);
        assert.ok(rooms.length >= 3, 'the level needs enough rooms to attempt a shop');
        const stairs = levelStairs(game);
        for (const room of rooms) {
            assert.ok(stairs.some(stair => stair.up && stair.sx === room.lx && stair.sy === room.ly), `candidate at ${room.lx},${room.ly} needs an upstairs inside`);
            assert.ok(room.rtype < SHOPBASE, `a shop must exclude rooms with stairs (seed ${seed})`);
        }
    }
});
//# sourceMappingURL=special_room_stairs.test.js.map