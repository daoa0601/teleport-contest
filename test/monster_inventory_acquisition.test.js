import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MM_NOCOUNTBIRTH, MM_NOGRP, MM_NOMSG, MM_NOWAIT, ROOM,
} from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { initializeRandomMonsterInventory } from '../js/allmain.js';
import {
    giveSpecialMonsterObject, makemonAt, mksobj, place_object,
} from '../js/mklev.js';
import {
    finishDeferredHeroCloneWizard, finishDeferredMonsterMiscItem,
    quietMonsterActionRng,
} from '../js/monmove.js';
import {
    addObjectToMonsterInventory, linkObjectToMonsterInventory,
} from '../js/monster_inventory.js';
import {
    DAGGER, FAKE_AMULET_OF_YENDOR, FIGURINE, GLOB_OF_GRAY_OOZE,
    GOLD_PIECE, MACE, SPE_BOOK_OF_THE_DEAD, WAN_STRIKING,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    OBJECT_TIMER_KIND, objectTimers, objectsInTimerGraph,
    scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

const PM_LEPRECHAUN = 63;
const PM_SHOPKEEPER = 271;
const SKELETON_KEY = 221;

function freshInventoryState(seed = 1) {
    resetGame();
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        ualign: { type: 0, record: 0 },
        uhave: {},
        acurr: { a: Array(6).fill(12) },
        amax: { a: Array(6).fill(12) },
    };
    game.flags = {};
    game.context = {};
    game.moves = 40;
    game.mvitals = [];
    game.inventory = [];
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
    }];
    game.level = new GameMap();
    game.level.monsters = [];
    for (let x = 7; x <= 17; x++) {
        for (let y = 6; y <= 14; y++) {
            const location = game.level.at(x, y);
            location.typ = ROOM;
            location.lit = true;
        }
    }
    game.in_mklev = false;
    initRng(999n);
    init_objects();
    initRng(BigInt(seed));
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
    () => {
        freshInventoryState(2102);
        const monster = {
            m_id: 702,
            mnum: PM_LEPRECHAUN,
            mx: 12, my: 10,
            m_lev: 0,
            mpeaceful: 0,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(monster);

        initializeRandomMonsterInventory(monster);

        assert.strictEqual(monster.inventory, monster.minvent);
        assert.equal(monster.minvent.length, 1);
        assert.equal(monster.minvent[0].otyp, GOLD_PIECE);
        assertMonsterOwns(monster, monster.minvent[0]);
        assert.equal(monster.hasInventory, true);
    });

test('direct add_to_minv linkage does not invent carrying effects', () => {
    freshInventoryState(2104);
    const monster = {
        m_id: 704,
        mnum: PM_LEPRECHAUN,
        mx: 12, my: 10,
        minvent: [],
        inventory: [],
        hasInventory: false,
    };
    game.level.monsters.push(monster);
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

test('ordinary add_to_minv head-links each unmerged identity by default', () => {
    freshInventoryState(2112);
    const monster = {
        m_id: 712,
        mnum: PM_LEPRECHAUN,
        mx: 12, my: 10,
        minvent: [],
        inventory: [],
        hasInventory: false,
    };
    game.level.monsters.push(monster);
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
    () => {
        freshInventoryState(2103);
        const monster = {
            m_id: 703,
            mnum: PM_SHOPKEEPER,
            mx: 12, my: 10,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(monster);
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
        assert.equal((game.level.objects || []).flat(2).includes(object), false);
    });

test('pet mpickobj ownership survives the complete pickup and release cycle',
    () => {
        freshInventoryState(2105);
        const pet = {
            m_id: 705,
            mnum: 100,
            mx: 13, my: 10,
            mux: game.u.ux, muy: game.u.uy,
            m_lev: 4,
            mhp: 20, mhpmax: 20,
            mcanmove: 1,
            pet: true,
            mtame: 10,
            edog: { apport: 1 },
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(pet);
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
    () => {
        freshInventoryState(2106);
        const wizard = {
            m_id: 706,
            mnum: 285,
            mx: 16, my: 12,
            mux: game.u.ux, muy: game.u.uy,
            m_lev: 30,
            mhp: 120, mhpmax: 120,
            mcanmove: 1,
            mpeaceful: 0,
            minvent: [],
            inventory: [],
            hasInventory: false,
            iswiz: true,
        };
        game.level.monsters.push(wizard);
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

test('bullwhip snatch transfers a live hero weapon through mpickobj', () => {
    freshInventoryState(2107);
    const monster = {
        m_id: 707,
        mnum: 285,
        mx: 12, my: 10,
        minvent: [],
        inventory: [],
        hasInventory: false,
    };
    game.level.monsters.push(monster);
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
    () => {
        freshInventoryState(2108);
        game.u.protectionFromShapeChangers = true;
        const clone = {
            m_id: 708,
            mnum: 285,
            mx: 12, my: 10,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(clone);
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
    () => {
        freshInventoryState(2109);
        const monster = {
            m_id: 709,
            mnum: PM_LEPRECHAUN,
            mx: 12, my: 10,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(monster);
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
    () => {
        freshInventoryState(2110);
        const monster = {
            m_id: 710,
            mnum: 285,
            mx: 12, my: 10,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(monster);
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
    () => {
        freshInventoryState(2111);
        const monster = {
            m_id: 711,
            mnum: PM_LEPRECHAUN,
            mx: 12, my: 10,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(monster);
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
