import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { APPLE, CHEST, CLUB, DAGGER, POT_HEALING, SACK, } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { objectTimers } from '../js/object_timers.js';
import { objectWeight } from '../js/weight.js';
import { shopObjectUnitCost } from '../js/shk.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject, corpseObject, } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';
void test('a blade can break while prying a chest lock', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const dagger = await addInventoryObject(DAGGER, {
        invlet: 'a',
        spe: 0,
        cursed: false,
        wielded: true,
        owornmask: W_WEP,
    });
    const chest = await floorObject(CHEST, 10, 10, {
        olocked: true,
        obroken: false,
        contents: [],
    });
    game.uwep = game.u.uwep = dagger;
    initRng(46n);
    pushKeys('force\ny');
    await rhack('#'.charCodeAt(0));
    await withMessagePages(() => continueCountedCommand(game), resetInputState(), /Your dagger broke!$/, 1);
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(game.uwep, null);
    assert.equal(game._pending_message, 'You give up your attempt to force the lock.');
});
void test('prying with stacked daggers reports one broken dagger and keeps the rest wielded', async () => {
    freshGameplayRoom();
    const daggers = await addInventoryObject(DAGGER, {
        invlet: 'a', quan: 3, spe: 0, cursed: false,
        wielded: true, owornmask: W_WEP,
    });
    const chest = await floorObject(CHEST, 10, 10, { olocked: true, obroken: false });
    game.uwep = game.u.uwep = daggers;
    const input = resetInputState();
    initRng(46n);
    pushKeys('force\ny');
    await rhack('#'.charCodeAt(0));
    await answerPrompts(continueCountedCommand(game), input, [
        { prompt: /You force your daggers into a crack and pry\..*--More--/, keys: ' ' },
        { prompt: /One of your daggers broke!.*--More--/, keys: ' ' },
    ]);
    assert.equal(game._pending_message, 'You give up your attempt to force the lock.');
    assert.equal(daggers.quan, 2);
    assert.ok(game.inventory.includes(daggers));
    assert.equal(game.uwep, daggers);
    assert.equal(daggers.owornmask, W_WEP);
    assert.equal(chest.olocked, true);
    assert.equal(chest.obroken, false);
    assert.equal(game._occupation, null);
});
async function bashChest(seed) {
    const club = await addInventoryObject(CLUB, {
        invlet: 'a', wielded: true, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = club;
    initRng(seed);
    pushKeys('force\ny' + ' '.repeat(30));
    await rhack('#'.charCodeAt(0));
    for (let turn = 0; game._occupation && turn < 51; turn++)
        await continueCountedCommand(game);
}
void test('bashing a chest spills a surviving container with its contents intact', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const chest = await floorObject(CHEST, 10, 10, {
        olocked: true, contents: [],
    });
    const sack = await knownObject(SACK);
    const apple = await knownObject(APPLE);
    await addObjectToContainer(sack, apple);
    await addObjectToContainer(chest, sack);
    await bashChest(17n);
    assert.equal(chest.where, 'gone');
    assert.ok(chest.contents !== null && chest.contents !== undefined);
    assert.equal(chest.contents.length, 0);
    assert.equal(sack.where, 'floor');
    assert.equal(sack.container, null);
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).includes(sack));
    assert.equal(apple.where, 'contained');
    assert.equal(apple.container, sack);
    assert.ok(sack.contents !== null && sack.contents !== undefined);
    assert.ok(sack.contents.includes(apple));
    assert.equal(game._occupation, null);
});
void test('a shattered stack loses one item and spills the remaining weight', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const chest = await floorObject(CHEST, 10, 10, {
        olocked: true, contents: [],
    });
    const daggers = await knownObject(DAGGER, { quan: 3 });
    await addObjectToContainer(chest, daggers);
    await bashChest(2n);
    assert.equal(chest.where, 'gone');
    assert.equal(daggers.where, 'floor');
    assert.equal(daggers.container, null);
    assert.equal(daggers.quan, 2);
    assert.equal(daggers.owt, objectWeight(daggers));
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).includes(daggers));
});
void test('spilled stacks join matching objects already under the chest', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    await floorObject(DAGGER, 10, 10, { initialize: false, quan: 2 });
    const chest = await floorObject(CHEST, 10, 10, {
        olocked: true, contents: [],
    });
    const daggers = await knownObject(DAGGER, { initialize: false, quan: 3 });
    await addObjectToContainer(chest, daggers);
    await bashChest(17n);
    const pile = floorObjectsAt(requireGameLevel(game), 10, 10);
    assert.equal(chest.where, 'gone');
    assert.equal(pile.length, 1);
    assert.ok(pile[0]);
    assert.equal(pile[0].otyp, DAGGER);
    assert.equal(pile[0].quan, 5);
    assert.equal(pile[0].container, null);
});
void test('a shattered inner container deletes its contents and their timers', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const chest = await floorObject(CHEST, 10, 10, {
        olocked: true, contents: [],
    });
    const sack = await knownObject(SACK);
    const corpse = await corpseObject(MONSTER_NAME.indexOf('giant ant'));
    await addObjectToContainer(sack, corpse);
    await addObjectToContainer(chest, sack);
    assert.ok(objectTimers(corpse).length > 0);
    await bashChest(2n);
    assert.equal(chest.where, 'gone');
    assert.equal(sack.where, 'gone');
    assert.equal(corpse.where, 'gone');
    assert.equal(objectTimers(corpse).length, 0);
    assert.equal(floorObjectsAt(requireGameLevel(game), 10, 10).length, 0);
});
void test('a potion shattered in a bashed chest exposes the hero to its vapor', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.uhp = 10;
    game.u.uhpmax = 40;
    const chest = await floorObject(CHEST, 10, 10, {
        olocked: true, contents: [],
    });
    const potions = await knownObject(POT_HEALING, { quan: 2 });
    await addObjectToContainer(chest, potions);
    await bashChest(17n);
    assert.equal(chest.where, 'gone');
    assert.equal(potions.where, 'floor');
    assert.equal(potions.quan, 1);
    assert.ok(game.u.uhp > 10);
    assert.match(game._pending_message, /You see a .* shatter!/);
});
void test('destroying a shop chest charges the chest and shattered contents', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const { shopkeeper } = await createStaffedShop({
        left: 8, right: 14, top: 8, bottom: 12, keeperX: 13,
    });
    const chest = await floorObject(CHEST, 10, 10, {
        olocked: true, contents: [],
    });
    const daggers = await knownObject(DAGGER, { quan: 3 });
    await addObjectToContainer(chest, daggers);
    const destroyedValue = shopObjectUnitCost(chest, shopkeeper)
        + 3 * shopObjectUnitCost(daggers, shopkeeper);
    await bashChest(2n);
    assert.equal(chest.where, 'gone');
    assert.equal(daggers.where, 'floor');
    assert.equal(daggers.quan, 2);
    assert.equal(shopkeeper.eshk.debit, destroyedValue);
    assert.match(game._pending_message, /You owe .* for objects destroyed\./);
});
//# sourceMappingURL=force_lock.test.js.map