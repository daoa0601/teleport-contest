import { floorObjectsAt } from './support/level-state.js';
import { requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { D_ISOPEN, DOOR, STONE } from '../js/const.js';
import { cls } from '../js/display.js';
import { game } from '../js/gstate.js';
import { startHeroDigging } from '../js/hero_digging.js';
import { syncHeroInvisibility } from '../js/hero_invisibility.js';
import { pushKeys } from '../js/input.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { DAGGER, PICK_AXE } from '../js/object_data.js';
import { addShopObjectToBill, checkSpecialRoom } from '../js/shk.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { createSaddledSteed } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
void test('a keeper at home blocks a pick-carrying hero at the shop door', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper, roomno } = await createStaffedShop({
        left: 9, right: 16, keeperX: 9, doorX: 8,
    });
    const doorSquare = game.level.requireAt(8, 10);
    doorSquare.typ = DOOR;
    doorSquare.flags = D_ISOPEN;
    doorSquare.roomno = roomno;
    doorSquare.edge = true;
    game.u.ux0 = game.u.ux;
    game.u.ux = 8;
    await checkSpecialRoom();
    await cls();
    await addInventoryObject(PICK_AXE, { initialize: false });
    pushKeys('          ');
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx, 9);
    assert.equal(shopkeeper.my, 10);
});
void test('a peaceful keeper at home does not mill around an invisible hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('invisible', 'outside', game);
    syncHeroInvisibility();
    const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
    pushKeys('          ');
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx, 12);
    assert.equal(shopkeeper.my, 10);
});
void test('a following keeper with an open bill moves toward the customer, not home', async () => {
    freshObjectRoom({ hero: { ux: 15, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ right: 16, keeperX: 12 });
    shopkeeper.eshk.shk = { x: 9, y: 10 };
    const stock = await floorObject(DAGGER, 15, 10);
    await addShopObjectToBill(stock, game, { silent: true });
    assert.equal(stock.unpaid, true);
    shopkeeper.eshk.following = true;
    pushKeys('          ');
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx, 13);
    assert.equal(shopkeeper.my, 10);
});
void test('a blocked keeper outside its shop does not pick up floor cargo without moving', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ left: 9, keeperX: 9 });
    shopkeeper.mx = 7;
    for (let x = 6; x <= 8; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 7 || y !== 10)
                game.level.requireAt(x, y).typ = STONE;
        }
    }
    const dagger = await floorObject(DAGGER, 7, 10);
    pushKeys('          ');
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx, 7);
    assert.equal(shopkeeper.my, 10);
    assert.equal(dagger.where, 'floor');
    assert.ok(game.level.objects[7] != null);
    assert.ok(game.level.objects[7]?.[10] !== undefined && game.level.objects[7]?.[10] !== null);
    assert.ok(floorObjectsAt(game.level, 7, 10).includes(dagger));
});
void test('a moving keeper outside its shop can collect the same kind of floor cargo', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ left: 9, keeperX: 9 });
    shopkeeper.mx = 6;
    const dagger = await floorObject(DAGGER, 7, 10);
    pushKeys('          ');
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx, 7);
    assert.equal(shopkeeper.my, 10);
    assert.ok(game.level.objects[7] != null);
    assert.ok(game.level.objects[7]?.[10] !== undefined && game.level.objects[7]?.[10] !== null);
    assert.equal(floorObjectsAt(game.level, 7, 10).includes(dagger), false);
    assert.ok(shopkeeper.minvent.some(object => object.otyp === DAGGER));
});
for (const fast of [false, true]) {
    void test(`a ${fast ? 'fast' : 'normal-speed'} hero's floor pick ${fast ? 'keeps' : 'does not keep'} the shopkeeper at home`, async () => {
        freshObjectRoom({ hero: { fast } });
        requirePlayingGame(game);
        const { shopkeeper, roomno } = await createStaffedShop({
            left: 9, right: 16, keeperX: 9, doorX: 8,
        });
        const doorSquare = game.level.requireAt(8, 10);
        doorSquare.typ = DOOR;
        doorSquare.flags = D_ISOPEN;
        doorSquare.roomno = roomno;
        doorSquare.edge = true;
        game.u.ux = 8;
        await checkSpecialRoom();
        await floorObject(PICK_AXE, 8, 10);
        pushKeys('          ');
        await takeMonsterTurn(shopkeeper, game);
        assert.equal(shopkeeper.mx === 9 && shopkeeper.my === 10, fast);
    });
}
void test('a keeper at home makes room for a distant customer even with an open bill', async () => {
    freshObjectRoom({ hero: { ux: 15, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ left: 9, right: 17, keeperX: 9 });
    const stock = await floorObject(DAGGER, 15, 10);
    await addShopObjectToBill(stock, game, { silent: true });
    assert.equal(stock.unpaid, true);
    pushKeys('          ');
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx === 9 && shopkeeper.my === 10, false);
});
for (const canSee of [false, true]) {
    void test(`an angry ${canSee ? 'sighted' : 'blind'} keeper heads toward ${canSee ? 'the hero' : 'home'}`, async () => {
        freshObjectRoom({ hero: { ux: 15, uy: 10 } });
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({ left: 9, right: 17, keeperX: 12 });
        shopkeeper.eshk.shk = { x: 9, y: 10 };
        shopkeeper.mpeaceful = 0;
        shopkeeper.mcansee = canSee ? 1 : 0;
        pushKeys('          ');
        await takeMonsterTurn(shopkeeper, game);
        assert.equal(shopkeeper.mx, canSee ? 13 : 11);
        assert.equal(shopkeeper.my, 10);
    });
}
for (const effort of [0, 210]) {
    void test(effort ? 'a keeper intercepts a nearly finished hole'
        : 'a keeper stays near home when the hole is far from finished', async () => {
        freshObjectRoom({ hero: { ux: 15, uy: 10 } });
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({ left: 9, right: 17, keeperX: 12 });
        shopkeeper.eshk.shk = { x: 9, y: 10 };
        const pick = await addInventoryObject(PICK_AXE, { initialize: false });
        game.uwep = pick;
        pushKeys('          ');
        await startHeroDigging(pick, 15, 10, { down: true });
        assert.ok(game.context.digging != null, 'Expected game.context.digging to be initialized');
        game.context.digging.effort = effort;
        await takeMonsterTurn(shopkeeper, game);
        assert.equal(shopkeeper.mx, effort ? 13 : 11);
        assert.ok(Math.abs(shopkeeper.my - 10) <= 1);
    });
}
void test('a distant keeper intercepts active horizontal digging too', async () => {
    freshObjectRoom({ right: 35, hero: { ux: 30, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ left: 9, right: 34, keeperX: 12 });
    shopkeeper.eshk.shk = { x: 9, y: 10 };
    game.level.requireAt(31, 10).typ = STONE;
    const pick = await addInventoryObject(PICK_AXE, { initialize: false });
    game.uwep = pick;
    pushKeys('          ');
    await startHeroDigging(pick, 31, 10);
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx, 13);
    assert.equal(shopkeeper.my, 10);
});
void test('a keeper at home waits instead of milling around a mounted hero', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    const { shopkeeper } = await createStaffedShop({ keeperX: 13 });
    pushKeys('          ');
    await takeMonsterTurn(shopkeeper, game);
    assert.equal(shopkeeper.mx, 13);
    assert.equal(shopkeeper.my, 10);
});
//# sourceMappingURL=shopkeeper_movement.test.js.map