import assert from 'node:assert/strict';
import test from 'node:test';
import { A_CHA } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { callObjectType } from '../js/object_call.js';
import { POT_HEALING, WORTHLESS_PIECE_OF_WHITE_GLASS } from '../js/object_data.js';
import { recordObjectCall, recordObjectKnowledge } from '../js/object_knowledge.js';
import { shopObjectUnitCost } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('erasing an unencountered gem call name removes its discovery and refreshes the billed price', async () => {
    freshObjectRoom({ hero: { blindTurns: 20 } });
    const glass = await addInventoryObject(WORTHLESS_PIECE_OF_WHITE_GLASS, { typeKnown: false, observed: false, dknown: true, unpaid: true });
    recordObjectCall(glass.otyp, 'shiny');
    recordObjectKnowledge(POT_HEALING);
    assert.ok(game.u.acurr);
    game.u.acurr.a[A_CHA] = 18;
    const oldPrice = shopObjectUnitCost(glass);
    const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: glass.o_id, bquan: 1, price: oldPrice, useup: false },
        ] });
    game.u.acurr.a[A_CHA] = 12;
    resetInputState().feed('   \r');
    await callObjectType(glass);
    assert.equal(game._objectCallNames?.[glass.otyp], undefined);
    assert.equal(game._objectDiscoveryOrder?.includes(glass.otyp), false);
    assert.equal(game._objectDiscoveryOrder?.includes(POT_HEALING), true);
    assert.notEqual(oldPrice, shopObjectUnitCost(glass, shopkeeper));
    assert.equal(shopkeeper.eshk.bill[0]?.price, shopObjectUnitCost(glass, shopkeeper));
});
//# sourceMappingURL=discovery_uncall.test.js.map