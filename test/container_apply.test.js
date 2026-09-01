import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    AMULET_OF_YENDOR, BAG_OF_HOLDING, CHEST, CLUB, CORPSE, ICE_BOX,
    LARGE_BOX,
} from '../js/object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import {
    floorObject, inventoryObject,
} from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

function freshContainerGame(...objects) {
    freshPlayableRoom();
    game.inventory = objects;
    game.nhDisplay = new GameDisplay(null);
    initRng(48201n);
}

async function applyObject(keys) {
    pushKeys(keys);
    await rhack('a'.charCodeAt(0));
}

test('applying a carried chest can put an ordinary item inside', async () => {
    const chest = inventoryObject(CHEST, 'a', { cknown: false });
    const club = inventoryObject(CLUB, 'b');
    freshContainerGame(chest, club);

    await applyObject('aib\n');

    assert.deepEqual(game.inventory, [chest]);
    assert.deepEqual(chest.contents, [club]);
    assert.equal(club.where, 'contained');
    assert.equal(club.container, chest);
    assert.equal(chest.cknown, true);
    assert.equal(game.context.move, 1);
});

test('applying a carried chest can take its item back out', async () => {
    const chest = inventoryObject(CHEST, 'a', { cknown: true });
    const club = inventoryObject(CLUB, 'b', {
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];
    freshContainerGame(chest);

    await applyObject('aoa\n');

    assert.deepEqual(chest.contents, []);
    assert.equal(game.inventory.includes(club), true);
    assert.equal(club.where, 'inventory');
    assert.equal(club.container, null);
    assert.equal(game.context.move, 1);
});

test('a carried locked chest must be put down before it can be opened',
    async () => {
        const chest = inventoryObject(CHEST, 'a', {
            cknown: false,
            lknown: false,
            olocked: true,
        });
        freshContainerGame(chest);

        await applyObject('a');

        assert.equal(chest.lknown, true);
        assert.equal(chest.cknown, false);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /put it down to unlock/);
    });

test('applying a trapped chest discharges its trap and spends the turn',
    async () => {
        const chest = inventoryObject(CHEST, 'a', { otrapped: true });
        freshContainerGame(chest);
        initRng(1n);

        await applyObject('a ');

        assert.equal(chest.otrapped, false);
        assert.equal(chest.tknown, true);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /explosive charge is a dud/);
    });

test('invocation items cannot be hidden in a container', async () => {
    const chest = inventoryObject(CHEST, 'a', { cknown: true });
    const amulet = inventoryObject(AMULET_OF_YENDOR, 'b');
    freshContainerGame(chest, amulet);

    await applyObject('aib\n');

    assert.deepEqual(game.inventory, [chest, amulet]);
    assert.deepEqual(chest.contents, []);
    assert.equal(amulet.where, 'inventory');
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /cannot be confined/);
});

test('an ice box pauses and resumes corpse decay', async () => {
    const iceBox = inventoryObject(ICE_BOX, 'a', { cknown: true });
    const corpse = inventoryObject(CORPSE, 'b', {
        age: 10,
        corpsenm: 260,
    });
    freshContainerGame(iceBox, corpse);
    game.moves = 40;
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, 80, game);

    await applyObject('aib\n');

    assert.equal(corpse.ageRelative, true);
    assert.deepEqual(objectTimers(corpse), []);

    await applyObject('aoa\n');

    assert.equal(corpse.ageRelative, false);
    assert.equal(corpse.where, 'inventory');
    assert.ok(objectTimers(corpse).some(timer =>
        timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
});

test('floor loot uses the same container transfer as apply', async () => {
    const level = freshPlayableRoom();
    game.nhDisplay = new GameDisplay(null);
    const chest = floorObject(CHEST, 10, 10, { cknown: true });
    const club = inventoryObject(CLUB, 'b', {
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];
    initRng(48202n);
    pushKeys('loot\noa\n');

    await rhack('#'.charCodeAt(0));

    assert.deepEqual(chest.contents, []);
    assert.equal(game.inventory.includes(club), true);
    assert.equal(level.objects[10][10].includes(chest), true);
    assert.equal(game.context.move, 1);
});

test('opening a cursed bag of holding can make its contents vanish',
    async () => {
        const bag = inventoryObject(BAG_OF_HOLDING, 'a', {
            cursed: true,
            cknown: true,
        });
        const club = inventoryObject(CLUB, 'b', {
            where: 'contained',
            container: bag,
        });
        bag.contents = [club];
        freshContainerGame(bag);
        initRng(17n);

        await applyObject('a q');

        assert.deepEqual(bag.contents, []);
        assert.equal(club.where, 'gone');
        assert.equal(game.context.move, 1);
    });

test('putting one bag of holding inside another destroys both bags',
    async () => {
        const outer = inventoryObject(BAG_OF_HOLDING, 'a', {
            cknown: true,
        });
        const inner = inventoryObject(BAG_OF_HOLDING, 'b', {
            cknown: true,
        });
        const club = inventoryObject(CLUB, 'c', {
            where: 'contained',
            container: outer,
        });
        outer.contents = [club];
        freshContainerGame(outer, inner);
        const hitPoints = game.u.uhp;

        await applyObject('aib\n');

        assert.equal(outer.where, 'gone');
        assert.equal(inner.where, 'gone');
        assert.equal(game.inventory.includes(outer), false);
        assert.equal(game.inventory.includes(inner), false);
        assert.ok(game.u.uhp < hitPoints);
        assert.equal(game.level.objects[10][10].includes(club), true);
        assert.equal(game.context.move, 1);
    });

test('opening a quantum box resolves its cat once', async () => {
    const box = inventoryObject(LARGE_BOX, 'a', {
        cknown: false,
        spe: 1,
    });
    const corpse = inventoryObject(CORPSE, 'b', {
        where: 'contained',
        container: box,
        corpsenm: 33,
    });
    box.contents = [corpse];
    freshContainerGame(box);
    game.moves = 40;
    initRng(1n);

    await applyObject('aq');

    assert.equal(box.spe, 0);
    assert.equal(corpse.oname, "Schroedinger's Cat");
    assert.ok(objectTimers(corpse).some(timer =>
        timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
    assert.equal(game.context.move, 1);
});
