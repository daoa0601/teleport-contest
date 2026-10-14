import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DAGGER } from '../js/object_data.js';
import { settleShopkeepersOnExit, finishShopkeeperRepossession } from '../js/shop_settlement.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('the newest hostile shopkeeper claims possessions first when the hero quits outside all shops', async () => {
    freshObjectRoom({ left: 3, right: 30, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const earlier = await createStaffedShop();
    const later = await createStaffedShop({ left: 20, right: 25, keeperX: 21, doorX: 19 });
    earlier.shopkeeper.mpeaceful = later.shopkeeper.mpeaceful = 0;
    const dagger = await addInventoryObject(DAGGER);
    game.program_state.gameover = true;
    assert.equal(await settleShopkeepersOnExit('quit', { silent: true }), true);
    await finishShopkeeperRepossession();
    if (dagger.where === 'minvent') {
        assert.equal(dagger.ocarry?.m_id, later.shopkeeper.m_id);
    }
    else {
        assert.equal(dagger.where, 'floor');
        assert.equal(dagger.ox, 22);
        assert.equal(dagger.oy, 10);
    }
});
//# sourceMappingURL=shop_settlement_order.test.js.map