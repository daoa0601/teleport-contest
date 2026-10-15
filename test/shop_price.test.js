import { createStaffedShop } from './support/shop.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CHA, HUNGRY, WEAK } from '../js/const.js';
import { game } from '../js/gstate.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { shopObjectUnitCost } from '../js/shk.js';
import { splitObjectStack } from '../js/object_stack.js';
import { saveGame, restoreGame } from '../js/save.js';
import { FOOD_RATION, LONG_SWORD, SCR_IDENTIFY, WAN_FIRE, WORTHLESS_PIECE_OF_RED_GLASS, } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
function normalCustomer() {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_CHA] = game.u.amax.a[A_CHA] = 12;
}
void test('food purchase quotes rise with hunger while a spent wand costs the minimum', async () => {
    normalCustomer();
    requirePlayingGame(game);
    const ration = await knownObject(FOOD_RATION);
    game.u.uhs = 1;
    assert.equal(shopObjectUnitCost(ration), 45);
    game.u.uhs = HUNGRY;
    assert.equal(shopObjectUnitCost(ration), 90);
    game.u.uhs = WEAK;
    assert.equal(shopObjectUnitCost(ration), 135);
    const wand = await knownObject(WAN_FIRE, { spe: -1 });
    assert.equal(shopObjectUnitCost(wand), 5);
});
void test('artifact purchase prices include the artifact premium before the anger surcharge', async () => {
    normalCustomer();
    requirePlayingGame(game);
    const sword = await knownObject(LONG_SWORD, { spe: 0 });
    nameArtifact(sword, artifactByName('Excalibur'));
    assert.equal(shopObjectUnitCost(sword), 16000);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.surcharge = true;
    assert.equal(shopObjectUnitCost(sword, shopkeeper), 21334);
});
void test('unidentified red glass has a stable jasper or ruby quote set by the game birthday', async () => {
    normalCustomer();
    requirePlayingGame(game);
    const gem = await knownObject(WORTHLESS_PIECE_OF_RED_GLASS, { dknown: false });
    const start = Date.UTC(2025, 0, 1) / 1000;
    game.ubirthday = start - start % gem.otyp;
    assert.equal(shopObjectUnitCost(gem), 500);
    game.ubirthday += Math.trunc(gem.otyp / 2);
    assert.equal(shopObjectUnitCost(gem), 3500);
    gem.dknown = true;
    assert.equal(shopObjectUnitCost(gem), 5);
});
void test('saving and restoring preserves an unidentified glass quote when the clock changes', async (context) => {
    const now = Date.UTC(2025, 0, 10, 17);
    context.mock.timers.enable({ apis: ['Date'], now });
    normalCustomer();
    requirePlayingGame(game);
    game.plname = 'Gem customer';
    const gem = await knownObject(WORTHLESS_PIECE_OF_RED_GLASS, {
        dknown: false, invlet: 'a', where: 'inventory',
    });
    game.inventory.push(gem);
    const start = Date.UTC(2025, 0, 1) / 1000;
    game.ubirthday = start - start % gem.otyp + Math.trunc(gem.otyp / 2);
    const price = shopObjectUnitCost(gem);
    assert.equal(price, 3500);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    context.mock.timers.setTime(now + 3600 * 1000);
    assert.equal(restoreGame('Gem customer', storage), true);
    const restoredGem = game.inventory.find(object => object.invlet === 'a');
    assert.ok(restoredGem);
    assert.equal(shopObjectUnitCost(restoredGem), price);
});
void test('splitting an unidentified stack preserves its quoted unit price', async () => {
    normalCustomer();
    requirePlayingGame(game);
    const prices = new Set();
    for (let i = 0; i < 16; i++) {
        const stack = await knownObject(SCR_IDENTIFY, {
            quan: 3, dknown: false, typeKnown: false,
        });
        const price = shopObjectUnitCost(stack);
        prices.add(price);
        const split = splitObjectStack(stack, 1);
        assert.ok(split);
        assert.equal(shopObjectUnitCost(stack), price);
        assert.equal(shopObjectUnitCost(split), price);
    }
    assert.ok(prices.size > 1, 'the examples include different unknown-item quotes');
});
//# sourceMappingURL=shop_price.test.js.map