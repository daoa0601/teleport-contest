import assert from 'node:assert/strict';
import test, {} from 'node:test';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { gotoLevel } from '../js/do.js';
import { pricedFloorObjectDescription } from '../js/invent.js';
import { POT_CONFUSION } from '../js/object_data.js';
import { saveGame } from '../js/save.js';
import { restoreGame } from '../js/restore.js';
import { SELL_DELIBERATE, sellHeroDroppedObject, setSellDisposition } from '../js/shk.js';
import { planInput } from './support/planned-input.js';
import { resetInputState } from '../js/input.js';
import { floorObject } from './support/game-objects.js';
import { createStaffedShop, setShopkeeperGold } from './support/shop.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
const SHOP = { left: 9, right: 13, top: 9, bottom: 11 };
// A staffed shop whose hero refuses to sell a dropped potion: the refusal
// marks the drop no_charge ("an uncursed potion of confusion (no charge)").
async function refusedDropInShop(t) {
    freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const { shopkeeper } = await createStaffedShop({
        ...SHOP, keeperX: 12, keeperY: 10, doorX: 9, doorY: 10,
    });
    await setShopkeeperGold(shopkeeper, 1000);
    setSellDisposition(SELL_DELIBERATE);
    planInput(resetInputState(), t, [{ prompt: /Sell (?:it|them)\?/, keys: 'n' }]);
    const potion = await floorObject(POT_CONFUSION, 10, 9);
    const outcome = await sellHeroDroppedObject(potion, 10, 9);
    assert.equal(outcome.sold, false);
    assert.equal(potion.no_charge, true);
    assert.match(await pricedFloorObjectDescription(potion), /\(no charge\)$/);
}
void test('restoring a save turns a refused no-charge drop back into shop stock', async (t) => {
    await refusedDropInShop(t);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame(game.plname, storage), true);
    const level = requireGameLevel();
    const potion = level.objects[10]?.[9]?.find(object => object.otyp === POT_CONFUSION);
    assert.ok(potion, 'the dropped potion must still be on the restored shop floor');
    // C restore.c:find_lev_obj() re-places every floor object while
    // rooms[].resident is still unlatched, so mkobj.c:place_object() clears
    // no_charge: the refused drop is shop stock again, priced for sale.
    assert.equal(potion.no_charge, false);
    assert.match(await pricedFloorObjectDescription(potion), /\(for sale, \d+ zorkmids\)$/);
});
void test('returning to a level turns a refused no-charge drop back into shop stock', async (t) => {
    await refusedDropInShop(t);
    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
    const level = requireGameLevel();
    const potion = level.objects[10]?.[9]?.find(object => object.otyp === POT_CONFUSION);
    assert.ok(potion, 'the dropped potion must still be on the reloaded shop floor');
    assert.equal(potion.no_charge, false);
    assert.match(await pricedFloorObjectDescription(potion), /\(for sale, \d+ zorkmids\)$/);
});
//# sourceMappingURL=restore_shop_no_charge.test.js.map