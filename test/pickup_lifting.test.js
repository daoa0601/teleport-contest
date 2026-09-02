import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import {
    CHEST, CLUB, DART, FOOD_RATION, HEAVY_IRON_BALL, LOADSTONE, ROCK,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    floorObject, inventoryObject,
} from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

function freshPickupGame(inventory = []) {
    freshPlayableRoom();
    game.inventory = inventory;
    game.nhDisplay = new GameDisplay(null);
    initRng(32001n);
}

function carriedRocks(count) {
    return inventoryObject(ROCK, 'a', {
        quantity: count,
        nomerge: true,
    });
}

test('floor pickup honors a count chosen from a multi-object pile', async () => {
    freshPickupGame();
    const darts = floorObject(DART, 10, 10, { quantity: 20 });
    const ration = floorObject(FOOD_RATION, 10, 10);
    pushKeys('5a\n');

    await rhack(','.charCodeAt(0));

    const carried = game.inventory.find(object => object.otyp === DART);
    assert.equal(carried.quan, 5);
    assert.equal(darts.quan, 15);
    assert.equal(game.level.objects[10][10].includes(darts), true);
    assert.equal(game.level.objects[10][10].includes(ration), true);
});

test('floor pickup takes the largest stack that remains below overload',
    async () => {
        freshPickupGame([carriedRocks(150)]);
        const darts = floorObject(DART, 10, 10, { quantity: 200 });
        pushKeys(' '.repeat(5));

        await rhack(','.charCodeAt(0));

        const carried = game.inventory.find(object => object.otyp === DART);
        assert.equal(carried.quan, 149);
        assert.equal(darts.quan, 51);
        assert.equal(game.level.objects[10][10].includes(darts), true);
    });

test('declining a heavier burden leaves the floor object in place',
    async () => {
        freshPickupGame([carriedRocks(70)]);
        const ball = floorObject(HEAVY_IRON_BALL, 10, 10);
        pushKey('n');

        await rhack(','.charCodeAt(0));

        assert.equal(game.inventory.includes(ball), false);
        assert.equal(game.level.objects[10][10].includes(ball), true);
        assert.equal(game.context.move, 1);
    });

test('accepting a heavier burden picks up the floor object', async () => {
    freshPickupGame([carriedRocks(70)]);
    const ball = floorObject(HEAVY_IRON_BALL, 10, 10);
    pushKey('y');

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(ball), true);
    assert.equal(game.level.objects[10][10].includes(ball), false);
});

test('a full pack rejects a new stack which cannot merge', async () => {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const inventory = [...letters].map((letter, index) =>
        inventoryObject(CLUB, letter, {
            o_id: 32000 + index,
            nomerge: true,
        }));
    freshPickupGame(inventory);
    const dart = floorObject(DART, 10, 10, { nomerge: true });

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(dart), false);
    assert.equal(game.level.objects[10][10].includes(dart), true);
});

test('a loadstone ignores the ordinary weight limit', async () => {
    freshPickupGame([carriedRocks(160)]);
    const loadstone = floorObject(LOADSTONE, 10, 10, { cursed: true });

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(loadstone), true);
    assert.equal(game.level.objects[10][10].includes(loadstone), false);
});

test('container removal uses the same partial-stack limit', async () => {
    freshPickupGame([carriedRocks(150)]);
    const chest = floorObject(CHEST, 10, 10, { cknown: true });
    const darts = inventoryObject(DART, null, {
        where: 'contained',
        container: chest,
        quantity: 200,
    });
    chest.contents = [darts];
    pushKeys(`loot\noa\n${' '.repeat(5)}`);

    await rhack('#'.charCodeAt(0));

    const carried = game.inventory.find(object => object.otyp === DART);
    assert.equal(carried.quan, 149);
    assert.equal(darts.quan, 51);
    assert.deepEqual(chest.contents, [darts]);
});
