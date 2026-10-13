import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { deleteObject } from '../js/object_delete.js';
import { DAGGER } from '../js/object_data.js';
import { buyShopBillItem, itemizedShopBill } from '../js/shop_payment.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

for (const portion of ['partly used', 'intact', 'fully used'] as const) {
    void test(`paying for ${portion} goods updates the bill after wrapped purchase feedback`, async () => {
        freshObjectRoom();
        const daggers = await addInventoryObject(DAGGER, {
            quan: 2, oextra: { oname: 'the long and winding road through the northern mountains to the distant sea' },
        });
        const billedQuantity = portion === 'partly used' ? 3 : 2;
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: daggers.o_id, bquan: billedQuantity, price: 4, useup: false },
        ] });
        daggers.unpaid = true;
        if (portion === 'fully used') await deleteObject(daggers);
        setHeroGoldAmount(game, 20);
        const [purchase] = itemizedShopBill(shopkeeper);
        assert.ok(purchase);
        const bill = shopkeeper.eshk.bill[0];
        assert.ok(bill);
        const input = resetInputState();

        const buying = buyShopBillItem(shopkeeper, purchase);
        await input.waitUntilBlocked();
        try {
            assert.match(game._pending_message, /You (?:paid for|bought).*gold pieces\./);
            assert.equal(heroGoldAmount(game), 20 - purchase.price, 'Gold transfers before purchase feedback');
            assert.equal(bill.bquan, billedQuantity, 'The bill retains its prior quantity during feedback');
            assert.equal(shopkeeper.eshk.billct, 1, 'The bill entry remains until feedback returns');
            if (portion === 'fully used') assert.equal(daggers.where, 'onbill');
            else assert.equal(daggers.unpaid, true);
        } finally {
            input.feed(' ');
            await buying;
        }

        if (portion === 'partly used') {
            assert.equal(bill.bquan, 2);
            assert.equal(shopkeeper.eshk.billct, 1);
            assert.equal(daggers.unpaid, true);
        } else {
            assert.equal(shopkeeper.eshk.billct, 0);
            assert.equal(daggers.unpaid, false);
            if (portion === 'fully used') assert.equal(daggers.where, 'gone');
        }
    });
}
