import { updateRestoredFloorShopOwnership } from '../js/restore.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, SHARED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { costlySpot, shopkeeperInOwnShop } from '../js/shk.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
async function adjacentShops() {
    await freshObjectRoom();
    requirePlayingGame(game);
    const west = await createStaffedShop({
        left: 7, right: 10, top: 8, bottom: 12, keeperX: 9, keeperY: 10,
    });
    const east = await createStaffedShop({
        left: 12, right: 15, top: 8, bottom: 12, keeperX: 13, keeperY: 10,
    });
    for (const y of [9, 11]) {
        const doorSquare = game.level.requireAt(11, y);
        doorSquare.typ = DOOR;
        doorSquare.roomno = SHARED;
        doorSquare.edge = true;
    }
    west.shopkeeper.mx = 11;
    west.shopkeeper.my = 9;
    east.shopkeeper.mx = 11;
    east.shopkeeper.my = 11;
    return { west, east };
}
void test('each keeper on a shared boundary still owns stock in their own shop', async () => {
    const { west, east } = await adjacentShops();
    requirePlayingGame(game);
    assert.equal(shopkeeperInOwnShop(west.shopkeeper), true);
    assert.equal(shopkeeperInOwnShop(east.shopkeeper), true);
    assert.equal(costlySpot(8, 10)?.resident, west.shopkeeper);
    assert.equal(costlySpot(14, 10)?.resident, east.shopkeeper);
    assert.equal(costlySpot(11, 9), null);
    assert.equal(costlySpot(11, 11), null);
});
void test('the keeper home square is free and an absent keeper cannot own costly stock', async () => {
    const { west, east } = await adjacentShops();
    requirePlayingGame(game);
    assert.equal(costlySpot(9, 10), null);
    assert.equal(costlySpot(13, 10), null);
    west.shopkeeper.mx = 5;
    west.shopkeeper.my = 5;
    assert.equal(shopkeeperInOwnShop(west.shopkeeper), false);
    assert.equal(costlySpot(8, 10), null);
    assert.equal(costlySpot(14, 10)?.resident, east.shopkeeper);
});
void test('restored owned objects keep their exemption until shop residency is ready', async () => {
    await freshObjectRoom();
    game.level_status.shkready = false;
    const dagger = await floorObject(DAGGER, 10, 10, { initialize: false, no_charge: true });
    assert.equal(dagger.no_charge, true, 'Loading must not clear ownership against incomplete shops');
    game.level_status.shkready = true;
    updateRestoredFloorShopOwnership();
    assert.equal(dagger.no_charge, false, 'An object outside all restored shops has no exemption');
});
//# sourceMappingURL=shop_boundaries.test.js.map