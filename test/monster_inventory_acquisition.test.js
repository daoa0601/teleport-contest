import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MM_NOCOUNTBIRTH, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT,
} from '../js/const.js';
import { petDroppableObject, tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { place_object } from '../js/floor_object.js';
import { initializeRandomMonsterInventory } from '../js/allmain.js';
import {
    giveSpecialMonsterObject, makemonAt, mksobj,
} from '../js/mklev.js';
import {
    finishDeferredHeroCloneWizard, finishDeferredMonsterMiscItem,
    quietMonsterActionRng,
} from '../js/monmove.js';
import {
    addObjectToMonsterInventory, linkObjectToMonsterInventory, removeObjectFromMonsterInventory,
} from '../js/monster_inventory.js';
import {
    DAGGER, FAKE_AMULET_OF_YENDOR, FIGURINE, GLOB_OF_GRAY_OOZE,
    GOLD_PIECE, MACE, SPE_BOOK_OF_THE_DEAD, WAN_STRIKING,
} from '../js/object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, objectsInTimerGraph,
    scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';

test('a pet returns a fetched item but keeps its worn saddle', async () => {
    freshObjectRoom();
    const pony = await createSaddledSteed();
    const saddle = pony.saddle;
    const dagger = addObjectToMonsterInventory(pony, knownObject(DAGGER));

    assert.equal(petDroppableObject(pony), dagger);
    await removeObjectFromMonsterInventory(pony, dagger);

    assert.equal(petDroppableObject(pony), null);
    assert.equal(pony.saddle, saddle);
    assert.equal(saddle.where, 'minvent');
});

const PM_LEPRECHAUN = 63;
const PM_SHOPKEEPER = 271;
const SKELETON_KEY = 221;

function freshInventoryState(seed = 1) {
    freshObjectRoom({
        right: 17,
        gameplaySeed: seed,
        recalculateVision: false,
    });
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
    }];
}

async function createInventoryMonster(overrides = {}) {
    const {
        mnum = PM_LEPRECHAUN,
        x = 12,
        y = 10,
        level,
        hitPoints,
        maxHitPoints = hitPoints,
        ...state
    } = overrides;
    const monster = await createMonsterAt(mnum, x, y, NO_MINVENT);
    Object.assign(monster, {
        ...(level === undefined ? {} : { m_lev: level }),
        ...(hitPoints === undefined ? {} : { mhp: hitPoints }),
        ...(maxHitPoints === undefined ? {} : { mhpmax: maxHitPoints }),
        ...state,
    });
    return monster;
}

function assertMonsterOwns(monster, object) {
    assert.equal(object.where, 'minvent');
    assert.equal(object.carrierMid, monster.m_id);
    assert.ok(monster.minvent.includes(object));
}


test('makemon startup inventory links every identity to the final actor',
    async () => {
        freshInventoryState(2101);
        const flags = MM_NOGRP | MM_NOWAIT | MM_NOMSG | MM_NOCOUNTBIRTH;
        const monster = await makemonAt(PM_SHOPKEEPER, 12, 10, flags);

        assert.ok(monster);
        assert.ok(monster.minvent.some(object => object.otyp === SKELETON_KEY));
        assert.ok(monster.minvent.some(object => object.otyp === WAN_STRIKING));
        assert.strictEqual(monster.inventory, monster.minvent);
        assert.equal(monster.hasInventory, true);
        for (const object of monster.minvent)
            assertMonsterOwns(monster, object);
        const graph = objectsInTimerGraph(game);
        assert.ok(monster.minvent.every(object => graph.includes(object)));
    });

test('ambient m_initinv links direct monster money without carrying effects',
    async () => {
        freshInventoryState(2102);
        const monster = await createInventoryMonster({ level: 0 });

        initializeRandomMonsterInventory(monster);

        assert.strictEqual(monster.inventory, monster.minvent);
        assert.equal(monster.minvent.length, 1);
        assert.equal(monster.minvent[0].otyp, GOLD_PIECE);
        assertMonsterOwns(monster, monster.minvent[0]);
        assert.equal(monster.hasInventory, true);
    });

test('direct add_to_minv linkage does not invent carrying effects', async () => {
    freshInventoryState(2104);
    const monster = await createInventoryMonster();
    const figurine = {
        otyp: FIGURINE,
        cursed: true,
        corpsenm: 84,
        objectTimers: [],
    };
    linkObjectToMonsterInventory(monster, figurine);

    assert.deepEqual(objectTimers(figurine), []);
    assertMonsterOwns(monster, figurine);
});

