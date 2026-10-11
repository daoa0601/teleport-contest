import assert from 'node:assert/strict';
import test from 'node:test';
import { W_QUIVER } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { finishShopkeeperRepossession, settleShopkeepersOnExit } from '../js/shop_settlement.js';
import type { Shopkeeper } from '../js/shop_types.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

function keeperGold(keeper: Shopkeeper): number {
    return (keeper.minvent ?? []).filter(object => object.otyp === GOLD_PIECE)
        .reduce((total, object) => total + object.quan, 0);
}

void test('an outside creditor takes only the debt as real coins, then wakes and returns home', async () => {
    freshObjectRoom({ right: 27 });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const dagger = await addInventoryObject(DAGGER);
    setHeroGoldAmount(game, 100);
    await addObjectToMonsterInventory(shopkeeper, await knownObject(GOLD_PIECE, { quan: 11 }));
    const coinsBefore = keeperGold(shopkeeper);
    const coinStacksBefore = shopkeeper.minvent.filter(object => object.otyp === GOLD_PIECE).length;
    shopkeeper.eshk.shknam = '+Ada';
    shopkeeper.female = false;
    shopkeeper.eshk.customer = game.plname;
    shopkeeper.eshk.robbed = 37;
    shopkeeper.eshk.following = 1;
    shopkeeper.mpeaceful = 0;
    shopkeeper.msleeping = 1;
    shopkeeper.mfrozen = 4;
    shopkeeper.mcanmove = 0;
    shopkeeper.minvis = 1;
    shopkeeper.perminvis = 1;
    placeMonsterAt(shopkeeper, 16, 10);
    game.u.ux = 20;
    game.u.ushops = [];
    game.program_state.gameover = true;
    const messages: string[] = [];

    const taken = await settleShopkeepersOnExit('died', { publish: message => { messages.push(message); } });

    assert.equal(taken, false);
    assert.equal(heroGoldAmount(game), 63);
    assert.equal(keeperGold(shopkeeper), coinsBefore + 37);
    assert.equal(shopkeeper.minvent.filter(object => object.otyp === GOLD_PIECE).length, coinStacksBefore);
    assert.ok(game.inventory.includes(dagger));
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.equal(shopkeeper.eshk.following, 0);
    assert.equal(shopkeeper.eshk.robbed, 0);
    assert.equal(shopkeeper.eshk.surcharge, true);
    assert.equal(shopkeeper.msleeping, 0);
    assert.equal(shopkeeper.mfrozen, 0);
    assert.equal(shopkeeper.mcanmove, 1);
    assert.equal(shopkeeper.minvis, 0);
    assert.equal(shopkeeper.perminvis, 0);
    assert.equal(shopkeeper.mx, shopkeeper.eshk.shk.x);
    assert.equal(shopkeeper.my, shopkeeper.eshk.shk.y);
    assert.equal(messages[0], 'Ada wakes up and comes and takes the 37 zorkmids you owed him.');
});

void test('shop debt transfers all carried gold before its message pages, while possessions await disclosure', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = '+Ada';
    shopkeeper.eshk.debit = 37;
    const dagger = await addInventoryObject(DAGGER);
    const purse = setHeroGoldAmount(game, 100);
    assert.ok(purse);
    game.uquiver = purse;
    game.u.uquiver = purse;
    purse.owornmask = W_QUIVER;
    purse.ready = true;
    const coinsBefore = keeperGold(shopkeeper);
    const input = resetInputState();
    await plineWithContinuation('The final bolt strikes you, and everything around you grows dark.');
    game.program_state.gameover = true;

    const settling = settleShopkeepersOnExit('died');
    const boundary = await Promise.race([
        settling.then(() => 'completed'),
        input.waitUntilBlocked().then(() => 'input'),
    ]);
    assert.equal(boundary, 'input', 'The preceding fatal prose needs acknowledgment before settlement continues.');
    const display = requireGameDisplay(game);
    assert.match(display.grid[0]?.map(cell => cell.ch).join('') ?? '', /final bolt.*--More--/);
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(keeperGold(shopkeeper), coinsBefore + 100);
    assert.equal(game.uquiver, null);
    assert.equal(game.u.uquiver, null);
    assert.equal(purse.owornmask, 0);
    assert.ok(game.inventory.includes(dagger));
    assert.equal(shopkeeper.eshk.debit, 37);
    input.feed(' ');
    assert.equal(await settling, true);

    assert.equal(shopkeeper.eshk.debit, 0);
    assert.ok(game.inventory.includes(dagger));
});

