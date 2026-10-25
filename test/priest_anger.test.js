import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ALTAR, AM_SHRINE, ROOM, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE, } from '../js/const.js';
import { angerTemplePriest } from '../js/priest.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { corpseObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createRoom } from './support/topology.js';
async function templeWithPriest(onAltar) {
    const level = freshObjectRoom({ hero: { ualign: { type: 0, record: 0 } } });
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
    if (onAltar) {
        game.u.ux = 12;
        game.u.uy = 10;
    }
    else {
        game.u.ux = 13;
        game.u.uy = 10;
    }
    game.u.urooms = [ROOMOFFSET];
    game.u.urooms0 = [ROOMOFFSET];
    const priest = await createMonsterAt('aligned cleric', 14, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 1;
    priest.msleeping = 1;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    return { level, altar, priest };
}
// C priest.c:angry_priest() via pray.c's own-race sacrifice: the stained
// altar no longer matches the shrine, so the woken priest drops its
// priesthood and roams as an unaligned minion of its former god.
void test('sacrificing one\'s own race frees the temple priest as a roaming minion', async () => {
    const { altar, priest } = await templeWithPriest(true);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('human')));
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 40 });
    pushKeys(`offer\n${corpse.invlet}\n`);
    await rhack('#'.charCodeAt(0));
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /You'll regret this infamous offense!/);
    assert.match(text, /The altar is stained with human blood\./);
    assert.match(text, /The priestess of Ishtar wakes up\./);
    assert.match(text, /gets angry!/);
    assert.match(text, /Ishtar (?:is displeased|booms:)/, 'the desecration angers the hero\'s own god');
    assert.equal(altar.flags & 0x07, Align2amask(-1), 'the altar was converted to chaos');
    assert.equal(priest.ispriest, 0, 'a freed priest loses its shrine office');
    assert.equal(priest.isminion, 1);
    assert.equal(priest.mpeaceful, 0);
    assert.equal(priest.msleeping, 0);
    assert.deepEqual(priest.emin ?? priest.mextra?.emin, { min_align: 0, renegade: 0 });
    assert.equal(priest.epri ?? priest.mextra?.epri ?? null, null, 'the former priest keeps no shrine record');
});
// C priest.c:angry_priest() with the shrine intact: the resident wakes and
// turns hostile but keeps guarding its temple as a priest.
void test('an angry resident keeps its priesthood while its shrine stands', async () => {
    const { priest } = await templeWithPriest(false);
    await angerTemplePriest(game);
    assert.equal(priest.msleeping, 0, 'angering the temple wakes its resident');
    assert.equal(priest.mpeaceful, 0);
    assert.equal(priest.ispriest, 1);
    assert.ok(priest.epri, 'an intact shrine keeps its priesthood record');
});
// C priest.c:angry_priest(): a destroyed altar also severs the priesthood.
void test('a destroyed altar frees the resident as a renegade-free minion', async () => {
    const { altar, priest } = await templeWithPriest(false);
    altar.typ = ROOM;
    await angerTemplePriest(game);
    assert.equal(priest.ispriest, 0);
    assert.equal(priest.isminion, 1);
    assert.deepEqual(priest.emin ?? priest.mextra?.emin, { min_align: 0, renegade: 0 });
});
//# sourceMappingURL=priest_anger.test.js.map