test('ordinary add_to_minv head-links each unmerged identity by default', async () => {
    freshInventoryState(2112);
    const monster = await createInventoryMonster();
    const oldest = mksobj(DAGGER, true, false);
    const newest = mksobj(MACE, true, false);

    linkObjectToMonsterInventory(monster, oldest);
    linkObjectToMonsterInventory(monster, newest);

    assert.deepEqual(monster.minvent, [newest, oldest]);
    assert.strictEqual(monster.inventory, monster.minvent);
    assertMonsterOwns(monster, newest);
    assertMonsterOwns(monster, oldest);
});

test('special-level inventory transfer removes floor ownership and head-links',
    async () => {
        freshInventoryState(2103);
        const monster = await createInventoryMonster({
            mnum: PM_SHOPKEEPER,
        });
        const prior = mksobj(DAGGER, true, false);
        addObjectToMonsterInventory(monster, prior, game);
        const context = { xstart: 8, ystart: 7, width: 4, height: 4 };

        const object = giveSpecialMonsterObject(
            context, monster, MACE, 5,
        );

        assert.ok(object);
        assert.equal(object.spe, 5);
        assert.deepEqual(monster.minvent, [object, prior]);
        assert.strictEqual(monster.inventory, monster.minvent);
        assertMonsterOwns(monster, object);
        assert.equal(floorObjects(game.level).includes(object), false);
    });

test('pet mpickobj ownership survives the complete pickup and release cycle',
    async () => {
        freshInventoryState(2105);
        const pet = await createMonsterAt('pony', 13, 10);
        tameMonster(pet, game);
        pet.edog.apport = 1;
        const dagger = mksobj(DAGGER, true, false);
        dagger.blessed = false;
        dagger.cursed = false;
        place_object(dagger, pet.mx, pet.my);

        const pickup = quietMonsterActionRng(
            pet, game,
            range => (range > 1 ? 1 : 0),
            (count, sides) => count * sides,
            range => Math.max(1, range),
        );

        assert.strictEqual(pickup.movement.pickedUp, dagger);
        assert.equal(pickup.movement.deferredPetMove, true);
        assertMonsterOwns(pet, dagger);
        assert.equal(game.level.objects[pet.mx][pet.my].includes(dagger), false);

        const dropped = quietMonsterActionRng(
            pet, game,
            range => (range === 10 ? 0 : Math.min(1, range - 1)),
            (count, sides) => count * sides,
            range => Math.max(1, range),
        );

        assert.strictEqual(dropped.movement.dropped[0], dagger);
        assert.equal(dropped.movement.deferredPetMove, true);
        assert.deepEqual(pet.minvent, []);
        assert.strictEqual(pet.inventory, pet.minvent);
        assert.equal(pet.hasInventory, false);
        assert.equal(dagger.where, 'floor');
        assert.equal('carrierMid' in dagger, false);
        assert.ok(game.level.objects[pet.mx][pet.my].includes(dagger));
    });

test('covetous ground tactics head-link the source artifact through mpickobj',
    async () => {
        freshInventoryState(2106);
        const wizard = await createInventoryMonster({
            mnum: 285,
            x: 16,
            y: 12,
            mux: game.u.ux, muy: game.u.uy,
            level: 30,
            hitPoints: 120,
            iswiz: true,
        });
        const prior = mksobj(DAGGER, true, false);
        addObjectToMonsterInventory(wizard, prior, game);
        const book = mksobj(SPE_BOOK_OF_THE_DEAD, true, false);
        place_object(book, wizard.mx, wizard.my);

        quietMonsterActionRng(
            wizard, game,
            range => Math.max(0, range - 1),
            (count, sides) => count * sides,
            range => Math.max(1, range),
        );

        assert.deepEqual(wizard.minvent.slice(0, 2), [book, prior]);
        assert.strictEqual(wizard.inventory, wizard.minvent);
        assert.equal(book.where, 'minvent');
        assert.equal(book.carrierMid, wizard.m_id);
        assert.deepEqual([book.ox, book.oy], [16, 12]);
        assert.equal(game.level.objects[16][12].includes(book), false);
    });

test('bullwhip snatch transfers a live hero weapon through mpickobj', async () => {
    freshInventoryState(2107);
    const monster = await createInventoryMonster({
        mnum: 285,
    });
    const dagger = mksobj(DAGGER, true, false);
    dagger.where = 'invent';
    dagger.wielded = true;
    game.inventory = [dagger];
    game.uwep = dagger;
    game.u.uwep = dagger;
    const action = {
        monster,
        calls: [],
        movement: {
            usedMisc: {
                kind: 'bullwhip-disarm',
                target: dagger,
                whereTo: 3,
                deferredEffect: true,
            },
        },
    };

    finishDeferredMonsterMiscItem(action, game);

    assert.deepEqual(game.inventory, []);
    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);
        assertMonsterOwns(monster, dagger);
        assert.deepEqual([dagger.ox, dagger.oy], [0, 0]);
});

