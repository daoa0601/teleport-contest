// C shk.c:special_stock(): a deaf hero trying to sell the Candelabrum to a
// lighting-store keeper who is not Izchak sees the keeper shake it off
// with a gendered refusal, not a spoken rejection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CANDELABRUM_OF_INVOCATION } from '../js/object_data.js';
import { SHOPBASE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { sellHeroDroppedObject } from '../js/shop_sell.js';
import { knownObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a deaf hero selling the candelabrum to a non-Izchak lighter is refused in silence', async () => {
    freshObjectRoom({ left: 9, right: 13, top: 9, bottom: 11, role: 'caveman' });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({
        left: 9, right: 13, top: 9, bottom: 11,
        keeperX: 12, keeperY: 10, doorX: 9, doorY: 10,
        shopType: SHOPBASE + 11,
    });
    shopkeeper.eshk.shknam = '+Ada';
    resetInputState();
    game.u.deafTurns = 10;
    const candelabrum = await knownObject(CANDELABRUM_OF_INVOCATION);
    game.inventory.push(candelabrum);
    await sellHeroDroppedObject(candelabrum, 10, 10);
    assert.match(game._lastPlineMessage, /Ada shakes (his|her) head in refusal\./);
    assert.equal(candelabrum.no_charge, true, 'The refused candelabrum stays with the hero at no charge');
});
//# sourceMappingURL=shop_special_stock_refusal.test.js.map