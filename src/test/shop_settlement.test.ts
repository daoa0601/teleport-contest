import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { setHeroGoldAmount, heroGoldAmount } from '../js/hero_gold.js';
import { deleteObject } from '../js/object_delete.js';
import { unlinkObject } from '../js/object_location.js';
import { addObjectToContainer } from '../js/object_container.js';
import { buryObject } from '../js/buried_object.js';
import { CHEST, DAGGER, POT_HEALING } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import {
    addShopObjectToBill, carriedShopBill, checkSpecialRoom, settleCarriedShopBillItem,
} from '../js/shk.js';
import { settleShopkeepersOnExit } from '../js/shop_settlement.js';
import { setPaidShopkeeper } from '../js/shop_damage.js';
import { roomForRoomno } from '../js/room.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { memoryStorage } from './support/memory-storage.js';



async function twoShops() {
    freshObjectRoom({ right: 27 });
    requirePlayingGame(game);
    const west = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    const east = await createStaffedShop({
        left: 18, right: 24, keeperX: 22, keeperY: 10,
    });
    return { west, east };
}

async function billStock(shop: Awaited<ReturnType<typeof createStaffedShop>>, type = POT_HEALING) {
    requirePlayingGame(game);
    // Outstanding bills can coexist while a keeper is temporarily away.
    // Leaving a tended shop would settle its bill as a robbery before the
    // settlement operation under test, including freeing used-up identities.
    const level = game.level;
    const absentKeepers = game.u.ushops.filter(roomno => roomno !== shop.roomno)
        .map(roomno => roomForRoomno(level, roomno)?.resident)
        .filter(keeper => keeper !== null && keeper !== undefined)
        .map(keeper => ({ keeper, x: keeper.mx, y: keeper.my }));
    for (const { keeper } of absentKeepers) placeMonsterAt(keeper, 7, 6);
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    game.u.ux = shop.room.lx + 1;
    game.u.uy = 10;
    try {
        await checkSpecialRoom();
    } finally {
        for (const { keeper, x, y } of absentKeepers) placeMonsterAt(keeper, x, y);
    }
    const object = await floorObject(type, game.u.ux, game.u.uy);
    await addShopObjectToBill(object, game, { ininv: false, silent: true });
    assert.equal(object.unpaid, true);
    return object;
}

void test('settlement frees all used-up bill objects but leaves a rival live debt unpaid', async () => {
    const { west, east } = await twoShops();
    requirePlayingGame(game);
    const usedWest = await billStock(west);
    await deleteObject(usedWest);
    const usedEast = await billStock(east);
    await deleteObject(usedEast);
    const liveEast = await billStock(east, DAGGER);
    west.shopkeeper.eshk.credit = 7;
    west.shopkeeper.eshk.debit = 13;
    west.shopkeeper.eshk.loan = 5;
    const rivalDebt = east.shopkeeper.eshk.bill.length;

    setPaidShopkeeper(west.shopkeeper);

    assert.equal(usedWest.where, 'gone');
    assert.equal(usedEast.where, 'gone');
    assert.equal(liveEast.unpaid, true);
    assert.equal(east.shopkeeper.eshk.bill.length, rivalDebt);
    assert.equal(west.shopkeeper.eshk.billct, 0);
    assert.equal(west.shopkeeper.eshk.credit, 0);
    assert.equal(west.shopkeeper.eshk.debit, 0);
    assert.equal(west.shopkeeper.eshk.loan, 0);
});

void test('settlement clears buried and contained ownership only for the relevant shop', async () => {
    const { west, east } = await twoShops();
    requirePlayingGame(game);
    const westChest = await floorObject(CHEST, 10, 10, { initialize: false, no_charge: true });
    const westContent = await knownObject(DAGGER, { no_charge: true });
    await addObjectToContainer(westChest, westContent);
    await buryObject(westChest);
    const eastChest = await floorObject(CHEST, 20, 10, { initialize: false, no_charge: true });
    const eastContent = await knownObject(DAGGER, { no_charge: true });
    await addObjectToContainer(eastChest, eastContent);
    await buryObject(eastChest);
    const bought = await billStock(west);
    unlinkObject(bought);
    const bag = await addInventoryObject(CHEST, { initialize: false });
    await addObjectToContainer(bag, bought);

    setPaidShopkeeper(west.shopkeeper);

    assert.equal(bought.unpaid, false);
    assert.equal(!!westChest.no_charge, false);
    assert.equal(!!westContent.no_charge, false);
    assert.equal(!!eastChest.no_charge, true);
    assert.equal(!!eastContent.no_charge, true);
});

void test('settlement without a creditor clears ownership marks, not unpaid bill membership', async () => {
    const { west } = await twoShops();
    requirePlayingGame(game);
    const billed = await billStock(west);
    const owned = await floorObject(DAGGER, 11, 10, { no_charge: true });
    const used = await billStock(west, DAGGER);
    await deleteObject(used);

    setPaidShopkeeper(null);

    assert.equal(billed.unpaid, true);
    assert.equal(!!owned.no_charge, false);
    assert.equal(used.where, 'gone');
    assert.equal(west.shopkeeper.eshk.billct, 2);
});

void test('a consumed purchase can be paid after saving and restoring', async () => {
    const { west } = await twoShops();
    requirePlayingGame(game);
    const used = await billStock(west);
    await deleteObject(used);
    const keeperId = west.shopkeeper.m_id;
    game.plname = 'BillSaver';
    setHeroGoldAmount(game, 10000);
    const storage = memoryStorage();

    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('BillSaver', storage), true);
    const keeper = game.level.monsters.find(monster => monster.m_id === keeperId);
    const [purchase] = carriedShopBill(keeper);
    assert.ok(purchase);
    const purse = heroGoldAmount(game);
    assert.equal(settleCarriedShopBillItem(keeper, purchase), true);

    assert.equal(heroGoldAmount(game), purse - purchase.price);
    assert.equal(purchase.object.where, 'gone');
    assert.equal(carriedShopBill(keeper).length, 0);
});

void test('hero death settles nested purchases and frees used-up bill identities', async () => {
    const { west, east } = await twoShops();
    requirePlayingGame(game);
    const rivalPurchase = await billStock(east);
    const used = await billStock(west);
    await deleteObject(used);
    const nested = await billStock(west, DAGGER);
    unlinkObject(nested);
    const chest = await addInventoryObject(CHEST, { initialize: false });
    await addObjectToContainer(chest, nested);

    const taken = await settleShopkeepersOnExit('died', { silent: true });

    assert.equal(taken, true);
    assert.equal(nested.unpaid, false);
    assert.equal(used.where, 'gone');
    assert.equal(west.shopkeeper.eshk.billct, 0);
    assert.equal(rivalPurchase.unpaid, false);
    assert.equal(east.shopkeeper.eshk.billct, 0);
});

void test('postmortem inheritance names the real keeper even while the hero hallucinated', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = '+InheritanceControl';
    await checkSpecialRoom();
    await addInventoryObject(DAGGER);
    game.u.hallucinationTurns = 20;
    game.program_state.gameover = true;

    const messages: string[] = [];
    const taken = await settleShopkeepersOnExit('died', { publish: message => { messages.push(message); } });

    assert.equal(taken, true);
    assert.equal(messages[0],
        'InheritanceControl gratefully inherits all your possessions.');
});
