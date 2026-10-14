import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorpstatAt } from '../js/mklev.js';
import { CORPSE } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';

void test('a drained troll corpse retains enough maximum HP for its base species level', async () => {
    freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    troll.m_lev = 0;
    troll.mhpmax = 1;
    troll.mhp = -3;

    const corpse = await createCorpstatAt(CORPSE, troll, null, 12, 10, 0);

    assert.equal(corpse.oextra?.omonst?.mhpmax, 8);
    assert.equal(corpse.oextra?.omonst?.mhp, 0);
});

void test('saving a high-level troll preserves an already viable HP maximum', async () => {
    freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    troll.m_lev = 20;
    troll.mhpmax = 10;
    troll.mhp = 0;

    const corpse = await createCorpstatAt(CORPSE, troll, null, 12, 10, 0);

    assert.equal(corpse.oextra?.omonst?.mhpmax, 10);
});
