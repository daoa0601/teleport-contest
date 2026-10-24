import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOMOFFSET, SHARED } from '../js/const.js';
import { requireGameLevel } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('an irregular room stops its floor fill before the eastern boundary column', async t => {
    const lua = await roomBindings(t);

    await lua.executeAsync(`
        des.map({ x = 77, y = 5, map = [[...]] })
        des.region({ region = {0,0,2,0}, irregular = true, lit = 1 })
    `);

    const level = requireGameLevel();
    const room = level.rooms.find(isRoom);
    assert.ok(room);
    assert.equal(room.hx, 78);
    assert.equal(level.requireAt(78, 5).roomno, ROOMOFFSET);
    assert.equal(level.requireAt(78, 5).lit, true);
    assert.equal(level.requireAt(79, 5).roomno, 0, 'the outer column is not part of the flooded room');
    assert.equal(level.requireAt(79, 5).lit, false);
});

void test('an irregular room starts its fill at the leftmost roomlike tile and stops a run at different terrain', async t => {
    const lua = await roomBindings(t);

    await lua.executeAsync(`
        des.map({ x = 10, y = 5, map = [[.{.]] })
        des.region({ region = {2,0,2,0}, irregular = true, lit = 1 })
    `);

    const level = requireGameLevel();
    assert.equal(level.requireAt(10, 5).roomno, ROOMOFFSET, 'backtracking crosses room furniture');
    assert.equal(level.requireAt(10, 5).lit, true);
    assert.equal(level.requireAt(11, 5).roomno, 0, 'the fountain stops this floor run');
    assert.equal(level.requireAt(12, 5).roomno, 0);
    assert.equal(level.requireAt(12, 5).lit, false);
});

void test('adjacent irregular rooms share their wall without a dark room extinguishing it', async t => {
    const lua = await roomBindings(t);

    await lua.executeAsync(`
        des.map({ x = 10, y = 5, map = [[.-.]] })
        des.region({ region = {0,0,0,0}, irregular = true, lit = 1 })
        des.region({ region = {2,0,2,0}, irregular = true, lit = 0 })
    `);

    const level = requireGameLevel();
    assert.equal(level.requireAt(10, 5).roomno, ROOMOFFSET);
    assert.equal(level.requireAt(12, 5).roomno, ROOMOFFSET + 1);
    assert.equal(level.requireAt(12, 5).lit, false);
    const wall = level.requireAt(11, 5);
    assert.equal(wall.roomno, SHARED);
    assert.equal(wall.edge, true);
    assert.equal(wall.lit, true);
});
