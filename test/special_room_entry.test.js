import assert from 'node:assert/strict';
import test from 'node:test';
import { ANTHOLE, OROOM, ROOMOFFSET } from '../js/const.js';
import { game } from '../js/gstate.js';
import { checkSpecialRoom } from '../js/shk.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
void test('entering an anthole announces it once and makes the room ordinary', async () => {
    const level = freshObjectRoom();
    const room = createRoom({ lx: 8, hx: 16, ly: 6, hy: 14, rtype: ANTHOLE });
    level.rooms.push(room);
    level.requireAt(10, 10).roomno = ROOMOFFSET;
    game.u.urooms = [];
    await checkSpecialRoom();
    assert.equal(game._pending_message, 'You enter an anthole!');
    assert.equal(room.rtype, OROOM);
});
//# sourceMappingURL=special_room_entry.test.js.map