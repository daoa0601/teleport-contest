import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createRoom } from './support/topology.js';
async function tendedTemple(hero, shrine) {
    const level = freshObjectRoom({ hero: { ualign: { type: hero.type, record: hero.record } } });
    requirePlayingGame(game);
    const room = createRoom({ lx: 11, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = (shrine ? AM_SHRINE : 0) | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 13, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 1;
    priest.female = true;
    priest.msleeping = 0;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    return priest;
}
async function enterTemple() {
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 20 });
    await rhack('l'.charCodeAt(0));
    return [...messages, game._pending_message].join('\n');
}
// C priest.c:intemple(): a tended temple without the high cleric gives
// "Pilgrim, you enter a sacred/desecrated place!" plus the feeling chosen by
// shrine state, coalition, and the hero's alignment record.
void test('temple entry feelings follow shrine, coalition, and alignment record', async (t) => {
    const cases = [
        // desecrated altar: forbidding even for its own faithful
        { heroType: 0, record: 0, shrine: false, feeling: 'You have a forbidding feeling...' },
        // intact shrine of another god: plain forbidding
        { heroType: 1, record: 0, shrine: true, feeling: 'You have a forbidding feeling...' },
        // own shrine but the hero has sinned: strange forbidding
        { heroType: 0, record: -5, shrine: true, feeling: 'You have a strange forbidding feeling...' },
        // own shrine, devout record: plain peace
        { heroType: 0, record: 14, shrine: true, feeling: 'You experience a sense of peace.' },
    ];
    for (const { heroType, record, shrine, feeling } of cases) {
        await t.test(`a ${shrine ? 'shrined' : 'desecrated'} temple greets alignment ${heroType} record ${record}`, async () => {
            await tendedTemple({ type: heroType, record }, shrine);
            const messages = await enterTemple();
            assert.match(messages, /priestess of .+ intones:/);
            assert.match(messages, new RegExp(`"Pilgrim, you enter a ${shrine ? 'sacred' : 'desecrated'} place!"`));
            assert.match(messages, new RegExp(feeling));
            assert.equal(game._lastPlineMessage, feeling);
        });
    }
});
void test('a recent opposite feeling yields to the current alignment on re-entry', async () => {
    const priest = await tendedTemple({ type: 0, record: 0 }, true);
    assert.ok(priest.epri);
    // Peace is stale but the hostile cooldown is even fresher, so the switch
    // itself must force the peaceful message through (C's other_time check).
    priest.epri.peaceful_time = 90;
    priest.epri.hostile_time = 195;
    const messages = await enterTemple();
    assert.match(messages, /You experience an unusual sense of peace\./);
    assert.ok(priest.epri.peaceful_time > game.moves, 'the switch refreshes the peaceful cooldown');
});
void test('no feeling is repeated while both cooldowns still run', async () => {
    const priest = await tendedTemple({ type: 0, record: 0 }, true);
    assert.ok(priest.epri);
    priest.epri.peaceful_time = 10000;
    priest.epri.hostile_time = 9999;
    const messages = await enterTemple();
    assert.match(messages, /"Pilgrim, you enter a sacred place!"/);
    assert.doesNotMatch(messages, /forbidding feeling|sense of peace/);
});
//# sourceMappingURL=temple_entry_feelings.test.js.map