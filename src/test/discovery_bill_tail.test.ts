import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { POT_HEALING, WORTHLESS_PIECE_OF_WHITE_GLASS } from '../js/object_data.js';
import { learnObjectType } from '../js/object_knowledge.js';
import { moveUsedObjectToBill, shopObjectUnitCost } from '../js/shk.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

void test('gem repricing stops at a used-up bill item as the native bill traversal does', async () => {
    freshObjectRoom();
    const usedPotion = await knownObject(POT_HEALING, { typeKnown: false, unpaid: true });
    const glass = await addInventoryObject(WORTHLESS_PIECE_OF_WHITE_GLASS, { typeKnown: false, unpaid: true });
    const oldPrice = shopObjectUnitCost(glass);
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: usedPotion.o_id, bquan: 1, price: 77, useup: false },
        { bo_id: glass.o_id, bquan: 1, price: oldPrice, useup: false },
    ] });
    assert.ok(moveUsedObjectToBill(usedPotion));
    game.program_state.in_moveloop = true;

    learnObjectType(glass.otyp);

    assert.ok(oldPrice > shopObjectUnitCost(glass, shopkeeper));
    assert.equal(shopkeeper.eshk.bill[1]?.price, oldPrice,
        'native gem_learned does not advance to later entries when find_oid cannot find the used-up item');
});
