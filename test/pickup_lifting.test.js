import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, CHEST, CLUB, CORPSE, DART, FOOD_RATION,
    HEAVY_IRON_BALL, LOADSTONE, ROCK, SCR_SCARE_MONSTER,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    floorObject, inventoryObject,
} from './support/game-objects.js';
import { freshCommandRoom } from './support/playable-room.js';

function freshPickupGame(inventory = []) {
    freshCommandRoom({ inventory, seed: 32001n });
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

test('a floor artifact can blast the hero and evade pickup', async () => {
    const artifact = artifactByName('The Orb of Detection');
    freshPickupGame();
    const orb = floorObject(artifact.baseType, 10, 10, {
        oartifact: artifact.id,
        oextra: { oname: artifact.name },
    });
    game.u.ualign.type = -1;
    game.u.ualign.record = 0;
    game.u.uhp = game.u.uhpmax = 100;
    initRng(8401n);
    pushKeys(' '.repeat(10));

    await rhack(','.charCodeAt(0));

    assert.equal(game.level.objects[10][10].includes(orb), true);
    assert.equal(game.inventory.includes(orb), false);
    assert.ok(game.u.uhp < 100);
});

test('a fatal floor corpse stops pickup after life saving', async () => {
    const amulet = inventoryObject(AMULET_OF_LIFE_SAVING, 'a', {
        worn: true,
        owornmask: W_AMUL,
    });
    freshPickupGame([amulet]);
    game.uamul = game.u.uamul = amulet;
    const corpse = floorObject(CORPSE, 10, 10, {
        corpsenm: 10,
        quantity: 2,
    });
    pushKeys(' '.repeat(10));

    await rhack(','.charCodeAt(0));

    assert.equal(corpse.quan, 2);
    assert.equal(game.level.objects[10][10].includes(corpse), true);
    assert.equal(game.inventory.includes(amulet), false);
    assert.ok(game.u.uhp > 0);
});

test('touching a Rider corpse revives it instead of picking it up',
    async () => {
        freshPickupGame();
        game.moves = 40;
        const corpse = floorObject(CORPSE, 10, 10, {
            age: 40,
            corpsenm: 311,
        });
        pushKeys(' '.repeat(5));

        await rhack(','.charCodeAt(0));

        assert.equal(game.inventory.includes(corpse), false);
        assert.equal(game.level.objects[10][10].includes(corpse), false);
        assert.ok(game.level.monsters.some(monster =>
            monster.mnum === 311 && monster.mhp > 0));
    });

test('a blessed scare scroll becomes uncursed when picked up', async () => {
    freshPickupGame();
    const scroll = floorObject(SCR_SCARE_MONSTER, 10, 10, {
        blessed: true,
        dknown: false,
        spe: 0,
    });

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(scroll), true);
    assert.equal(scroll.blessed, false);
    assert.equal(scroll.spe, 0);
    assert.equal(scroll.dknown, true);
    assert.equal(game._encounteredObjectTypes.has(SCR_SCARE_MONSTER), true);
});

test('only the carryable part of a cursed scare-scroll stack turns to dust',
    async () => {
        freshPickupGame([carriedRocks(164)]);
        game._knownObjectTypes = new Set([SCR_SCARE_MONSTER]);
        const scrolls = floorObject(SCR_SCARE_MONSTER, 10, 10, {
            cursed: true,
            quantity: 2,
            spe: 0,
        });
        pushKeys(' '.repeat(5));

        await rhack(','.charCodeAt(0));

        assert.equal(scrolls.quan, 1);
        assert.deepEqual(game.level.objects[10][10], [scrolls]);
        assert.equal(game.inventory.some(object =>
            object.otyp === SCR_SCARE_MONSTER), false);
    });

test('an unliftable scare scroll remains unchanged', async () => {
    freshPickupGame([carriedRocks(165)]);
    const scroll = floorObject(SCR_SCARE_MONSTER, 10, 10, {
        cursed: false,
        spe: 0,
    });

    await rhack(','.charCodeAt(0));

    assert.equal(scroll.spe, 0);
    assert.equal(game.level.objects[10][10].includes(scroll), true);
    assert.equal(game.inventory.includes(scroll), false);
});
