import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, OROOM, ROOM, STONE } from '../js/const.js';
import { mkmap } from '../js/mkmap.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
void test('cave initialization resets terrain, room membership and light while preserving other cell fields', async () => {
    const { level } = freshGame();
    initRng(1);
    const boundary = level.requireAt(79, 5);
    boundary.typ = CORR;
    boundary.roomno = 5;
    boundary.lit = true;
    boundary.edge = true;
    boundary.horizontal = true;
    boundary.flags = 3;
    const unusedColumn = level.requireAt(0, 5);
    unusedColumn.typ = CORR;
    unusedColumn.lit = true;
    await mkmap({ lit: false, joined: false, walled: false });
    assert.equal(boundary.typ, STONE);
    assert.equal(boundary.roomno, 0);
    assert.equal(boundary.lit, false);
    assert.equal(boundary.edge, true, 'init_map does not clear an existing room edge');
    assert.equal(boundary.horizontal, true);
    assert.equal(boundary.flags, 3);
    assert.equal(unusedColumn.typ, CORR, 'column zero is outside the cave');
    assert.equal(unusedColumn.lit, true);
});
void test('joining a cave connects preexisting rooms and discards all temporary room and subroom records', async () => {
    const { level } = freshGame();
    const westernRoom = {
        lx: 1, hx: 1, ly: 1, hy: 1,
        rtype: OROOM, rlit: 0, doorct: 0, fdoor: 0,
        irregular: false, needjoining: true, needfill: 0,
        nsubrooms: 0, sbrooms: [], roomnoidx: 0,
    };
    const subroom = {
        ...westernRoom, lx: 12, hx: 14, ly: 7, hy: 9, roomnoidx: 41,
    };
    const parent = {
        ...westernRoom, lx: 10, hx: 20, ly: 5, hy: 15, roomnoidx: 1,
        nsubrooms: 1, sbrooms: [subroom],
    };
    level.rooms = [westernRoom, parent];
    level.nroom = 2;
    level.subrooms = [subroom];
    level.nsubroom = 1;
    initRng(1);
    await mkmap({ lit: false, joined: true, walled: false });
    assert.equal(level.requireAt(1, 1).typ, ROOM, 'the original room is connected to the cave');
    assert.equal(level.nroom, 0);
    assert.equal(level.nsubroom, 0);
    assert.equal(level.subrooms?.length, 0, 'subrooms cannot outlive their discarded parents');
    assert.equal(level.requireAt(20, 10).roomno, 0);
});
//# sourceMappingURL=cave_map.test.js.map