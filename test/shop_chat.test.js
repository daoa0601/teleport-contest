import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
for (const situation of ['angry', 'following', 'wrong customer', 'bill', 'debt', 'credit', 'robbed', 'surcharge', 'ordinary']) {
    void test(`chatting with a shopkeeper describes ${situation}`, async () => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER);
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.female = true;
        const shop = shopkeeper.eshk;
        let expected;
        switch (situation) {
            case 'angry':
                shopkeeper.mpeaceful = 0;
                expected = /Ada mentions how much she dislikes rude customers\./;
                break;
            case 'following':
            case 'wrong customer':
                shop.following = 1;
                shop.customer = situation === 'following' ? game.plname : 'Pat';
                expected = situation === 'following' ? /Didn't you forget to pay\?/
                    : /I was looking for Pat\./;
                break;
            case 'bill':
                dagger.unpaid = true;
                shop.bill.push({ bo_id: dagger.o_id, bquan: 2, price: 4, useup: false });
                shop.billct = 1;
                shop.debit = 3;
                expected = /Ada says that your bill comes to 11 zorkmids\./;
                break;
            case 'debt':
                shop.debit = 3;
                expected = /Ada reminds you that you owe her 3 zorkmids\./;
                break;
            case 'credit':
                shop.credit = 17;
                expected = /Ada encourages you to use your 17 zorkmids of credit\./;
                break;
            case 'robbed':
                shop.robbed = 100;
                expected = /Ada complains about a recent robbery\./;
                break;
            case 'surcharge':
                shop.surcharge = true;
                expected = /Ada warns you that she is watching you carefully\./;
                break;
            case 'ordinary':
                expected = /Ada (complains that business is bad|talks about the problem of shoplifters)\./;
                break;
        }
        const input = resetInputState();
        input.feed('chat\nl');
        await withMessagePages(() => rhack('#'.charCodeAt(0)), input, expected, 1);
        assert.match(game._pending_message, expected);
        assert.equal(game.context.move, 1);
        if (situation === 'wrong customer')
            assert.equal(shop.following, 0);
    });
}
void test('a sleeping shopkeeper does not chat or spend a turn', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = 'Ada';
    shopkeeper.msleeping = 1;
    const input = resetInputState();
    input.feed('chat\nl');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, 'Ada seems not to notice you.');
    assert.equal(game.context.move, 0);
    assert.equal(shopkeeper.msleeping, 1);
});
//# sourceMappingURL=shop_chat.test.js.map