import assert from 'node:assert/strict';
import test from 'node:test';
import { ICE, ROOM, ROOMOFFSET } from '../js/const.js';
import { requireGameLevel } from '../js/gstate.js';
import { shrinePosition } from '../js/mkroom.js';
import { isRoom } from '../js/map_types.js';
import { roomBindings } from './support/themed-room-bindings.js';

// C mkroom.c:shrine_pos() "Fix random attended shrines in irregular rooms":
// when the geometric center of the room is not part of the room (irregular
// flood) or is blocked terrain, the shrine falls back to a random free
// location inside the room instead of placing the altar on the center cell.
void test('a blocked room center moves the shrine to a free room cell', async (t) => {
    const lua = await roomBindings(t);

    // The irregular flood takes the ring but not the wall at the center.
    await lua.executeAsync(`
        des.map({ x = 30, y = 5, map = [[
...
.|.
...
]] })
        des.region({ region = {0,0,0,0}, irregular = true, lit = 1 })
    `);

    const level = requireGameLevel();
    const room = level.rooms.find(isRoom);
    assert.ok(room);
    const centerX = room.lx + Math.trunc((room.hx - room.lx) / 2);
    const centerY = room.ly + Math.trunc((room.hy - room.ly) / 2);
    const center = level.requireAt(centerX, centerY);
    assert.ok(![ROOM, ICE].includes(center.typ),
        'the center wall must not be shrine terrain');

    const shrine = shrinePosition(room);
    const location = level.requireAt(shrine.x, shrine.y);
    assert.equal(location.roomno, ROOMOFFSET, 'the shrine stays inside its room');
    assert.ok([ROOM, ICE].includes(location.typ), `shrine terrain ${location.typ}`);
});
