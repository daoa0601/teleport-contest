import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOM, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { priestIsInOwnTemple } from '../js/priest.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
// C priest.c:inhistemple(): residence requires the original aligned shrine.
void test('a priest stops tending its temple when its shrine is lost', async () => {
    const level = await freshObjectRoom();
    requirePlayingGame(game);
    const room = createRoom({ lx: 11, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 14, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    assert.equal(priestIsInOwnTemple(priest), true, 'the original shrine is tended');
    altar.typ = ROOM;
    assert.equal(priestIsInOwnTemple(priest), false, 'a destroyed altar ends residence');
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(-1);
    assert.equal(priestIsInOwnTemple(priest), false, 'a converted shrine ends residence');
    altar.flags = Align2amask(0);
    assert.equal(priestIsInOwnTemple(priest), false, 'an ordinary altar is not a shrine');
});
//# sourceMappingURL=priest_shrine_membership.test.js.map