for (const arises of [false, true]) {
    void test(`peaceful inheritance ${arises ? 'leaves a rising hero possessions' : 'claims possessions without waking the keeper'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop();
        const dagger = await addInventoryObject(DAGGER);
        shopkeeper.msleeping = 1;
        game.u.ugrave_arise = arises ? MONSTER_NAME.indexOf('human zombie') : -1;
        game.program_state.gameover = true;
        const messages: string[] = [];

        const taken = await settleShopkeepersOnExit('died', { publish: message => { messages.push(message); } });

        assert.equal(taken, !arises);
        assert.equal(shopkeeper.msleeping, 1);
        assert.ok(game.inventory.includes(dagger));
        assert.equal(messages.length, arises ? 0 : 1);
    });
}

void test('a resident has priority over a creditor and every keeper settles without replacing the first repository', async () => {
    freshObjectRoom({ right: 27 });
    requirePlayingGame(game);
    const west = await createStaffedShop();
    const east = await createStaffedShop({ left: 18, right: 24, keeperX: 21 });
    const dagger = await addInventoryObject(DAGGER);
    setHeroGoldAmount(game, 17);
    const westGoldBefore = keeperGold(west.shopkeeper);
    const eastGoldBefore = keeperGold(east.shopkeeper);
    // Keep the keeper away from the drop square so no nearby monster catches it.
    placeMonsterAt(west.shopkeeper, 14, 12);
    east.shopkeeper.eshk.robbed = 500;
    east.shopkeeper.eshk.debit = 27;
    east.shopkeeper.eshk.credit = 9;
    east.shopkeeper.eshk.loan = 5;
    game.level.monsters = [east.shopkeeper, west.shopkeeper];
    game.u.ushops = [west.roomno];
    game.program_state.gameover = true;

    assert.equal(await settleShopkeepersOnExit('died', { silent: true }), true);
    await finishShopkeeperRepossession();

    assert.ok(floorObjectsAt(game.level, 10, 10).includes(dagger));
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(keeperGold(west.shopkeeper), westGoldBefore + 17);
    assert.equal(keeperGold(east.shopkeeper), eastGoldBefore);
    assert.equal(east.shopkeeper.eshk.debit, 0);
    assert.equal(east.shopkeeper.eshk.credit, 0);
    assert.equal(east.shopkeeper.eshk.loan, 0);
    assert.equal(east.shopkeeper.eshk.robbed, 500);
});

void test('a shared-wall creditor is preferred and later room membership cannot replace its repository', async () => {
    freshObjectRoom({ right: 27 });
    requirePlayingGame(game);
    const west = await createStaffedShop();
    const east = await createStaffedShop({ left: 18, right: 24, keeperX: 21 });
    const dagger = await addInventoryObject(DAGGER);
    placeMonsterAt(east.shopkeeper, 24, 12);
    game.level.monsters = [west.shopkeeper, east.shopkeeper];
    game.u.ushops = [west.roomno, east.roomno];
    const heroCell = game.level.at(game.u.ux, game.u.uy);
    assert.ok(heroCell);
    heroCell.edge = true;
    east.shopkeeper.eshk.debit = 20;
    game.program_state.gameover = true;

    assert.equal(await settleShopkeepersOnExit('died', { silent: true }), true);
    await finishShopkeeperRepossession();

    assert.ok(floorObjectsAt(game.level, 22, 10).includes(dagger));
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(east.shopkeeper.eshk.debit, 0);
});

for (const debt of [0, 50]) {
    void test(`${debt ? 'a creditor takes priority over an angry keeper' : 'an angry keeper takes priority over a peaceful local keeper'}`, async () => {
        freshObjectRoom({ right: 40 });
        requirePlayingGame(game);
        const local = await createStaffedShop();
        const angry = await createStaffedShop({ left: 18, right: 24, keeperX: 21 });
        const creditor = await createStaffedShop({ left: 28, right: 34, keeperX: 31 });
        const dagger = await addInventoryObject(DAGGER);
        placeMonsterAt(angry.shopkeeper, 24, 12);
        setHeroGoldAmount(game, 100);
        const angryGoldBefore = keeperGold(angry.shopkeeper);
        const creditorGoldBefore = keeperGold(creditor.shopkeeper);
        game.u.ux = 38;
        game.u.ushops = [];
        game.level.monsters = [local.shopkeeper, angry.shopkeeper, creditor.shopkeeper];
        angry.shopkeeper.mpeaceful = 0;
        creditor.shopkeeper.eshk.robbed = debt;
        game.program_state.gameover = true;

        const taken = await settleShopkeepersOnExit('died', { silent: true });

        assert.equal(taken, debt === 0);
        assert.equal(heroGoldAmount(game), debt ? 50 : 0);
        assert.equal(keeperGold(angry.shopkeeper), angryGoldBefore + (debt ? 0 : 100));
        assert.equal(keeperGold(creditor.shopkeeper), creditorGoldBefore + debt);
        assert.equal(creditor.shopkeeper.eshk.robbed, 0);
        if (taken) {
            await finishShopkeeperRepossession();
            assert.ok(floorObjectsAt(game.level, 22, 10).includes(dagger));
            assert.equal(game.inventory.includes(dagger), false);
        } else {
            assert.ok(game.inventory.includes(dagger));
        }
    });
}

for (const outcome of ['died', 'ascended', 'quit'] as const) {
    void test(`${outcome} ${outcome === 'quit' ? 'omits corpse prose but still returns' : 'shows a visible secondary keeper examining the corpse and returns'} the keeper`, async () => {
        freshObjectRoom({ right: 27 });
        requirePlayingGame(game);
        const west = await createStaffedShop();
        const east = await createStaffedShop({ left: 18, right: 24, keeperX: 21 });
        east.shopkeeper.eshk.shknam = '+Bea';
        east.shopkeeper.female = true;
        east.shopkeeper.msleeping = 1;
        east.shopkeeper.minvis = 1;
        east.shopkeeper.perminvis = 1;
        placeMonsterAt(east.shopkeeper, 15, 10);
        await addInventoryObject(DAGGER);
        game.u.ushops = [west.roomno];
        game.program_state.gameover = true;
        vision_recalc(0);
        const messages: string[] = [];

        await settleShopkeepersOnExit(outcome, { random: () => 0, publish: message => { messages.push(message); } });

        if (outcome === 'quit') assert.equal(messages.length, 1);
        else assert.equal(messages[1], 'Bea wakes up, looks at your corpse, shakes her head, and disappears.');
        assert.equal(east.shopkeeper.msleeping, 0);
        assert.equal(east.shopkeeper.minvis, 0);
        assert.equal(east.shopkeeper.perminvis, 0);
        assert.equal(east.shopkeeper.mx, 21);
        assert.equal(east.shopkeeper.my, 10);
    });
}

void test('silent settlement still wakes, reveals, and settles an unseen secondary keeper', async () => {
    freshObjectRoom({ right: 27 });
    requirePlayingGame(game);
    const west = await createStaffedShop();
    const east = await createStaffedShop({ left: 18, right: 24, keeperX: 21 });
    east.shopkeeper.msleeping = 1;
    east.shopkeeper.minvis = 1;
    east.shopkeeper.perminvis = 1;
    east.shopkeeper.eshk.debit = 5;
    game.u.ushops = [west.roomno];
    game.u.blindTurns = 5;
    game.program_state.gameover = true;
    vision_recalc(0);
    const messages: string[] = [];

    await settleShopkeepersOnExit('died', { silent: true, publish: message => { messages.push(message); } });

    assert.equal(messages.length, 0);
    assert.equal(east.shopkeeper.msleeping, 0);
    assert.equal(east.shopkeeper.minvis, 0);
    assert.equal(east.shopkeeper.perminvis, 0);
    assert.equal(east.shopkeeper.eshk.debit, 0);
});

void test('escape leaves bills, possessions, and keeper state untouched', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const dagger = await addInventoryObject(DAGGER);
    shopkeeper.eshk.debit = 23;
    shopkeeper.minvis = 1;

    assert.equal(await settleShopkeepersOnExit('escaped'), false);

    assert.equal(shopkeeper.eshk.debit, 23);
    assert.equal(shopkeeper.minvis, 1);
    assert.ok(game.inventory.includes(dagger));
});

void test('a lone nonlocal keeper is still settled and removed when no local candidate exists', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const dagger = await addInventoryObject(DAGGER);
    shopkeeper.eshk.shoplevel = { dnum: game.u.uz.dnum, dlevel: game.u.uz.dlevel + 1 };
    shopkeeper.eshk.credit = 19;
    shopkeeper.minvis = 1;
    game.u.ushops = [];
    game.program_state.gameover = true;

    assert.equal(await settleShopkeepersOnExit('died', { silent: true }), false);

    assert.equal(shopkeeper.eshk.credit, 0);
    assert.equal(shopkeeper.minvis, 0);
    assert.equal(shopkeeper.dead, true);
    assert.equal(game.level.monsters.includes(shopkeeper), false);
    assert.ok(game.inventory.includes(dagger));
});

void test('repossession falls back to the previous hero square when no keeper recorded a location', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER);
    game.u.ux0 = 10;
    game.u.uy0 = 11;
    game.u.ux = 0;
    game.u.uy = 0;
    game.program_state.gameover = true;

    await finishShopkeeperRepossession();

    assert.equal(game.inventory.includes(dagger), false);
    assert.ok(floorObjectsAt(game.level, 10, 11).includes(dagger));
});
