import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
import type { ObjectRoomOptions } from './support/object-room.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { flushPendingTopline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { ALTAR, LADDER, LAVAWALL, VWALL } from '../js/const.js';
import { APPLE, BULLWHIP, DAGGER, PICK_AXE, SACK } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { startHeroDigging, continueHeroDigging } from '../js/hero_digging.js';
import { addShopObjectToBill } from '../js/shk.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { addObjectToContainer } from '../js/object_container.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { applyInventoryObject, dropInventoryObject, kickDirection } from './support/commands.js';
import { createStaffedShop } from './support/shop.js';

function dropRoom(options: ObjectRoomOptions = {}) {
    freshObjectRoom({ role: 'barbarian', ...options });
    requirePlayingGame(game);
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, {
        expected: /pick-axe|bullwhip|altar|drop|splash|smoulder|owe|pay|falls down the ladder/i,
        limit: 200,
    });
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
    };
    return messages;
}

async function text(messages: string[]) {
    await flushPendingTopline();
    const output = messages.join('\n');
    messages.length = 0;
    return output;
}

void test('a digging fumble onto an altar reveals the tool before releasing its wielded slot', async () => {
    const messages = dropRoom({ hero: { fumbling: true } });
    requirePlayingGame(game);
    const pick = await addInventoryObject(PICK_AXE, { spe: 0, bknown: false });
    await setPrimaryWeapon(pick);
    game.level.requireAt(10, 10).typ = ALTAR;
    game.level.requireAt(11, 10).typ = VWALL;
    initRng(3n);
    await startHeroDigging(pick, 11, 10);

    const continuing = await continueHeroDigging();

    const output = await text(messages);
    assert.match(output, /You fumble and drop your pick-axe\./);
    assert.equal(continuing, false);
    assert.equal(pick.bknown, true);
    assert.match(output, /A \+0 pick-axe \(weapon in right hand\) lands on the altar\./);
    assert.equal(pick.where, 'floor');
    assert.equal(game.inventory.includes(pick), false);
    assert.equal(game.uwep, null);
    assert.equal(game.u.uconduct.gnostic, 1);
});

void test('a slippery bullwhip lands on an altar through the normal drop effects', async () => {
    const messages = dropRoom({ hero: { glibTurns: 20 } });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, { bknown: false });
    await setPrimaryWeapon(whip);
    game.level.requireAt(10, 10).typ = ALTAR;
    initRng(1n);

    await applyInventoryObject(whip, 'l');

    const output = await text(messages);
    assert.match(output, /The bullwhip slips out of your hand\./);
    assert.equal(whip.bknown, true);
    assert.match(output, /altar/);
    assert.equal(whip.where, 'floor');
    assert.equal(game.inventory.includes(whip), false);
    assert.equal(game.uwep, null);
    assert.equal(game.u.uconduct.gnostic, 1);
});

for (const blind of [false, true]) {
    void test(`burning a borrowed bullwhip ${blind ? 'while blind ' : ''}preserves its used-up bill`, async () => {
        const messages = dropRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 12 });
        const whip = await addInventoryObject(BULLWHIP, { oeroded: 3 });
        await addShopObjectToBill(whip, game, { silent: true });
        await setPrimaryWeapon(whip);
        assert.equal(whip.unpaid, true);
        assert.ok(shopkeeper.eshk.bill[0] !== undefined && shopkeeper.eshk.bill[0] !== null);
        const price = shopkeeper.eshk.bill[0].price;
        game.level.requireAt(11, 10).typ = LAVAWALL;
        await text(messages);
        if (blind) setHeroBlindnessTurns(10);
        initRng(1n);

        await applyInventoryObject(whip, 'l');

        const output = await text(messages);
        assert.match(output, /You cause a small splash\./);
        assert.match(output, /bullwhip smoulders away!/);
        assert.doesNotMatch(output, /You smell smoke/);
        assert.equal(game.inventory.includes(whip), false);
        assert.equal(game.uwep, null);
        assert.equal(shopkeeper.eshk.bill.length, 1);
        assert.equal(shopkeeper.eshk.bill[0].useup, true);
        assert.equal(shopkeeper.eshk.bill[0].price, price);
    });
}

void test('shipping a borrowed tool down a ladder settles its bill before migration', async () => {
    const messages = dropRoom({ hero: { uz: { dnum: 0, dlevel: 1 } } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom',  num_dunlevs: 2, flags: {} })];
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 12 });
    const pick = await addInventoryObject(PICK_AXE);
    await addShopObjectToBill(pick, game, { silent: true });
    assert.ok(shopkeeper.eshk.bill[0] !== undefined && shopkeeper.eshk.bill[0] !== null);
    const price = shopkeeper.eshk.bill[0].price;
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: true, u_traversed: false,
        tolev: { dnum: 0, dlevel: 2 }, next: null,
    };
    game.level.requireAt(10, 10).typ = LADDER;
    await text(messages);

    await dropInventoryObject(pick);

    assert.equal(pick.where, 'migrating');
    assert.ok(pick.migration !== undefined && pick.migration !== null, 'Expected pick.migration to be initialized');
    assert.equal(pick.migration.destination.dlevel, 2);
    assert.equal(game.inventory.includes(pick), false);
    assert.equal(pick.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(shopkeeper.eshk.debit, price);
    assert.match(await text(messages), /owe|pay/i);
});

void test('kicking shop merchandise down a ladder charges the stock even when it was never picked up', async () => {
    const messages = dropRoom({ hero: { uz: { dnum: 0, dlevel: 1 } } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom',  num_dunlevs: 2, flags: {} })];
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 12 });
    const dagger = await floorObject(DAGGER, 11, 10, { spe: 0 });
    game.stairs = {
        sx: 12, sy: 10, up: false, isladder: true, u_traversed: false,
        tolev: { dnum: 0, dlevel: 2 }, next: null,
    };
    game.level.requireAt(12, 10).typ = LADDER;
    await text(messages);
    initRng(1n);

    await kickDirection('l');

    assert.equal(dagger.where, 'migrating');
    assert.ok(dagger.migration !== undefined && dagger.migration !== null, 'Expected dagger.migration to be initialized');
    assert.equal(dagger.migration.destination.dlevel, 2);
    assert.ok(shopkeeper.eshk.debit > 0, 'lost shop stock must still be paid for');
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.match(await text(messages), /owe|pay/i);
});

void test('shipping a shop container clears ownership flags on its contents', async () => {
    const messages = dropRoom({ hero: { uz: { dnum: 0, dlevel: 1 } } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom',  num_dunlevs: 2, flags: {} })];
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 12 });
    const sack = await floorObject(SACK, 11, 10);
    const apple = await knownObject(APPLE, { no_charge: true });
    await addObjectToContainer(sack, apple);
    game.stairs = {
        sx: 12, sy: 10, up: false, isladder: true, u_traversed: false,
        tolev: { dnum: 0, dlevel: 2 }, next: null,
    };
    game.level.requireAt(12, 10).typ = LADDER;
    await text(messages);
    initRng(1n);

    await kickDirection('l');

    assert.equal(sack.where, 'migrating');
    assert.equal(apple.where, 'contained');
    assert.equal(apple.container, sack);
    assert.equal(!!apple.no_charge, false);
    assert.ok(shopkeeper.eshk.debit > 0);
});
