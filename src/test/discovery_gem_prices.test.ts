import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { POT_HEALING, SACK, WORTHLESS_PIECE_OF_WHITE_GLASS } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { learnObjectType, recordObjectKnowledge } from '../js/object_knowledge.js';
import { shopObjectUnitCost } from '../js/shk.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

void test('learning a glass gem reprices every billed stack of that type, including container contents', async () => {
    freshObjectRoom();
    const glass = await addInventoryObject(WORTHLESS_PIECE_OF_WHITE_GLASS, { typeKnown: false, dknown: true, unpaid: true });
    const potion = await addInventoryObject(POT_HEALING, { typeKnown: false, unpaid: true });
    const sack = await addInventoryObject(SACK);
    const contained = await knownObject(glass.otyp, { typeKnown: false, dknown: true, unpaid: true });
    await addObjectToContainer(sack, contained);
    const oldPrice = shopObjectUnitCost(glass);
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: glass.o_id, bquan: 1, price: oldPrice, useup: false },
        { bo_id: potion.o_id, bquan: 1, price: 77, useup: false },
        { bo_id: contained.o_id, bquan: 1, price: oldPrice, useup: false },
    ] });
    game.program_state.in_moveloop = true;

    learnObjectType(glass.otyp);

    assert.ok(oldPrice > shopObjectUnitCost(glass, shopkeeper));
    assert.equal(shopkeeper.eshk.bill[0]?.price, shopObjectUnitCost(glass, shopkeeper));
    assert.equal(shopkeeper.eshk.bill[1]?.price, 77);
    assert.equal(shopkeeper.eshk.bill[2]?.price, shopObjectUnitCost(contained, shopkeeper));
});

for (const phase of ['startup', 'gameover'] as const) {
    void test(`learning a gem during ${phase} leaves the shop bill alone`, async () => {
        freshObjectRoom();
        const glass = await addInventoryObject(WORTHLESS_PIECE_OF_WHITE_GLASS, { typeKnown: false, dknown: true, unpaid: true });
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: glass.o_id, bquan: 1, price: 177, useup: false },
        ] });
        game.program_state.in_moveloop = phase !== 'startup';
        game.program_state.gameover = phase === 'gameover';

        recordObjectKnowledge(glass.otyp);

        assert.equal(shopkeeper.eshk.bill[0]?.price, 177);
    });
}

