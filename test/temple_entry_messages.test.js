import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTAR, AM_SHRINE, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { intemple } from '../js/priest.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createRoom } from './support/topology.js';
void test('a priest seen by infravision names her deity when the hero enters a dark temple', async () => {
    const level = freshObjectRoom({ hero: { infravision: true } });
    requirePlayingGame(game);
    const room = createRoom({ lx: 7, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const cell = level.requireAt(x, y);
            cell.roomno = ROOMOFFSET;
            cell.lit = false;
        }
    }
    const altar = level.requireAt(8, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE;
    const priest = await createMonsterAt('aligned cleric', 13, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.female = true;
    priest.msleeping = 0;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 8, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    game.u.urooms0 = [];
    vision_recalc(0);
    assert.equal(canSeeMonster(priest), true);
    const input = resetInputState();
    await answerPrompts(intemple(ROOMOFFSET), input, [
        { prompt: /The priestess of .+ intones:\s*--More--/, keys: ' ' },
        { prompt: /"Pilgrim, you enter a desecrated place!"\s*--More--/, keys: ' ' },
    ]);
    assert.ok(priest.epri);
    assert.ok(priest.epri.intone_time > game.moves);
});
//# sourceMappingURL=temple_entry_messages.test.js.map