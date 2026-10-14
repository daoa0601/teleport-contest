import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorpstatAt } from '../js/mklev.js';
import { CORPSE } from '../js/object_data.js';
import { splitObjectStack } from '../js/object_stack.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
void test('split corpse stacks retain independent monster traits for revival', async () => {
    freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    troll.name = 'First';
    const corpse = await createCorpstatAt(CORPSE, troll, null, 12, 10, 0);
    corpse.quan = 2;
    const split = splitObjectStack(corpse, 1);
    const splitTraits = split?.oextra?.omonst;
    assert.ok(splitTraits);
    splitTraits.name = 'Second';
    assert.equal(corpse.oextra?.omonst?.name, 'First');
});
//# sourceMappingURL=mkobj_split_traits.test.js.map