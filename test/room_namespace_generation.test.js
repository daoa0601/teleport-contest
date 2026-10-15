import assert from 'node:assert/strict';
import test from 'node:test';
import { MAXNROFROOMS, ROOMOFFSET } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { roomForIndex, roomsAt } from '../js/room.js';
import { roomBindings } from './support/themed-room-bindings.js';
void test('generated subrooms start after the ordinary room array sentinel', async (t) => {
    const lua = await roomBindings(t);
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 15, h = 8, filled = 0,
                contents = function()
                    des.room({ type = "beehive", x = 2, y = 2,
                               w = 4, h = 3, filled = 0 })
                end })
        end }}
    `);
    await mklev();
    requirePlayingGame(game);
    const hive = game.level.subrooms?.[0];
    assert.ok(hive, 'the generator must build a subroom');
    assert.equal(roomForIndex(game.level, MAXNROFROOMS), null, 'the ordinary room sentinel cannot name a subroom');
    assert.equal(roomForIndex(game.level, MAXNROFROOMS + 1), hive);
    assert.deepEqual(roomsAt(game.level, hive.lx, hive.ly), [MAXNROFROOMS + 1 + ROOMOFFSET]);
});
//# sourceMappingURL=room_namespace_generation.test.js.map