import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createRoom } from './support/topology.js';

// C priest.c:intemple(): can_speak is !helpless(priest), and helpless() is
// only msleeping || !mcanmove (monst.h).  A priest frozen mid-turn by a
// monster attack still greets pilgrims entering its temple.
void test('a frozen but awake temple priest still intones and greets an entrant', async () => {
    const level = freshObjectRoom({ hero: { ualign: { type: 0, record: 0 } } });
    requirePlayingGame(game);
    const room = createRoom({ lx: 11, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 13, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 1;
    priest.female = true;
    priest.msleeping = 0;
    priest.mcanmove = 1;
    priest.mfrozen = 5;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    const input = resetInputState();
    await answerPrompts(rhack('l'.charCodeAt(0)), input, [
        { prompt: /priestess of .+ intones:\s+"Pilgrim, you enter a sacred place!"\s*--More--/, keys: ' ' },
    ]);
    assert.equal(game._lastPlineMessage, 'You experience an unusual sense of peace.');

    assert.ok(priest.epri);
    assert.ok(priest.epri.intone_time > game.moves, 'the frozen priest still sets its intone cooldown');
    assert.ok(priest.epri.enter_time > game.moves, 'the frozen priest still sets its greeting cooldown');
});
