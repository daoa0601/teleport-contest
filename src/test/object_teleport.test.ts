import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DB_FLOOR, DB_MOAT, DOOR, DRAWBRIDGE_UP, D_CLOSED, POOL,
} from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mksobj, set_corpsenm } from '../js/mklev.js';
import { BOULDER, CHEST, CORPSE, DAGGER, GLOB_OF_BLACK_PUDDING, GOLD_PIECE, ROCK } from '../js/object_data.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { relocateObjectRandomly } from '../js/object_teleport.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { initRng } from '../js/rng.js';
import { addShopObjectToBill, costlySpot } from '../js/shk.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

void test('a falling object can land beside a monster without merging into its floor stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await createMonsterAt('orc', 16, 10);
    const first = await knownObject(ROCK, { quan: 1 });
    const falling = await knownObject(ROCK, { quan: 1 });
    placeCreatedObject(first, 16, 10);
    game.level.downTeleportRegion = { lx: 16, hx: 16, ly: 10, hy: 10 };
    initRng(1n);

    await relocateObjectRandomly(falling);

    assert.ok(floorObjectsAt(requireGameLevel(game), 16, 10).includes(first));
    assert.ok(floorObjectsAt(requireGameLevel(game), 16, 10).includes(falling));
    assert.equal(first.quan, 1);
    assert.equal(falling.quan, 1);
});

void test('object relocation avoids the hero, boulders, closed doors and inaccessible bridge surfaces', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    placeCreatedObject(await knownObject(BOULDER), 11, 10);
    const doorSquare = game.level.requireAt(12, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_CLOSED;
    game.level.requireAt(13, 10).typ = POOL;
    const moatBridge = game.level.requireAt(14, 10);
    moatBridge.typ = DRAWBRIDGE_UP;
    moatBridge.drawbridgemask = DB_MOAT;
    const floorBridge = game.level.requireAt(15, 10);
    floorBridge.typ = DRAWBRIDGE_UP;
    floorBridge.drawbridgemask = DB_FLOOR;
    game.level.downTeleportRegion = { lx: 10, hx: 16, ly: 10, hy: 10 };
    const object = await knownObject(DAGGER);
    initRng(1n);

    await relocateObjectRandomly(object);

    assert.ok(floorObjectsAt(requireGameLevel(game), 16, 10).includes(object));
});

void test('relocation keeps an object inside the Wizard tower when it starts inside', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const tower = { lx: 12, hx: 14, ly: 9, hy: 11 };
    game._activeSpecialLevel = { prototype: 'wizard3', file: 'wizard3.lua', downTeleportExclude: tower };
    game.level.downTeleportRegion = { lx: 2, hx: 78, ly: 0, hy: 20, exclude: tower };
    const object = await knownObject(DAGGER);
    placeCreatedObject(object, 13, 10);
    initRng(1n);

    await relocateObjectRandomly(object);

    assert.ok(object.ox >= tower.lx && object.ox <= tower.hx);
    assert.ok(object.oy >= tower.ly && object.oy <= tower.hy);
});

void test('relocating a Rider corpse revives the Rider instead of moving the corpse', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = await mksobj(CORPSE, false, false);
    set_corpsenm(corpse, 311);
    placeCreatedObject(corpse, 12, 10);
    pushKeys('                    ');

    await relocateObjectRandomly(corpse);

    assert.ok(game.level.monsters.some(monster => monster.mnum === 311 && monster.mhp > 0));
    assert.equal(floorObjectsAt(requireGameLevel(game), 12, 10).includes(corpse), false);
});

for (const type of [DAGGER, GLOB_OF_BLACK_PUDDING]) {
    void test(`relocation within the same shop removes a returned unpaid ${type === DAGGER ? 'dagger' : 'glob'} from its bill`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({
            left: 7, right: 16, top: 6, bottom: 14, keeperX: 8, keeperY: 6,
        });
        const object = await knownObject(type);
        placeCreatedObject(object, 12, 10);
        await addShopObjectToBill(object, game, { ininv: false });
        assert.equal(object.unpaid, true);
        initRng(1n);
        pushKeys('                    ');

        await relocateObjectRandomly(object);

        assert.ok(costlySpot(object.ox, object.oy));
        assert.equal(object.unpaid, false);
        assert.equal(shopkeeper.eshk.bill.length, 0);
    });
}

void test('relocating shop stock while outside the shop counts as theft', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const object = await knownObject(DAGGER);
    placeCreatedObject(object, 12, 10);
    game.u.ux = 15;
    initRng(1n);
    pushKeys('                                        ');

    await relocateObjectRandomly(object);

    assert.ok((shopkeeper.eshk.robbed ?? 0) > 0);
    assert.equal(!!shopkeeper.mpeaceful, false);
});

for (const contained of [false, true]) {
    void test(`relocating ${contained ? 'contained' : 'loose'} shop gold to the keeper's free spot records the loan`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({
            left: 7, right: 16, top: 6, bottom: 14, keeperX: 15, keeperY: 10,
        });
        const gold = await knownObject(GOLD_PIECE, { quan: 50 });
        const object = contained ? await knownObject(CHEST, { contents: [] }) : gold;
        if (contained) await addCreatedObjectToContainer(object, gold);
        placeCreatedObject(object, 12, 10);
        assert.ok(costlySpot(object.ox, object.oy));
        initRng(1n);
        pushKeys('                                        ');

        await relocateObjectRandomly(object);

        assert.ok(floorObjectsAt(requireGameLevel(game), shopkeeper.mx, shopkeeper.my).includes(object));
        assert.equal(shopkeeper.eshk.debit, 50);
        assert.equal(shopkeeper.eshk.loan, 50);
    });
}
