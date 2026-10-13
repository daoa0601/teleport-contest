import test from 'node:test';
import assert from 'node:assert/strict';
import { ANTHOLE, COURT, OROOM, ROOMOFFSET, THRONE, ZOO } from '../js/const.js';
import { game } from '../js/gstate.js';
import { checkSpecialRoom } from '../js/shk.js';
import { freshObjectRoom } from './support/object-room.js';
for (const entry of [
    { type: ANTHOLE, message: 'You enter an anthole!' },
    { type: ZOO, message: "Welcome to David's treasure zoo!" },
    { type: COURT, message: 'You enter an opulent room!' },
]) {
    void test(`entering room type ${entry.type} announces it once`, async () => {
        const level = freshObjectRoom();
        const room = {
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
        for (let y = 8; y <= 12; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(12, 10).typ = THRONE;
    game.u.urooms = [];
    game.u.ushops = [];
    await checkSpecialRoom();
    assert.equal(game._last_message, 'You enter an opulent throne room!');
});
//# sourceMappingURL=special_room_entry.test.js.map