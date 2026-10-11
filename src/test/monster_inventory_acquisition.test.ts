import type { GameObject } from '../js/object_types.js';
import type { Monster } from '../js/monster_types.js';
import type { MonsterMovementAction } from '../js/monster_action_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    W_ARMF, W_WEP, MM_ANGRY, LOST_STOLEN, MM_NOCOUNTBIRTH, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT,
} from '../js/const.js';
import { petDroppableObject, initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { runClaimedGlobTimer } from '../js/glob.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { moveloop_core } from '../js/allmain.js';
import {
    giveSpecialMonsterObject, makemonAt, mksobj,
} from '../js/mklev.js';
import {
    commitPetPickup,
    finishDeferredMonsterMiscItem,
    takeMonsterTurn,
} from '../js/monmove.js';
import {
    addObjectToMonsterInventory, linkObjectToMonsterInventory, removeObjectFromMonsterInventory,
} from '../js/monster_inventory.js';
import {
    BULLWHIP, DAGGER, FIGURINE, GLOB_OF_GRAY_OOZE,
    GOLD_PIECE, LUCKSTONE, MACE, SCR_IDENTIFY, SKELETON_KEY, SPEED_BOOTS,
    SPE_BOOK_OF_THE_DEAD, WAN_STRIKING,
} from '../js/object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers, objectsInTimerGraph,
    scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { pushKeys } from '../js/input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { corpseObject, floorObject, knownObject } from './support/game-objects.js';
import { MONSTER_NAME } from '../js/monster_data.js';

void test('a pet returns a fetched item but keeps its worn saddle', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    const saddle = pony.saddle;
    assert.ok(saddle);
    const dagger = await addObjectToMonsterInventory(pony, await knownObject(DAGGER));
    assert.ok(dagger);

    assert.equal(petDroppableObject(pony), dagger);
    await removeObjectFromMonsterInventory(pony, dagger);

    assert.equal(petDroppableObject(pony), null);
    assert.equal(pony.saddle, saddle);
    assert.equal(saddle.where, 'minvent');
});

const PM_LEPRECHAUN = 63;
const PM_SHOPKEEPER = 271;

function freshInventoryState(seed = 1) {
    freshObjectRoom({
        right: 17,
        gameplaySeed: seed,
        recalculateVision: false,
    });
    requirePlayingGame(game);
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30, entry_lev: 1, dunlev_ureached: 1,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
    }];
}

interface InventoryMonsterOptions {
    mnum?: number;
    x?: number;
    y?: number;
    level?: number;
    hitPoints?: number;
    maxHitPoints?: number;
    mux?: number;
    muy?: number;
    iswiz?: Monster['iswiz'];
}

async function createInventoryMonster({
    mnum = PM_LEPRECHAUN,
    x = 12,
    y = 10,
    level,
    hitPoints,
    maxHitPoints = hitPoints,
    mux,
    muy,
    iswiz,
}: InventoryMonsterOptions = {}) {
    const monster = await createMonsterAt(mnum, x, y, NO_MINVENT);
    if (level !== undefined) monster.m_lev = level;
    if (hitPoints !== undefined) monster.mhp = hitPoints;
    if (maxHitPoints !== undefined) monster.mhpmax = maxHitPoints;
    if (mux !== undefined) monster.mux = mux;
    if (muy !== undefined) monster.muy = muy;
    if (iswiz !== undefined) monster.iswiz = iswiz;
    return monster;
}

function assertMonsterOwns(monster: Monster, object: GameObject) {
    assert.equal(object.where, 'minvent');
    assert.equal(object.carrierMid, monster.m_id);
    assert.ok(monster.minvent?.includes(object));
}


