import test from 'node:test';
import assert from 'node:assert/strict';
import { MORGUE, OROOM, ROOMOFFSET } from '../js/const.js';
import { game } from '../js/gstate.js';
import { checkSpecialRoom } from '../js/shk.js';
import { freshObjectRoom } from './support/object-room.js';
import type { Room } from '../js/map_types.js';

// C hack.c:check_special_room() MORGUE case consults calendar.c:midnight(),
// which is the localtime()-normalized hour of getnow(), not the fixed
// datetime's literal hour string.
async function enterMorgue(datetime: string) {
    const level = freshObjectRoom();
    game.datetime = datetime;
    const room: Room = {
        lx: 8, hx: 18, ly: 8, hy: 12, rtype: MORGUE,
        needfill: 0, rlit: 1, doorct: 0, fdoor: 0, irregular: false,
        needjoining: false, sbrooms: [], nsubrooms: 0, roomnoidx: 0,
    };
    level.rooms = [room];
    level.nroom = 1;
    level.requireAt(game.u.ux, game.u.uy).roomno = ROOMOFFSET;
    game.u.urooms = [];
    game.u.ushops = [];

    await checkSpecialRoom();

    assert.equal(room.rtype, OROOM);
}

void test('entering a morgue at the midnight hour tells the hero to run', async context => {
    context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 15, 12) });
    await enterMorgue('20021214000000');

    assert.equal(game._last_message, 'Run away!  Run away!');
});

void test('entering a morgue at a fixed winter midnight read during summer time is uncanny',
    async context => {
        // The inherited summer offset shifts 2002-12-14 00:00 to
        // 2002-12-13 23:00 EST, an hour before midnight.
        context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 6, 15, 12) });
        await enterMorgue('20021214000000');

        assert.equal(game._last_message, 'You have an uncanny feeling...');
    });
