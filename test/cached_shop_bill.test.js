import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { consumeInventoryItem } from '../js/invent.js';
import { gotoLevel } from '../js/level_change.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { APPLE, FOOD_RATION } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { setPaidShopkeeper } from '../js/shop_damage.js';
import { itemizedShopBill } from '../js/shop_payment.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createStaffedShop } from './support/shop.js';
for (const saveWhileAway of [false, true]) {
    void test(`settling another floor's shop preserves a cached used-up purchase${saveWhileAway ? ' across a save' : ''}`, async () => {
        freshConnectedLevels();
        requirePlayingGame(game);
        game.flags.verbose = false;
        const first = await createStaffedShop({ keeperX: 13, keeperY: 10 });
        const ration = await addInventoryObject(FOOD_RATION, { unpaid: true });
        first.shopkeeper.eshk.bill.push({ bo_id: ration.o_id, bquan: 1, price: 45, useup: false });
        first.shopkeeper.eshk.billct++;
        await consumeInventoryItem(ration);
        assert.equal((await itemizedShopBill(first.shopkeeper))[0]?.kind, 'used');
        // An absent keeper cannot settle the old debt as a robbery on exit.
        placeMonsterAt(first.shopkeeper, 16, 10);
        await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
        const second = await createStaffedShop({ keeperX: 13, keeperY: 10 });
        const apple = await addInventoryObject(APPLE, { unpaid: true });
        second.shopkeeper.eshk.bill.push({ bo_id: apple.o_id, bquan: 1, price: 7, useup: false });
        second.shopkeeper.eshk.billct++;
        await consumeInventoryItem(apple);
        setPaidShopkeeper(second.shopkeeper);
        if (saveWhileAway) {
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            assert.equal(restoreGame(game.plname, storage), true);
        }
        await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
        const keeper = requireGameLevel().monsters.find(monster => monster.m_id === first.shopkeeper.m_id);
        assert.ok(keeper);
        const bill = await itemizedShopBill(keeper);
        assert.equal(bill.length, 1, 'The original used-up purchase must still be payable');
        assert.equal(bill[0]?.object.otyp, FOOD_RATION);
        assert.equal(bill[0]?.kind, 'used');
        assert.equal(bill[0]?.price, 45);
    });
}
//# sourceMappingURL=cached_shop_bill.test.js.map