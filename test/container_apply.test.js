import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { pushKeys } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, AMULET_OF_YENDOR, BAG_OF_HOLDING, CHEST, CLUB,
    CORPSE, DART, GOLD_PIECE, ICE_BOX, LARGE_BOX, LEATHER_GLOVES, LOADSTONE,
} from '../js/object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import {
    artifactObject, floorObject, inventoryObject,
} from './support/game-objects.js';
import { freshCommandRoom } from './support/playable-room.js';

function carryObjects(...objects) {
    game.inventory = objects;
}

function unlockedContainer(otyp, invlet, overrides = {}) {
    return inventoryObject(otyp, invlet, {
        initialize: false,
        olocked: false,
        otrapped: false,
        ...overrides,
    });
}

test.beforeEach(() => freshCommandRoom({ seed: 48201n }));

test('applying a carried chest can put an ordinary item inside', async () => {
    const chest = unlockedContainer(CHEST, 'a', { cknown: false });
    const club = inventoryObject(CLUB, 'b');
    carryObjects(chest, club);

    await applyInventoryObject('a', 'ib\n');

    assert.deepEqual(game.inventory, [chest]);
    assert.deepEqual(chest.contents, [club]);
    assert.equal(club.where, 'contained');
    assert.equal(club.container, chest);
    assert.equal(chest.cknown, true);
    assert.equal(game.context.move, 1);
});

test('applying a carried chest can take its item back out', async () => {
    const chest = unlockedContainer(CHEST, 'a', {
        cknown: true,
        pickup_prev: true,
    });
    const club = inventoryObject(CLUB, 'b', {
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];
    carryObjects(chest);

    await applyInventoryObject('a', 'oa\n');

    assert.equal(chest.contents?.length ?? 0, 0);
    assert.equal(game.inventory.includes(club), true);
    assert.equal(club.where, 'inventory');
    assert.equal(club.container, null);
    assert.equal(chest.pickup_prev, false);
    assert.equal(club.pickup_prev, true);
    assert.equal(game.context.move, 1);
});

test('a container menu can move part of a carried stack', async () => {
    const chest = unlockedContainer(CHEST, 'a', { cknown: true });
    const darts = inventoryObject(DART, 'b', {
        quantity: 5,
    });
    carryObjects(chest, darts);

    await applyInventoryObject('a', 'i2b\n');

    assert.equal(darts.quan, 3);
    assert.equal(game.inventory.includes(darts), true);
    assert.equal(chest.contents.length, 1);
    assert.equal(chest.contents[0].quan, 2);
    assert.equal(chest.contents[0].where, 'contained');
});

test('a container menu can take part of a contained stack', async () => {
    const chest = unlockedContainer(CHEST, 'a', { cknown: true });
    const darts = inventoryObject(DART, 'b', {
        where: 'contained',
        container: chest,
        quantity: 5,
    });
    chest.contents = [darts];
    carryObjects(chest);

    await applyInventoryObject('a', 'o2a\n');

    assert.equal(darts.quan, 3);
    assert.deepEqual(chest.contents, [darts]);
    const carried = game.inventory.find(object => object.otyp === DART);
    assert.equal(carried.quan, 2);
    assert.equal(carried.where, 'inventory');
});

test('a rejected partial transfer restores the carried stack', async () => {
    const chest = unlockedContainer(CHEST, 'a', { cknown: true });
    const loadstones = inventoryObject(LOADSTONE, 'b', {
        cursed: true,
        quantity: 5,
    });
    carryObjects(chest, loadstones);

    await applyInventoryObject('a', 'i2b\n');

    assert.equal(loadstones.quan, 5);
    assert.deepEqual(game.inventory, [chest, loadstones]);
    assert.equal(chest.contents?.length ?? 0, 0);
});

test('moving some gold keeps the purse and container amounts separate',
    async () => {
        const chest = unlockedContainer(CHEST, 'a', { cknown: true });
        const gold = inventoryObject(GOLD_PIECE, '$', {
            quantity: 5,
        });
        carryObjects(chest, gold);

        await applyInventoryObject('a', 'i2$\n');

        assert.equal(gold.quan, 3);
        assert.equal(heroGoldAmount(game), 3);
        assert.equal(chest.contents[0].quan, 2);
        assert.equal(chest.contents[0].where, 'contained');
    });

test('touching one cockatrice corpse restores its stack and stops transfer',
    async () => {
        const chest = unlockedContainer(CHEST, 'a', { cknown: true });
        const corpse = inventoryObject(CORPSE, 'b', {
            corpsenm: 10,
            quantity: 2,
        });
        const amulet = inventoryObject(AMULET_OF_LIFE_SAVING, 'c', {
            worn: true,
            owornmask: W_AMUL,
        });
        carryObjects(chest, corpse, amulet);
        game.uamul = game.u.uamul = amulet;

        await applyInventoryObject('a', `ic\n1b\n${' '.repeat(10)}`);

        assert.equal(game.inventory.includes(corpse), true);
        assert.equal(corpse.quan, 2);
        assert.deepEqual(chest.contents, []);
        assert.equal(game.inventory.includes(amulet), false);
        assert.ok(game.u.uhp > 0);
    });

test('gloves make a cockatrice corpse safe to put away', async () => {
    const chest = unlockedContainer(CHEST, 'a', { cknown: true });
    const corpse = inventoryObject(CORPSE, 'b', { corpsenm: 10 });
    const gloves = inventoryObject(LEATHER_GLOVES, 'c', { worn: true });
    carryObjects(chest, corpse, gloves);
    game.uarmg = game.u.uarmg = gloves;

    await applyInventoryObject('a', 'ic\nb\n');

    assert.deepEqual(chest.contents, [corpse]);
    assert.ok(game.u.uhp > 0);
});

test('a self-willed artifact can refuse to leave a container', async () => {
    const chest = unlockedContainer(CHEST, 'a', { cknown: true });
    const orb = artifactObject('The Orb of Detection', {
        where: 'contained',
        container: chest,
    });
    chest.contents = [orb];
    carryObjects(chest);
    game.u.ualign.type = -1;
    game.u.ualign.record = 0;
    game.u.uhp = game.u.uhpmax = 100;
    initRng(8401n);

    await applyInventoryObject('a', `oa\n${' '.repeat(10)}`);

    assert.deepEqual(chest.contents, [orb]);
    assert.equal(orb.where, 'contained');
    assert.ok(game.u.uhp < 100);
});

test('a carried locked chest must be put down before it can be opened',
    async () => {
        const chest = inventoryObject(CHEST, 'a', {
            cknown: false,
            lknown: false,
            olocked: true,
        });
        carryObjects(chest);

        await applyInventoryObject('a');

        assert.equal(chest.lknown, true);
        assert.equal(chest.cknown, false);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /put it down to unlock/);
    });

