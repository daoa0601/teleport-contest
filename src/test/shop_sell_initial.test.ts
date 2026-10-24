import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePlayingGame, game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { DAGGER } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { sellHeroDroppedObject, shopOfferForObject } from '../js/shop_sell.js';
import { floorObject } from './support/game-objects.js';
import { planInput } from './support/planned-input.js';
import { createStaffedShop, setShopkeeperGold } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';

// Kept apart from shop_sell.test.ts: this file's process must not have run a
// deliberate drop before the accidental one.
void test('an accidental drop before any deliberate drop sells without a query', async t => {
    freshObjectRoom({ left: 9, right: 13, top: 9, bottom: 11, role: 'caveman' });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({
        left: 9, right: 13, top: 9, bottom: 11, keeperX: 12, keeperY: 10, doorX: 9, doorY: 10,
    });
    await setShopkeeperGold(shopkeeper, 1000);
    setHeroGoldAmount(game, 0);
    planInput(resetInputState(), t, []);
    const dagger = await floorObject(DAGGER, 10, 10);

    assert.equal((await sellHeroDroppedObject(dagger, 10, 10)).sold, true);
    assert.equal(heroGoldAmount(game), shopOfferForObject(dagger, shopkeeper));
    assert.match(game._lastPlineMessage, /relinquish .*dagger and receive 2 gold pieces in compensation\./);
});
