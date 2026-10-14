import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { BAG_OF_TRICKS } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('apply releases a creature from a bag of tricks, using a charge and discovering the bag', async () => {
    const level = freshPlayableRoom();
    const bag = await addInventoryObject(BAG_OF_TRICKS, { spe: 2, typeKnown: false });
    await applyInventoryObject(bag, '       ');
    assert.ok(level.monsters.length > 0);
    assert.equal(bag.spe, 1);
    assert.equal(game.context.move, 1);
    assert.ok(game._knownObjectTypes?.has(BAG_OF_TRICKS));
});
void test('an identified empty bag of tricks becomes known empty when applied', async () => {
    freshPlayableRoom();
    const bag = await addInventoryObject(BAG_OF_TRICKS, { spe: 0, cknown: false });
    await applyInventoryObject(bag);
    assert.equal(bag.cknown, true);
    assert.equal(game._pending_message, 'Nothing happens.');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=bag_of_tricks_apply.test.js.map