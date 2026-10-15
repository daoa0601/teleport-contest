import assert from 'node:assert/strict';
import test from 'node:test';
import { BEEHIVE, OROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { restoreGame, saveGame } from '../js/save.js';
import { checkSpecialRoom } from '../js/shk.js';
import { memoryStorage } from './support/memory-storage.js';
import { roomBindings } from './support/themed-room-bindings.js';
void test('entering a restored special subroom updates the room linked from its parent', async (t) => {
    const lua = await roomBindings(t);
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 15, h = 8, filled = 0,
                contents = function()
                    des.room({ type = "beehive", x = 2, y = 2,
                               w = 4, h = 3, filled = 1 })
                end })
        end }}
    `);
    await mklev();
    requirePlayingGame(game);
    const storage = memoryStorage();
    game.plname = 'Nested rooms';
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Nested rooms', storage), true);
    requirePlayingGame(game);
    const parent = game.level.rooms.filter(isRoom).find(room => room.nsubrooms > 0);
    const hive = parent?.sbrooms[0];
    assert.ok(hive, 'the restored level needs a nested beehive');
    assert.equal(hive.rtype, BEEHIVE);
    game.u.ux = hive.lx;
    game.u.uy = hive.ly;
    await checkSpecialRoom();
    assert.equal(hive.rtype, OROOM, 'the parent must see that its beehive has been entered');
    assert.ok(game.level.subrooms?.includes(hive), 'the parent and level must share the same subroom');
});
//# sourceMappingURL=room_restore.test.js.map