void test('makemon startup inventory links every identity to the final actor',
    async () => {
        freshInventoryState(2101);
        requirePlayingGame(game);
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

void test('runtime leprechaun creation links its money to the finished monster',
    async () => {
        freshInventoryState(2102);
        requirePlayingGame(game);

        const monster = await makemonAt(PM_LEPRECHAUN, 12, 10, MM_NOMSG);

        assert.ok(monster);
        assert.strictEqual(monster.inventory, monster.minvent);
        const gold = monster.minvent.find(object => object.otyp === GOLD_PIECE);
        assert.ok(gold);
        assert.ok(gold.quan >= 8 && gold.quan <= 240);
        assertMonsterOwns(monster, gold);
        assert.equal(monster.hasInventory, true);
    });

void test('direct add_to_minv linkage does not invent carrying effects', async () => {
    freshInventoryState(2104);
    requirePlayingGame(game);
    const monster = await createInventoryMonster();
    const figurine = await mksobj(FIGURINE, true, false);
    figurine.cursed = true;
    await linkObjectToMonsterInventory(monster, figurine);

    assert.deepEqual(objectTimers(figurine), []);
    assertMonsterOwns(monster, figurine);
});

void test('ordinary add_to_minv head-links each unmerged identity by default', async () => {
    freshInventoryState(2112);
    requirePlayingGame(game);
    const monster = await createInventoryMonster();
    const oldest = await mksobj(DAGGER, true, false);
    const newest = await mksobj(MACE, true, false);

    await linkObjectToMonsterInventory(monster, oldest);
    await linkObjectToMonsterInventory(monster, newest);

    assert.deepEqual(monster.minvent, [newest, oldest]);
    assert.strictEqual(monster.inventory, monster.minvent);
    assertMonsterOwns(monster, newest);
    assertMonsterOwns(monster, oldest);
});

void test('special-level inventory transfer removes floor ownership and head-links',
    async () => {
        freshInventoryState(2103);
        requirePlayingGame(game);
        const monster = await createInventoryMonster({
            mnum: PM_SHOPKEEPER,
        });
        const prior = await mksobj(DAGGER, true, false);
        await addObjectToMonsterInventory(monster, prior, game);
        const context = { xstart: 8, ystart: 7, width: 4, height: 4 };

        const object = await giveSpecialMonsterObject(
            context, monster, MACE, 5,
        );

        assert.ok(object);
        assert.equal(object.spe, 5);
        assert.deepEqual(monster.minvent, [object, prior]);
        assert.strictEqual(monster.inventory, monster.minvent);
        assertMonsterOwns(monster, object);
        assert.equal(floorObjects(game.level).includes(object), false);
    });

void test('pet mpickobj ownership survives the complete pickup and release cycle',
    async () => {
        freshInventoryState(2105);
        requirePlayingGame(game);
        const pet = await createMonsterAt('pony', 13, 10);
        initializePet(pet, { state: game });
        assert.ok(pet.edog);
        pet.edog.apport = 1;
        const dagger = await mksobj(DAGGER, true, false);
        dagger.blessed = false;
        dagger.cursed = false;
        placeCreatedObject(dagger, pet.mx, pet.my);

        const pickup = await takeMonsterTurn(
            pet, game,
            range => (range > 1 ? 1 : 0),
            (count, sides) => count * sides,
            range => Math.max(1, range),
        );

        assert.strictEqual(pickup.movement.pickedUp, dagger);
        // dog_invent() announces the pickup while the dagger is still on the
        // floor; the turn's presentation then extracts it and runs mpickobj().
        assert.equal(floorObjectsAt(game.level, pet.mx, pet.my).includes(dagger), true);
        await commitPetPickup(pet, pickup.movement, game);
        assertMonsterOwns(pet, dagger);
        assert.equal(floorObjectsAt(game.level, pet.mx, pet.my).includes(dagger), false);

        const dropSquare = { x: pet.mx, y: pet.my };
        const dropped = await takeMonsterTurn(
            pet, game,
            range => (range === 10 ? 0 : Math.min(1, range - 1)),
            (count, sides) => count * sides,
            range => Math.max(1, range),
        );

        assert.strictEqual(dropped.movement.dropped?.[0], dagger);
        assert.deepEqual(pet.minvent, []);
        assert.strictEqual(pet.inventory, pet.minvent);
        assert.equal(pet.hasInventory, false);
        assert.equal(dagger.where, 'floor');
        assert.equal('carrierMid' in dagger, false);
        assert.ok(floorObjectsAt(game.level, dropSquare.x, dropSquare.y).includes(dagger));
    });

void test('covetous ground tactics head-link the source artifact through mpickobj',
    async () => {
        freshInventoryState(2106);
        requirePlayingGame(game);
        const wizard = await createInventoryMonster({
            mnum: 285,
            x: 16,
            y: 12,
            mux: game.u.ux, muy: game.u.uy,
            level: 30,
            hitPoints: 120,
            iswiz: true,
        });
        const prior = await mksobj(DAGGER, true, false);
        await addObjectToMonsterInventory(wizard, prior, game);
        const book = await mksobj(SPE_BOOK_OF_THE_DEAD, true, false);
        placeCreatedObject(book, wizard.mx, wizard.my);

        await takeMonsterTurn(
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
        assert.equal(floorObjectsAt(game.level, 16, 12).includes(book), false);
    });

void test('bullwhip snatch transfers a live hero weapon through mpickobj', async () => {
    freshInventoryState(2107);
    requirePlayingGame(game);
    const monster = await createBullwhipMonster();
    const dagger = await addInventoryItem(await mksobj(DAGGER, true, false));
    await setPrimaryWeapon(dagger);
    const action = await beginBullwhipDisarm(monster, dagger, 3);

    await finishDeferredMonsterMiscItem(action, game);

    assert.deepEqual(game.inventory, []);
    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);
        assertMonsterOwns(monster, dagger);
        assert.deepEqual([dagger.ox, dagger.oy], [0, 0]);
});

void test('direct add_to_minv merges monster gold into the first live identity',
    async () => {
        freshInventoryState(2109);
        requirePlayingGame(game);
        const monster = await createInventoryMonster();
        const first = await mksobj(GOLD_PIECE, true, false);
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
        await linkObjectToMonsterInventory(monster, first);

        const survivor = await linkObjectToMonsterInventory(monster, incoming);

        assert.strictEqual(survivor, first);
        assert.deepEqual(monster.minvent, [first]);
        assert.equal(first.quan, 205);
        assert.equal(first.quantity, 205);
        assert.equal(first.owt, 2);
        assertMonsterOwns(monster, first);
        assert.equal(incoming.where, 'gone');
        assert.equal('carrierMid' in incoming, false);
    });

void test('bullwhip mpickobj frees a compatible incoming weapon after merging',
    async () => {
        freshInventoryState(2110);
        requirePlayingGame(game);
        const monster = await createBullwhipMonster();
        const survivor = await mksobj(DAGGER, true, false);
        survivor.blessed = survivor.cursed = survivor.oerodeproof = false;
        survivor.spe = 0;
        survivor.quan = survivor.quantity = 2;
        survivor.owt = 20;
        await linkObjectToMonsterInventory(monster, survivor);
        const incoming = await addInventoryItem(await knownObject(DAGGER, {
            quan: 3, quantity: 3, owt: 30, spe: 0,
            blessed: false, cursed: false, oerodeproof: false,
        }));
        await setPrimaryWeapon(incoming);
        const action = await beginBullwhipDisarm(monster, incoming, 3);

        await finishDeferredMonsterMiscItem(action, game);

        assert.deepEqual(monster.minvent.filter(object => object.otyp === DAGGER), [survivor]);
        assert.equal(monster.mw?.otyp, BULLWHIP);
        assert.equal(survivor.quan, 5);
        assert.equal(survivor.quantity, 5);
        assert.equal(survivor.owt, 50);
        assertMonsterOwns(monster, survivor);
        assert.equal(incoming.where, 'gone');
        assert.ok(!game.inventory.includes(incoming));
        assert.equal(incoming.wielded, false);
        assert.deepEqual(objectTimers(incoming), []);
    });

void test('monster stack merging stops the incoming glob timer before averaging delays',
    async () => {
        freshInventoryState(2111);
        requirePlayingGame(game);
        const monster = await createInventoryMonster();
        const survivor = await mksobj(GLOB_OF_GRAY_OOZE, true, false);
        const incoming = await mksobj(GLOB_OF_GRAY_OOZE, true, false);
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
        await linkObjectToMonsterInventory(monster, survivor);

        const merged = await addObjectToMonsterInventory(
            monster, incoming, game,
        );

        assert.strictEqual(merged, survivor);
        assert.deepEqual(monster.minvent, [survivor]);
        assert.equal(survivor.owt, 60);
        assert.equal(survivor.age, 20);
        game.moves = 102;
        assert.equal(claimNextDueObjectTimer(game, game.moves), null);
        game.moves = 103;
        const timer = claimNextDueObjectTimer(game, game.moves);
        assert.ok(timer);
        runClaimedGlobTimer(timer, game, game.moves);
        assert.equal(survivor.owt, 59);
        assert.equal(incoming.where, 'gone');
        assert.deepEqual(objectTimers(incoming), []);
        assertMonsterOwns(monster, survivor);
    });

void test('bullwhip theft removes the luck of a carried stone', async () => {
    freshInventoryState();
    requirePlayingGame(game);
    const monster = await createBullwhipMonster();
    const stone = await addInventoryItem(await knownObject(LUCKSTONE));
    await setPrimaryWeapon(stone);
    assert.equal(game.u.moreluck, 3);

    await finishDeferredMonsterMiscItem(
        await beginBullwhipDisarm(monster, stone, 3), game,
    );

    assert.equal(game.u.moreluck, 0);
    assert.ok(!game.inventory.includes(stone));
    assertMonsterOwns(monster, stone);
});

for (const [whereTo, destination, stackCount] of [
    [1, 'the monster', 2], [2, 'the hero', 1],
] as const) {
    void test(`bullwhip placement under ${destination} leaves ${stackCount} dagger stacks`, async () => {
        freshInventoryState();
        requirePlayingGame(game);
        const monster = await createBullwhipMonster();
        const x = whereTo === 1 ? monster.mx : game.u.ux;
        const y = whereTo === 1 ? monster.my : game.u.uy;
        placeCreatedObject(await knownObject(DAGGER, { initialize: false }), x, y);
        const weapon = await addInventoryItem(await knownObject(DAGGER, { initialize: false }));
        await setPrimaryWeapon(weapon);

        await finishDeferredMonsterMiscItem(
            await beginBullwhipDisarm(monster, weapon, whereTo), game,
        );

        const daggers = floorObjectsAt(game.level, x, y).filter(object => object.otyp === DAGGER);
        assert.equal(daggers.length, stackCount);
        assert.equal(daggers.reduce((total, object) => total + object.quan, 0), 2);
        assert.ok(!game.inventory.includes(weapon));
        assert.equal(game.uwep, null);
    });
}

void test('a nymph marks its stolen item through the normal turn loop', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    const item = await addInventoryItem(await knownObject(DAGGER));
    const nymph = await createMonsterAt('wood nymph', 11, 10);
    nymph.mpeaceful = 0;
    nymph.msleeping = 0;
    nymph.movement = 12;
    nymph.m_lev = 20;
    pushKeys('m.                                m.');

    await moveloop_core();
    await moveloop_core();

    assert.ok(!game.inventory.includes(item));
    assertMonsterOwns(nymph, item);
    assert.equal(item.how_lost, LOST_STOLEN);
});

void test('a pet with only worn gear and a useful key still walks toward fetchable cargo', async () => {
    freshObjectRoom({ right: 20 });
    requirePlayingGame(game);
    const pet = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    await equipMonsterObject(pet, await knownObject(SPEED_BOOTS), W_ARMF);
    await addObjectToMonsterInventory(pet, await knownObject(SKELETON_KEY));
    assert.ok(pet.edog);
    pet.edog.apport = 10;
    await floorObject(SCR_IDENTIFY, 16, 10);
    initRng(1n);

    await takeMonsterTurn(pet, game);

    assert.ok(pet.mx > 13, `pet moved to ${pet.mx},${pet.my}, away from the scroll`);
});

for (const hungry of [false, true]) {
    void test(`a ${hungry ? 'hungry' : 'content'} carnivore ${hungry ? 'seeks an ordinary corpse' : 'follows its master'}`, async () => {
        freshObjectRoom({ right: 20 });
        requirePlayingGame(game);
        const pet = await createMonsterAt('housecat', 13, 10, NO_MINVENT);
        initializePet(pet, { state: game });
        assert.ok(pet.edog);
        pet.edog.hungrytime = game.moves + (hungry ? 0 : 1000);
        const corpse = await corpseObject(MONSTER_NAME.indexOf('newt'));
        placeCreatedObject(corpse, 16, 10);
        initRng(1n);

        await takeMonsterTurn(pet, game);

        assert.ok(hungry ? pet.mx > 13 : pet.mx < 13,
            `pet moved to ${pet.mx},${pet.my}, away from its goal`);
        assert.equal(corpse.where, 'floor');
    });
}

async function createBullwhipMonster() {
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', game.u.ux + 1, game.u.uy,
        MM_ANGRY | MM_NOWAIT | MM_NOGRP | NO_MINVENT);
    await equipMonsterObject(monster, await knownObject(BULLWHIP), W_WEP);
    return monster;
}

async function beginBullwhipDisarm(
    monster: Monster, target: GameObject, whereTo: number,
): Promise<MonsterMovementAction> {
    requirePlayingGame(game);
    const turn = await takeMonsterTurn(monster, game,
        range => range === 4 ? whereTo : 0,
        (count, sides) => count * sides,
        () => 1,
    );
    const effect = turn.movement.usedMisc;
    assert.ok(effect?.kind === 'bullwhip-disarm', 'A wielded whip must select the native disarm action');
    assert.strictEqual(effect.target, target);
    assert.equal(effect.whereTo, whereTo);
    return { monster, ...turn };
}