test('applying a trapped chest discharges its trap and spends the turn',
    async () => {
        const chest = unlockedContainer(CHEST, 'a', { otrapped: true });
        carryObjects(chest);
        initRng(1n);

        await applyInventoryObject('a', ' ');

        assert.equal(chest.otrapped, false);
        assert.equal(chest.tknown, true);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /explosive charge is a dud/);
    });

test('invocation items cannot be hidden in a container', async () => {
    const chest = unlockedContainer(CHEST, 'a', { cknown: true });
    const amulet = inventoryObject(AMULET_OF_YENDOR, 'b');
    carryObjects(chest, amulet);

    await applyInventoryObject('a', 'ib\n');

    assert.deepEqual(game.inventory, [chest, amulet]);
    assert.deepEqual(chest.contents, []);
    assert.equal(amulet.where, 'inventory');
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /cannot be confined/);
});

test('an ice box pauses and resumes corpse decay', async () => {
    const iceBox = unlockedContainer(ICE_BOX, 'a', { cknown: true });
    const corpse = inventoryObject(CORPSE, 'b', {
        age: 10,
        corpsenm: 0,
    });
    carryObjects(iceBox, corpse);
    game.moves = 40;
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, 80, game);

    await applyInventoryObject('a', 'ib\n');

    assert.equal(corpse.ageRelative, true);
    assert.deepEqual(objectTimers(corpse), []);

    await applyInventoryObject('a', 'oa\n');

    assert.equal(corpse.ageRelative, false);
    assert.equal(corpse.where, 'inventory');
    assert.ok(objectTimers(corpse).some(timer =>
        timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
});

test('floor loot uses the same container transfer as apply', async () => {
    const level = freshCommandRoom({ seed: 48202n });
    const chest = floorObject(CHEST, 10, 10, {
        cknown: true,
        olocked: false,
        otrapped: false,
    });
    const club = inventoryObject(CLUB, 'b', {
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];
    pushKeys('loot\noa\n');

    await rhack('#'.charCodeAt(0));

    assert.deepEqual(chest.contents, []);
    assert.equal(game.inventory.includes(club), true);
    assert.equal(level.objects[10][10].includes(chest), true);
    assert.equal(game.context.move, 1);
});

test('opening a cursed bag of holding can make its contents vanish',
    async () => {
        const bag = unlockedContainer(BAG_OF_HOLDING, 'a', {
            cursed: true,
            cknown: true,
        });
        const club = inventoryObject(CLUB, 'b', {
            where: 'contained',
            container: bag,
        });
        bag.contents = [club];
        carryObjects(bag);
        initRng(17n);

        await applyInventoryObject('a', ' q');

        assert.deepEqual(bag.contents, []);
        assert.equal(club.where, 'gone');
        assert.equal(game.context.move, 1);
    });

test('putting one bag of holding inside another destroys both bags',
    async () => {
        const outer = unlockedContainer(BAG_OF_HOLDING, 'a', {
            cknown: true,
        });
        const inner = unlockedContainer(BAG_OF_HOLDING, 'b', {
            cknown: true,
        });
        const club = inventoryObject(CLUB, 'c', {
            where: 'contained',
            container: outer,
        });
        outer.contents = [club];
        carryObjects(outer, inner);
        const hitPoints = game.u.uhp;

        await applyInventoryObject('a', 'ib\n');

        assert.equal(outer.where, 'gone');
        assert.equal(inner.where, 'gone');
        assert.equal(game.inventory.includes(outer), false);
        assert.equal(game.inventory.includes(inner), false);
        assert.ok(game.u.uhp < hitPoints);
        assert.equal(game.level.objects[10][10].includes(club), true);
        assert.equal(game.context.move, 1);
    });

test('opening a quantum box resolves its cat once', async () => {
    const box = unlockedContainer(LARGE_BOX, 'a', {
        cknown: false,
        spe: 1,
    });
    const corpse = inventoryObject(CORPSE, 'b', {
        where: 'contained',
        container: box,
        corpsenm: 33,
    });
    box.contents = [corpse];
    carryObjects(box);
    game.moves = 40;
    initRng(1n);

    await applyInventoryObject('a', 'q');

    assert.equal(box.spe, 0);
    assert.equal(corpse.oname, "Schroedinger's Cat");
    assert.ok(objectTimers(corpse).some(timer =>
        timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
    assert.equal(game.context.move, 1);
});
