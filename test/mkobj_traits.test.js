import test from 'node:test';
import assert from 'node:assert/strict';
import { mkcorpstat } from '../js/mkobj.js';
import { CORPSE } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
void test('a drained troll corpse retains enough maximum HP for its base species level', async () => {
    await freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    troll.m_lev = 0;
    troll.mhpmax = 1;
    troll.mhp = -3;
    const corpse = await mkcorpstat(CORPSE, troll, null, 12, 10, 0);
    assert.equal(corpse.oextra?.omonst?.mhpmax, 8);
    assert.equal(corpse.oextra?.omonst?.mhp, 0);
});
void test('saving a high-level troll preserves an already viable HP maximum', async () => {
    await freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    troll.m_lev = 20;
    troll.mhpmax = 10;
    troll.mhp = 0;
    const corpse = await mkcorpstat(CORPSE, troll, null, 12, 10, 0);
    assert.equal(corpse.oextra?.omonst?.mhpmax, 10);
});
void test('saving a corpse preserves its bones alignment when the original history changes', async () => {
    await freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    const history = {
        parentmid: troll.m_id, role: 0, race: 0,
        oldalign: { type: 0, record: 4 },
        deathlevel: 7, luck: 0, mnum: troll.mnum,
        female: false, demigod: false, crowned: false,
    };
    troll.mextra = { ...troll.mextra, ebones: history };
    const corpse = await mkcorpstat(CORPSE, troll, null, 12, 10, 0);
    history.oldalign.record = -2;
    assert.equal(corpse.oextra?.omonst?.mextra?.ebones?.oldalign.record, 4, 'the corpse must retain the alignment recorded when its traits were saved');
});
//# sourceMappingURL=mkobj_traits.test.js.map