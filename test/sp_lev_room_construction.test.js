import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, HWALL, MAXNROFROOMS, OROOM, ROOM, ROWNO, STONE, VWALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { init_rect } from '../js/rect.js';
import { check_room, create_room, wallifyMap } from '../js/sp_lev.js';
import { freshObjectRoom } from './support/object-room.js';
// C sp_lev.c:check_room() pulls an out-of-range origin back onto the
// playable map before scanning: lowx below 3 becomes 3 and lowy below 2
// becomes 2, whether or not the scan afterwards rejects the rectangle.
void test('check_room clamps an out-of-range origin to the map edge', async () => {
    await freshObjectRoom({ gameplaySeed: 7n });
    const lowx = { v: 1 }, ddx = { v: 5 }, lowy = { v: 1 }, ddy = { v: 5 };
    check_room(lowx, ddx, lowy, ddy, false);
    assert.equal(lowx.v, 3);
    assert.equal(lowy.v, 2);
});
// C sp_lev.c:wallify_map() turns solid rock touching room terrain into a
// provisional straight wall: the wall runs perpendicular to the room cell
// it faces, and diagonal contact counts.  Rock with no room neighbour
// stays rock.
void test('wallify_map draws straight walls around room terrain', async () => {
    const level = await freshObjectRoom({ gameplaySeed: 11n });
    // Two lone floor cells carved into solid rock.
    level.requireAt(30, 9).typ = ROOM;
    level.requireAt(31, 9).typ = ROOM;
    assert.equal(level.at(29, 9)?.typ, STONE);
    assert.equal(level.at(30, 8)?.typ, STONE);
    wallifyMap(1, 0, COLNO - 1, ROWNO - 1);
    // Same-row neighbour: a vertical wall segment.
    assert.equal(level.at(29, 9)?.typ, VWALL);
    // Row above the floor: a horizontal wall segment.
    assert.equal(level.at(30, 8)?.typ, HWALL);
    assert.equal(level.at(32, 9)?.typ, VWALL);
    // Diagonal-only contact still yields a wall; the scan meets the room
    // row first, so the corner rock becomes horizontal.
    assert.equal(level.at(29, 8)?.typ, HWALL);
    // Rock far from any room keeps its type.
    assert.equal(level.at(60, 18)?.typ, STONE);
});
// C sp_lev.c:create_room() with every coordinate random carves its room
// out of a free rectangle: the accepted room is registered as the next
// room, lies inside the map bounds check_room enforces, and its interior
// is room floor after do_room_or_subroom().
void test('create_room places a random ordinary room on the free map', async () => {
    const level = await freshObjectRoom({ gameplaySeed: 23n });
    init_rect();
    game.smeq = Array.from({ length: MAXNROFROOMS + 1 }, () => 0);
    const roomsBefore = level.nroom;
    assert.equal(create_room(-1, -1, -1, -1, -1, -1, OROOM, -1), true);
    assert.equal(level.nroom, roomsBefore + 1);
    const room = level.rooms.filter(isRoom).at(-1);
    assert.ok(room, 'create_room must install the new room');
    assert.equal(room.rtype, OROOM);
    assert.ok(room.hx <= COLNO - 3 && room.hy <= ROWNO - 3, 'check_room clamps the high corner');
    const { lx, ly, hx, hy } = room;
    assert.ok(lx !== undefined && ly !== undefined
        && hx !== undefined && hy !== undefined, 'the installed room must have complete bounds');
    for (let x = lx; x <= hx; x++)
        for (let y = ly; y <= hy; y++)
            assert.equal(level.at(x, y)?.typ, ROOM, `interior cell ${x},${y} must be room floor`);
});
//# sourceMappingURL=sp_lev_room_construction.test.js.map