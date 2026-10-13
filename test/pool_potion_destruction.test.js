import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { POT_HEALING } from '../js/object_data.js';
import { destroyMonsterInventoryByElement } from '../js/zap.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a visible shattered monster potion reveals its color without identifying its type', async () => {
    freshObjectRoom();
    const giant = await createMonsterAt('fire giant', 11, 10, NO_MINVENT);
    const potion = await knownObject(POT_HEALING, { dknown: false, known: false, typeKnown: false });
    await addObjectToMonsterInventory(giant, potion);
    const messages = [];
    await destroyMonsterInventoryByElement(giant, 'cold', 10, {
        visible: true, random: () => 0, rollOne: () => 2,
        publish: message => { messages.push(message); },
    });
    assert.equal(messages[0], `The fire giant's ${game.objectDescriptions?.[POT_HEALING]} potion freezes and shatters!`);
    assert.equal(potion.typeKnown, false);
    assert.equal(giant.minvent.includes(potion), false);
});
//# sourceMappingURL=pool_potion_destruction.test.js.map