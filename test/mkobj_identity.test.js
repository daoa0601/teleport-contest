import test from 'node:test';
import assert from 'node:assert/strict';
import { mkgold, mksobj, set_corpsenm } from '../js/mkobj.js';
import { EGG, GOLD_PIECE, ICE_BOX } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { game } from '../js/gstate.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { freshObjectRoom } from './support/object-room.js';
// C mkobj.c:mkgold() grows an existing floor stack in place.
void test('adding gold preserves the floor stack identity and updates its weight', async () => {
    const level = await freshObjectRoom();
    const original = await mkgold(125, 12, 10);
    const gold = await mkgold(100, 12, 10);
    assert.equal(gold, original);
    assert.equal(gold.quan, 225);
    assert.equal(gold.owt, 2);
    assert.equal(level.objects[12]?.[10]?.filter(object => object.otyp === GOLD_PIECE).length, 1);
});
// C mkobj.c:mkbox_cnts() freezes each corpse before add_to_container().
void test('ice-box contents retain their container identity and stop decaying', async () => {
    await freshObjectRoom({ gameplaySeed: 511n });
    let stored = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
        const box = await mksobj(ICE_BOX, true, false);
        for (const corpse of box.contents ?? []) {
            stored++;
            assert.equal(corpse.container, box);
            assert.equal(corpse.where, 'contained');
            assert.equal(corpse.age, 0);
            assert.equal(objectTimers(corpse).length, 0);
        }
    }
    assert.ok(stored > 0, 'generated ice boxes should exercise stored corpses');
});
// C mkobj.c:set_corpsenm() retains an egg's remaining hatch time.
void test('changing an egg species preserves its scheduled hatch turn', async () => {
    await freshObjectRoom();
    const egg = await mksobj(EGG, false, false);
    set_corpsenm(egg, MONSTER_NAME.indexOf('cockatrice'));
    const initialTimer = objectTimers(egg).find(timer => timer.kind === OBJECT_TIMER_KIND.HATCH_EGG);
    assert.ok(initialTimer, 'a cockatrice egg should have a hatch timer');
    const deadline = initialTimer.deadline;
    game.moves += 20;
    set_corpsenm(egg, MONSTER_NAME.indexOf('chickatrice'));
    const timers = objectTimers(egg);
    assert.equal(timers.length, 1);
    assert.equal(timers[0]?.kind, OBJECT_TIMER_KIND.HATCH_EGG);
    assert.equal(timers[0]?.deadline, deadline);
});
//# sourceMappingURL=mkobj_identity.test.js.map