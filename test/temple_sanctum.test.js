import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { A_NONE, ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
void test('entering Moloch\'s Sanctum angers its high priest without a peaceful-temple blessing', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const room = createRoom({ lx: 11, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(12, 10).typ = ALTAR;
    level.requireAt(12, 10).flags = AM_SHRINE | Align2amask(A_NONE);
    game.sanctum_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    const priest = await createMonsterAt('high cleric', 13, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.isminion = 0;
    priest.mpeaceful = 1;
    priest.msleeping = 0;
    priest.epri = {
        parentmid: priest.m_id, shroom: ROOMOFFSET, shralign: A_NONE,
        shrpos: { x: 12, y: 10 }, shrlevel: { ...game.u.uz },
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await rhack('l'.charCodeAt(0));
    assert.equal(priest.mpeaceful, 0);
    assert.equal(priest.malign, 20);
    assert.match(game._pending_message, /Infidel, you have entered Moloch's Sanctum!/);
    assert.equal(game._lastPlineMessage, '"Be gone!"');
    assert.equal(priest.epri.hostile_time, 0);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=temple_sanctum.test.js.map