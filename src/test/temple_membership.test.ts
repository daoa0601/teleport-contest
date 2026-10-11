import { createRoom } from './support/topology.js';
import { isRoom } from '../js/map_types.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { mklev } from '../js/mklev.js';
import { game } from '../js/gstate.js';
import { ROOMOFFSET, TEMPLE } from '../js/const.js';
import { templeRoomAt } from '../js/priest.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshSpecialLevel } from './support/special-level.js';

void test('the priest quest temple is recognized throughout its Lua-created interior', async () => {
    freshSpecialLevel({ prototype: 'Pri-strt', seed: 2501, depth: 1 });
    requirePlayingGame(game);
    game._specialLevelPrototype = 'Pri-strt';
    game._activeSpecialLevel = null;
    await mklev();
    const temple = game.level.rooms.filter(isRoom).find(room => room.rtype === TEMPLE);
    assert.ok(temple);

    for (let x = temple.lx; x <= temple.hx; x++) {
        for (let y: number = temple.ly; y <= temple.hy; y++)
            assert.equal(templeRoomAt(game, x, y)?.room, temple, `temple square ${x},${y}`);
    }
});

void test('an irregular temple does not own holes in its bounding rectangle', () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const temple = createRoom({
        lx: 8, hx: 12, ly: 8, hy: 12, rtype: TEMPLE, irregular: true,
    });
    game.level.rooms = [temple];
    game.level.nroom = 1;
    // The north and west arms surround an ordinary floor square.
    for (let x = 8; x <= 12; x++) game.level.requireAt(x, 8).roomno = ROOMOFFSET;
    for (let y = 8; y <= 12; y++) game.level.requireAt(8, y).roomno = ROOMOFFSET;

    assert.equal(templeRoomAt(game, 8, 10)?.room, temple);
    assert.equal(templeRoomAt(game, 10, 10), null);
});
