import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { DOOR, SHARED, SHOPBASE, STAIRS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { migrateMonsterOffLevel } from '../js/monster_migration.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { killGenocidedMonster } from '../js/mon.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { buryObject } from '../js/buried_object.js';
import { addObjectToContainer } from '../js/object_container.js';
import { deleteObject } from '../js/object_delete.js';
import { CHEST, DAGGER, POT_HEALING } from '../js/object_data.js';
import { addShopDamage } from '../js/shop_damage.js';
import { addShopObjectToBill, checkSpecialRoom } from '../js/shk.js';
import { itemizedShopBill } from '../js/shop_payment.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { freshConnectedLevels } from './support/connected-levels.js';

async function enterAt(x: number, y: number) {
    requirePlayingGame(game);
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    game.u.ux = x;
    game.u.uy = y;
    pushKeys('                    ');
    await checkSpecialRoom();
}

for (const cause of ['departure', 'environment', 'hero', 'genocide']) {
    void test(`${cause} removes a resident keeper's damage and settles the hero's purchases`, async () => {
        freshObjectRoom({ hero: { ux: 4, uy: 10 } });
        requirePlayingGame(game);
        const { room, roomno, shopkeeper } = await createStaffedShop({ keeperX: 12 });
        await enterAt(10, 10);
        const purchase = await floorObject(POT_HEALING, 10, 10);
        await addShopObjectToBill(purchase, game, { ininv: false, silent: true });
        assert.equal(purchase.unpaid, true);
        const owned = await floorObject(DAGGER, 11, 10, { no_charge: true });
        addShopDamage(13, 10, 20);
        assert.ok(game.level.damagelist != null, 'Expected game.level.damagelist to be initialized');
        assert.equal(game.level.damagelist.length, 1);
        pushKeys('                    ');

        switch (cause) {
        case 'departure':
            await removeMonsterFromGame(shopkeeper);
            break;
        case 'environment':
            shopkeeper.mhp = 0;
            await finishEnvironmentalMonsterDeath(shopkeeper, game, { noCorpse: true });
            break;
        case 'hero':
            await finishHeroMonsterKill(shopkeeper, shopkeeper.mx, shopkeeper.my,
                { noCorpse: true, showKillMessage: false });
            break;
        case 'genocide':
            await killGenocidedMonster(shopkeeper, game);
            break;
        }

        assert.equal(room.resident, null);
        assert.equal(game.level.damagelist.length, 0);
        assert.equal(!!purchase.unpaid, false);
        assert.equal(!!owned.no_charge, false);
        assert.equal((await itemizedShopBill(shopkeeper)).length, 0);
        assert.ok(!game.u.ushops.includes(roomno));
        assert.ok(room.rtype >= SHOPBASE);
        assert.equal(!!game.level.flags.has_shop, true);
    });
}

void test('a keeper leaving a different shop only clears shallow floor ownership there', async () => {
    freshObjectRoom({ right: 27, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const west = await createStaffedShop({ keeperX: 12 });
    const east = await createStaffedShop({ left: 18, right: 24, keeperX: 22 });
    await enterAt(20, 10);
    const used = await floorObject(POT_HEALING, 20, 10);
    await addShopObjectToBill(used, game, { ininv: false, silent: true });
    await deleteObject(used);
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, no_charge: true });
    const content = await knownObject(DAGGER, { no_charge: true });
    await addObjectToContainer(chest, content);
    const buried = await floorObject(DAGGER, 11, 10, { no_charge: true });
    await buryObject(buried);
    addShopDamage(13, 10, 20);
    addShopDamage(21, 10, 30);

    await removeMonsterFromGame(west.shopkeeper);

    assert.ok(game.level.damagelist != null, 'Expected game.level.damagelist to be initialized');
    assert.equal(game.level.damagelist.length, 1);
    assert.equal(game.level.damagelist[0]?.place.x, 21);
    assert.equal(!!chest.no_charge, false);
    assert.equal(!!content.no_charge, true);
    assert.equal(!!buried.no_charge, true);
    assert.equal(east.room.resident, east.shopkeeper);
    assert.ok((await itemizedShopBill(east.shopkeeper)).some(item => item.object === used));
});

void test('a shared shop boundary settles the departing keeper even when its room is not first', async () => {
    freshObjectRoom({ hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const west = await createStaffedShop({ left: 7, right: 10, keeperX: 9 });
    const east = await createStaffedShop({ left: 12, right: 15, keeperX: 14 });
    await enterAt(8, 10);
    const purchase = await floorObject(POT_HEALING, 8, 10);
    await addShopObjectToBill(purchase, game, { ininv: false, silent: true });
    const doorSquare = game.level.requireAt(11, 9);
    doorSquare.typ = DOOR;
    doorSquare.roomno = SHARED;
    doorSquare.edge = true;
    await enterAt(11, 9);

    await removeMonsterFromGame(west.shopkeeper);

    assert.equal(!!purchase.unpaid, false);
    assert.equal(west.room.resident, null);
    assert.equal(east.room.resident, east.shopkeeper);
    assert.deepEqual(game.u.ushops, [east.roomno]);
});

void test('a migrated keeper does not dismantle the same-numbered shop on another level', async () => {
    freshConnectedLevels();
    const foreign = await createStaffedShop({ keeperX: 13 });
    assert.ok(game.level != null, 'Expected game.level to be initialized');
    game.level.requireAt(10, 10).typ = STAIRS;
    await migrateMonsterOffLevel(foreign.shopkeeper, game, { dst: { dnum: 0, dlevel: 2 } });
    pushKeys('                    ');
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    assert.ok(game.level.monsters.includes(foreign.shopkeeper));
    const local = await createStaffedShop({ left: 18, right: 24, keeperX: 22 });
    assert.equal(local.roomno, foreign.roomno);
    await enterAt(20, 10);
    const owned = await floorObject(DAGGER, 21, 10, { no_charge: true });
    addShopDamage(19, 10, 20);

    await removeMonsterFromGame(foreign.shopkeeper);

    assert.equal(local.room.resident, local.shopkeeper);
    assert.equal(!!owned.no_charge, true);
    assert.ok(game.level.damagelist != null, 'Expected game.level.damagelist to be initialized');
    assert.equal(game.level.damagelist.length, 1);
    assert.deepEqual(game.u.ushops, [local.roomno]);
});
