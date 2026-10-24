import assert from 'node:assert/strict';
import test from 'node:test';
import { plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { deleteObject } from '../js/object_delete.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { buyShopBillItem, itemizedShopBill } from '../js/shop_payment.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
for (const portion of ['partly used', 'intact', 'fully used']) {
    void test(`paying for ${portion} goods keeps the payment quantity until wrapped feedback finishes`, async () => {
        freshObjectRoom();
        const daggers = await addInventoryObject(DAGGER, {
            quan: 2, oextra: { oname: 'the long and winding road through the northern mountains to the distant sea' },
        });
        const billedQuantity = portion === 'partly used' ? 3 : 2;
        const { shopkeeper } = await createStaffedShop({ bill: [
                { bo_id: daggers.o_id, bquan: billedQuantity, price: 4, useup: false },
            ] });
        daggers.unpaid = true;
        if (portion === 'fully used')
            await deleteObject(daggers);
        setHeroGoldAmount(game, 20);
        const [purchase] = await itemizedShopBill(shopkeeper);
        assert.ok(purchase);
        const bill = shopkeeper.eshk.bill[0];
        assert.ok(bill);
        const input = resetInputState();
        const buying = buyShopBillItem(shopkeeper, purchase);
        await input.waitUntilBlocked();
        try {
            assert.match(game._pending_message, /You (?:paid for|bought).*gold pieces\./);
            assert.equal(daggers.quan, purchase.quantity, 'Feedback refers to the quantity being paid for');
            assert.equal(heroGoldAmount(game), 20 - purchase.price, 'Gold transfers before purchase feedback');
            assert.equal(bill.bquan, billedQuantity, 'The bill retains its prior quantity during feedback');
            assert.equal(shopkeeper.eshk.billct, 1, 'The bill entry remains until feedback returns');
            if (portion === 'fully used')
                assert.equal(daggers.where, 'onbill');
            else
                assert.equal(daggers.unpaid, true);
        }
        finally {
            input.feed(' ');
            await buying;
        }
        assert.equal(daggers.quan, 2, 'The original quantity returns after feedback');
        if (portion === 'partly used') {
            assert.equal(bill.bquan, 2);
            assert.equal(shopkeeper.eshk.billct, 1);
            assert.equal(daggers.unpaid, true);
        }
        else {
            assert.equal(shopkeeper.eshk.billct, 0);
            assert.equal(daggers.unpaid, false);
            if (portion === 'fully used')
                assert.equal(daggers.where, 'gone');
        }
    });
}
void test('an unaffordable used portion keeps its quantity until payment feedback returns', async () => {
    freshObjectRoom();
    const daggers = await addInventoryObject(DAGGER, {
        quan: 3, oextra: { oname: 'the long and winding road through the northern mountains to the distant sea' },
    });
    const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: daggers.o_id, bquan: 5, price: 4, useup: false },
        ] });
    daggers.unpaid = true;
    setHeroGoldAmount(game, 4);
    const purchase = (await itemizedShopBill(shopkeeper)).find(item => item.kind === 'used');
    assert.ok(purchase);
    const input = resetInputState();
    const buying = buyShopBillItem(shopkeeper, purchase);
    await input.waitUntilBlocked();
    try {
        assert.match(game._pending_message, /enough to pay for 2 .*daggers/);
        assert.equal(daggers.quan, 2, 'The refusal refers to the two used daggers');
        assert.equal(heroGoldAmount(game), 4);
        assert.equal(shopkeeper.eshk.bill[0]?.bquan, 5);
        assert.equal(daggers.unpaid, true);
    }
    finally {
        input.feed(' ');
        await buying;
    }
    assert.equal(await buying, 'stop');
    assert.equal(daggers.quan, 3, 'The intact quantity returns after feedback');
    assert.equal(shopkeeper.eshk.billct, 1);
});
for (const contained of [false, true]) {
    for (const deaf of [false, true]) {
        void test(`a ${deaf ? 'gestured' : 'spoken'} refusal to buy ${contained ? 'contained' : 'loose'} partly used goods keeps the used quantity through the pager`, async () => {
            freshObjectRoom();
            const sack = contained ? await addInventoryObject(SACK, { cknown: true }) : null;
            const daggers = sack ? await knownObject(DAGGER, { quan: 3 })
                : await addInventoryObject(DAGGER, { quan: 3 });
            if (sack)
                await addCreatedObjectToContainer(sack, daggers);
            const { shopkeeper } = await createStaffedShop({ bill: [
                    { bo_id: daggers.o_id, bquan: 5, price: 4, useup: false },
                ] });
            shopkeeper.eshk.shknam = 'Ada';
            game.u.deafTurns = deaf ? 20 : 0;
            daggers.unpaid = true;
            setHeroGoldAmount(game, 20);
            const purchase = (await itemizedShopBill(shopkeeper)).find(item => item.kind !== 'used');
            assert.ok(purchase);
            const input = resetInputState();
            await plineWithContinuation('You look over your purchases.');
            const buying = buyShopBillItem(shopkeeper, purchase);
            await input.waitUntilBlocked();
            try {
                assert.equal(daggers.quan, 2, 'The rejection refers to the used portion while earlier prose is paged');
                assert.equal(heroGoldAmount(game), 20);
                assert.equal(shopkeeper.eshk.bill[0]?.bquan, 5);
                assert.equal(daggers.unpaid, true);
            }
            finally {
                input.feed(' ');
                await buying;
            }
            assert.equal(await buying, contained ? 'stop' : 'skip');
            assert.match(game._pending_message, deaf ? /Ada points out your bill for the other daggers first\./
                : contained ? /Please pay for the other daggers before buying the ones in the sack\./
                    : /Please pay for the other daggers before buying these\./);
            assert.equal(daggers.quan, 3, 'The intact quantity returns after rejection feedback');
            assert.equal(shopkeeper.eshk.billct, 1);
        });
    }
}
//# sourceMappingURL=shop_payment_feedback.test.js.map