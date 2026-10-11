import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { breakMonsterBoulder } from '../js/monster_boulder.js';
import { BOULDER, ROCK } from '../js/object_data.js';
import { addShopObjectToBill } from '../js/shk.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

void test('a keeper fractures a boulder, then must wait before breaking another', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const first = await floorObject(BOULDER, 12, 10);
    const second = await floorObject(BOULDER, 12, 11);
    game.level.flags.sokoban_rules = true;
    const luck = game.u.uluck;
    pushKeys('                    ');

    await breakMonsterBoulder(shopkeeper, 12, 10);
    await breakMonsterBoulder(shopkeeper, 12, 11);

    assert.equal(first.otyp, ROCK);
    assert.ok(first.quan >= 7 && first.quan <= 66);
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(first));
    assert.equal(second.otyp, BOULDER);
    assert.ok(shopkeeper.mspec_used !== undefined && shopkeeper.mspec_used >= 10 && shopkeeper.mspec_used <= 29);
    assert.equal(game.u.uluck, luck);
    assert.equal(game.u.uconduct.sokocheat ?? 0, 0);
});

void test('a Rider can keep breaking boulders without a spell cooldown', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const rider = await createMonsterAt('Death', 11, 10);
    rider.mspec_used = 8;
    const first = await floorObject(BOULDER, 12, 10);
    const second = await floorObject(BOULDER, 12, 11);
    pushKeys('                    ');

    await breakMonsterBoulder(rider, 12, 10);
    await breakMonsterBoulder(rider, 12, 11);

    assert.equal(first.otyp, ROCK);
    assert.equal(second.otyp, ROCK);
    assert.equal(rider.mspec_used, 8);
});

void test('rock throwing alone does not let a giant magically fracture a boulder', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 11, 10);
    const boulder = await floorObject(BOULDER, 12, 10);

    await breakMonsterBoulder(giant, 12, 10);

    assert.equal(boulder.otyp, BOULDER);
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(boulder));
});

void test('monster fracture retains a billed boulder charge but does not bill its rocks', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const boulder = await floorObject(BOULDER, 12, 10);
    await addShopObjectToBill(boulder, game, { silent: true });
    assert.equal(boulder.unpaid, true);
    const originalEntry = shopkeeper.eshk.bill[0];
    assert.ok(originalEntry, 'the boulder has a bill entry');
    const price = originalEntry.price;
    pushKeys('                    ');

    await breakMonsterBoulder(shopkeeper, 12, 10);

    assert.equal(boulder.otyp, ROCK);
    assert.equal(boulder.unpaid, false);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    const entry = shopkeeper.eshk.bill[0];
    assert.ok(entry);
    assert.equal(entry.price, price);
    assert.equal(entry.useup, true);
    const usedBoulder = (game.billObjects ?? []).find(object => object.o_id === entry.bo_id);
    assert.ok(usedBoulder);
    assert.equal(usedBoulder.otyp, BOULDER);
    assert.notEqual(usedBoulder.o_id, boulder.o_id);
});

void test('an empty destination does not spend a keeper spell cooldown', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();

    await breakMonsterBoulder(shopkeeper, 13, 10);

    assert.equal(shopkeeper.mspec_used ?? 0, 0);
});

void test('a proper-named quest leader keeps its name in the incantation message', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const leader = await createMonsterAt('Lord Carnarvon', 11, 10);
    await floorObject(BOULDER, 12, 10);
    const messages: string[] = [];

    await breakMonsterBoulder(leader, 12, 10, game, {
        publish: async (message: string) => messages.push(message),
    });

    assert.ok(messages.some(message =>
        message.startsWith('Lord Carnarvon mutters an incantation.')),
    messages.join('\n'));
});
