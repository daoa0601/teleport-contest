import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ANTHOLE, BARRACKS, BEEHIVE, COURT, MAXNROFROOMS, MORGUE, OROOM,
    ROOMOFFSET, SWAMP, THRONE, ZOO,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import type { Room } from '../js/map_types.js';
import { checkSpecialRoom } from '../js/shk.js';
import { freshObjectRoom } from './support/object-room.js';

for (const entry of [
    { type: ANTHOLE, message: 'You enter an anthole!' },
    { type: ZOO, message: "Welcome to David's treasure zoo!" },
    { type: COURT, message: 'You enter an opulent room!' },
]) {
    void test(`entering room type ${entry.type} announces it once`, async () => {
        const level = freshObjectRoom();
        const room: Room = {
            lx: 8, hx: 18, ly: 8, hy: 12, rtype: entry.type,
            needfill: 0, rlit: 1, doorct: 0, fdoor: 0, irregular: false,
            needjoining: false, sbrooms: [], nsubrooms: 0, roomnoidx: 0,
        };
        level.rooms = [room];
        level.nroom = 1;
        level.requireAt(game.u.ux, game.u.uy).roomno = ROOMOFFSET;
        game.u.urooms = [];
        game.u.ushops = [];

        await checkSpecialRoom();

        assert.equal(game._last_message, entry.message);
        assert.equal(room.rtype, OROOM);
        game._last_message = '';
        game.u.urooms = [];
        await checkSpecialRoom();
        assert.equal(game._last_message, '');
    });
}

void test('a court with a throne is announced as a throne room', async () => {
    const level = freshObjectRoom();
    level.rooms = [{
        lx: 8, hx: 18, ly: 8, hy: 12, rtype: COURT,
        needfill: 0, rlit: 1, doorct: 0, fdoor: 0, irregular: false,
        needjoining: false, sbrooms: [], nsubrooms: 0, roomnoidx: 0,
    }];
    level.nroom = 1;
    for (let x = 8; x <= 18; x++)
        for (let y = 8; y <= 12; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(12, 10).typ = THRONE;
    game.u.urooms = [];
    game.u.ushops = [];

    await checkSpecialRoom();

    assert.equal(game._last_message, 'You enter an opulent throne room!');
});

for (const entry of [
    { description: 'includes a throne in its subroom', irregular: false,
        throneX: 13, throneRoomno: ROOMOFFSET + MAXNROFROOMS, edge: false, hasThrone: true },
    { description: 'excludes another room from its irregular shape', irregular: true,
        throneX: 13, throneRoomno: ROOMOFFSET + MAXNROFROOMS, edge: false, hasThrone: false },
    { description: 'excludes an edge square from its irregular shape', irregular: true,
        throneX: 13, throneRoomno: ROOMOFFSET, edge: true, hasThrone: false },
    { description: 'excludes a throne beyond its bounds', irregular: false,
        throneX: 19, throneRoomno: ROOMOFFSET, edge: false, hasThrone: false },
]) {
    void test(`a court ${entry.description} when announcing its furniture`, async () => {
        const level = freshObjectRoom();
        const room: Room = {
            lx: 8, hx: 18, ly: 8, hy: 12, rtype: COURT,
            needfill: 0, rlit: 1, doorct: 0, fdoor: 0, irregular: entry.irregular,
            needjoining: false, sbrooms: [], nsubrooms: 1, roomnoidx: 0,
        };
        const subroom: Room = {
            ...room, lx: 12, hx: 14, ly: 9, hy: 11, rtype: OROOM,
            irregular: false, sbrooms: [], nsubrooms: 0, roomnoidx: MAXNROFROOMS,
        };
        room.sbrooms = [subroom];
        level.rooms = [room];
        level.nroom = 1;
        level.subrooms = [subroom];
        level.nsubroom = 1;
        level.requireAt(game.u.ux, game.u.uy).roomno = ROOMOFFSET;
        const throne = level.requireAt(entry.throneX, 10);
        throne.typ = THRONE;
        throne.roomno = entry.throneRoomno;
        throne.edge = entry.edge;
        game.u.urooms = [];
        game.u.ushops = [];

        await checkSpecialRoom();

        assert.equal(game._last_message, entry.hasThrone
            ? 'You enter an opulent throne room!' : 'You enter an opulent room!');
    });
}

for (const [type, flag] of [
    [COURT, 'has_court'], [SWAMP, 'has_swamp'], [MORGUE, 'has_morgue'],
    [ZOO, 'has_zoo'], [BARRACKS, 'has_barracks'], [BEEHIVE, 'has_beehive'],
] as const) {
    void test(`entering a ${flag} room retains the flag until its special subroom is entered`, async () => {
        const level = freshObjectRoom();
        const room: Room = {
            lx: 8, hx: 18, ly: 8, hy: 12, rtype: type,
            needfill: 0, rlit: 1, doorct: 0, fdoor: 0, irregular: false,
            needjoining: false, sbrooms: [], nsubrooms: 1, roomnoidx: 0,
        };
        const subroom: Room = {
            ...room, lx: 13, hx: 15, ly: 9, hy: 11,
            sbrooms: [], nsubrooms: 0, roomnoidx: MAXNROFROOMS,
        };
        room.sbrooms = [subroom];
        level.rooms = [room];
        level.nroom = 1;
        level.subrooms = [subroom];
        level.nsubroom = 1;
        level.flags[flag] = true;
        level.requireAt(game.u.ux, game.u.uy).roomno = ROOMOFFSET;
        level.requireAt(14, 10).roomno = ROOMOFFSET + MAXNROFROOMS;
        game.u.urooms = [];
        game.u.ushops = [];

        await checkSpecialRoom();

        assert.equal(room.rtype, OROOM);
        assert.equal(subroom.rtype, type);
        assert.equal(level.flags[flag], true, 'the unentered subroom still supplies ambient events');

        game.u.ux = 14;
        game.u.uy = 10;
        await checkSpecialRoom();

        assert.equal(subroom.rtype, OROOM);
        assert.equal(level.flags[flag], false, 'the last room of this type has been entered');
    });
}
