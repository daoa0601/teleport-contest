import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { roomBindings } from './support/themed-room-bindings.js';
void test('an explicitly positioned room respects the left map margin', async (t) => {
    const lua = await roomBindings(t);
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", x = 0, y = 0, w = 3, h = 3,
                       xalign = "left", yalign = "top", lit = 1 })
        end }}
    `);
    await mklev();
    requirePlayingGame(game);
    const room = game.level.rooms[0];
    assert.ok(isRoom(room));
    assert.equal(room.lx, 3);
    assert.equal(room.hx, 5);
});
//# sourceMappingURL=levelgen_room_rules.test.js.map