import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BAG_OF_HOLDING, CHEST, CLUB, WAN_CANCELLATION } from '../js/object_data.js';
import { addShopObjectToBill } from '../js/shk.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
void test('a floor bag explosion names the returned trigger before quoting the bag price', async () => {
    freshPlayableRoom();
    game.u.uhp = game.u.uhpmax = 100;
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const bag = await floorObject(BAG_OF_HOLDING, 10, 10, {
        initialize: false, olocked: false, cknown: true,
    });
    const wand = await addInventoryObject(WAN_CANCELLATION, { invlet: 'a', spe: 1 });
    await addShopObjectToBill(wand, game, { silent: true });
    assert.equal(wand.unpaid, true);
    const input = resetInputState();
    const looting = runExtendedCommand('loot', 'sa');
    await input.waitUntilBlocked();
    const explosionMessage = game._pending_message;
    input.feed(' '.repeat(10));
    await looting;
    assert.match(explosionMessage, /^As you put .*wand.*magical explosion!$/);
    assert.doesNotMatch(explosionMessage, /unpaid/);
    assert.match(game._lastPlineMessage, /^The bag(?: of holding)? will cost you \d+ zorkmids\.$/);
    assert.equal(bag.where, 'onbill');
    assert.equal(wand.where, 'onbill');
    const debt = shopkeeper.eshk.bill.find(entry => entry.bo_id === wand.o_id);
    assert.ok(debt, 'The destroyed trigger must remain on the shop bill.');
    assert.equal(debt.useup, true);
});
void test('looting shop merchandise from a floor chest bills it before acquisition', async () => {
    freshPlayableRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    await runExtendedCommand('loot', 'oa\n    ');
    assert.equal(game.inventory.includes(club), true);
    assert.equal(club.unpaid, true);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(shopkeeper.eshk.bill[0]?.bo_id, club.o_id);
});
void test('returning looted merchandise to a shop floor chest clears its bill', async () => {
    freshPlayableRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    await runExtendedCommand('loot', 'oa\n    ');
    assert.equal(club.unpaid, true);
    await runExtendedCommand('loot', `s${club.invlet}\n    `);
    assert.equal(chest.contents.includes(club), true);
    assert.equal(club.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
});
//# sourceMappingURL=container_shop_transfer.test.js.map