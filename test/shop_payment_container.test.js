import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { buyShopBillItem, itemizedShopBill } from '../js/shop_payment.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { withMessagePages } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';
for (const unpaidContainer of [false, true]) {
    void test(`buying contents of a ${unpaidContainer ? 'shop-owned' : 'no-charge'} floor sack clears ownership flags after feedback`, async () => {
        freshObjectRoom();
        const sack = await floorObject(SACK, 10, 10, {
            cknown: true,
            oextra: { oname: 'the long and winding road through the northern mountains to the distant sea' },
        });
        const dagger = await knownObject(DAGGER);
        await addCreatedObjectToContainer(sack, dagger);
        const { shopkeeper } = await createStaffedShop({ bill: [
                { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
                ...(unpaidContainer ? [{ bo_id: sack.o_id, bquan: 1, price: 2, useup: false }] : []),
            ] });
        sack.no_charge = !unpaidContainer;
        sack.unpaid = unpaidContainer;
        dagger.unpaid = true;
        setHeroGoldAmount(game, 20);
        const [purchase] = await itemizedShopBill(shopkeeper);
        assert.ok(purchase);
        const input = resetInputState();
        const buying = buyShopBillItem(shopkeeper, purchase);
        await input.waitUntilBlocked();
        try {
            assert.match(game._pending_message, /You bought .*sack.*gold pieces\./);
            assert.equal(shopkeeper.eshk.billct, 0, 'Contained purchases finish before their summary');
            assert.equal(dagger.unpaid, false);
            assert.equal(sack.unpaid, unpaidContainer, 'Feedback retains the container\'s prior ownership');
            assert.equal(sack.no_charge, true, 'Feedback suppresses the owned-container description');
        }
        finally {
            input.feed(' ');
            await buying;
        }
        assert.equal(sack.unpaid, false);
        assert.equal(sack.no_charge, false);
        assert.equal(sack.where, 'floor');
        await withMessagePages(() => pickupAtHero(), input, /sack|dagger/, 4);
        assert.ok(game.inventory.includes(sack));
        assert.equal(sack.unpaid, true, 'Later shop pickup bills the floor container');
        assert.ok(shopkeeper.eshk.bill.some(entry => entry.bo_id === sack.o_id));
    });
}
//# sourceMappingURL=shop_payment_container.test.js.map