test('clonewiz direct add_to_minv links its minted fake without effects',
    async () => {
        freshInventoryState(2108);
        game.u.protectionFromShapeChangers = true;
        const clone = await createInventoryMonster({
            mnum: 285,
        });
        const action = {
            calls: [],
            movement: {
                attack: {
                    deferredCloneWizard: true,
                    cloneWizard: clone,
                },
            },
        };

        finishDeferredHeroCloneWizard(action, game, range => {
            assert.equal(range, 2);
            return 1;
        });

        assert.equal(clone.minvent.length, 1);
        assert.equal(clone.minvent[0].otyp, FAKE_AMULET_OF_YENDOR);
        assertMonsterOwns(clone, clone.minvent[0]);
        assert.deepEqual(
            [clone.minvent[0].ox, clone.minvent[0].oy],
            [0, 0],
        );
        assert.equal(action.movement.attack.deferredCloneWizard, false);
    });

test('direct add_to_minv merges monster gold into the first live identity',
    async () => {
        freshInventoryState(2109);
        const monster = await createInventoryMonster();
        const first = mksobj(GOLD_PIECE, true, false);
        first.quan = first.quantity = 75;
        first.owt = 1;
        const incoming = {
            ...first,
            o_id: 1709,
            quan: 130,
            quantity: 130,
            owt: 1,
            objectTimers: [],
        };
        linkObjectToMonsterInventory(monster, first);

        const survivor = linkObjectToMonsterInventory(monster, incoming);

        assert.strictEqual(survivor, first);
        assert.deepEqual(monster.minvent, [first]);
        assert.equal(first.quan, 205);
        assert.equal(first.quantity, 205);
        assert.equal(first.owt, 2);
        assertMonsterOwns(monster, first);
        assert.equal(incoming.where, 'gone');
        assert.equal('carrierMid' in incoming, false);
    });

test('bullwhip mpickobj frees a compatible incoming weapon after merging',
    async () => {
        freshInventoryState(2110);
        const monster = await createInventoryMonster({
            mnum: 285,
        });
        const survivor = mksobj(DAGGER, true, false);
        survivor.blessed = survivor.cursed = false;
        survivor.spe = 0;
        survivor.quan = survivor.quantity = 2;
        survivor.owt = 20;
        linkObjectToMonsterInventory(monster, survivor);
        const incoming = {
            ...survivor,
            o_id: 1710,
            quan: 3,
            quantity: 3,
            owt: 30,
            where: 'invent',
            carrierMid: undefined,
            objectTimers: [],
            wielded: true,
        };
        game.inventory = [incoming];
        game.uwep = incoming;
        game.u.uwep = incoming;
        const action = {
            monster,
            calls: [],
            movement: {
                usedMisc: {
                    kind: 'bullwhip-disarm',
                    target: incoming,
                    whereTo: 3,
                    deferredEffect: true,
                },
            },
        };

        finishDeferredMonsterMiscItem(action, game);

        assert.deepEqual(monster.minvent, [survivor]);
        assert.equal(survivor.quan, 5);
        assert.equal(survivor.quantity, 5);
        assert.equal(survivor.owt, 50);
        assertMonsterOwns(monster, survivor);
        assert.equal(incoming.where, 'gone');
        assert.equal(incoming.wielded, false);
        assert.deepEqual(objectTimers(incoming), []);
    });

test('monster glob absorption averages live shrink delays onto the survivor',
    async () => {
        freshInventoryState(2111);
        const monster = await createInventoryMonster();
        const survivor = mksobj(GLOB_OF_GRAY_OOZE, true, false);
        const incoming = mksobj(GLOB_OF_GRAY_OOZE, true, false);
        survivor.owt = 20;
        incoming.owt = 40;
        survivor.age = 10;
        incoming.age = 25;
        stopAllObjectTimers(survivor);
        stopAllObjectTimers(incoming);
        scheduleObjectTimer(
            survivor, OBJECT_TIMER_KIND.SHRINK_GLOB, 140, game,
        );
        scheduleObjectTimer(
            incoming, OBJECT_TIMER_KIND.SHRINK_GLOB, 240, game,
        );
        linkObjectToMonsterInventory(monster, survivor);

        const merged = addObjectToMonsterInventory(
            monster, incoming, game,
        );

        assert.strictEqual(merged, survivor);
        assert.deepEqual(monster.minvent, [survivor]);
        assert.equal(survivor.owt, 60);
        assert.equal(survivor.age, 20);
        assert.deepEqual(objectTimers(survivor).map(timer => ({
            kind: timer.kind,
            deadline: timer.deadline,
        })), [{
            kind: OBJECT_TIMER_KIND.SHRINK_GLOB,
            deadline: 190,
        }]);
        assert.equal(incoming.where, 'gone');
        assert.deepEqual(objectTimers(incoming), []);
        assertMonsterOwns(monster, survivor);
    });
