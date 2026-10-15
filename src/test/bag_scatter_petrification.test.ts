import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BAG_OF_HOLDING, EGG, STATUE, WAN_CANCELLATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an egg scattered by an exploding bag petrifies a monster without crediting the hero', async () => {
    const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const soldier = await createMonsterAt('soldier', 11, 11);
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cknown: true,
    });
    const egg = await knownObject(EGG, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'),
        where: 'contained', container: bag,
    });
    bag.contents = [egg];
    await addInventoryObject(WAN_CANCELLATION, {
        invlet: 'b', initialize: false, spe: 1,
    });
    initRng(266n);

    await applyInventoryObject(bag, 'sb\n' + ' '.repeat(30));

    assert.equal(bag.where, 'gone');
    assert.equal(soldier.dead, true);
    assert.ok(level.objects[11]?.[11]?.some(object =>
        object.otyp === STATUE && object.corpsenm === soldier.mnum),
    'The egg leaves a statue of the monster it petrifies.');
    assert.equal(game.u.uexp, 0, 'Petrification from a scattered egg awards no experience.');
    assert.equal(game.u.uconduct?.killer ?? 0, 0, 'The hero keeps pacifist conduct.');
});
