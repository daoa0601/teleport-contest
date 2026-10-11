import test from 'node:test';
import assert from 'node:assert/strict';
import { buryFloorObjectsAt, buryObject, unearthFloorObjectsAt } from '../js/buried_object.js';
import { DB_FLOOR, DRAWBRIDGE_UP, POOL, ROOM, TT_BURIEDBALL } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { applyFloorEffects } from '../js/floor_effects.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { placeObject, remove_object } from '../js/floor_object.js';
import { maybeUnhideAt } from '../js/monster_hiding.js';
import { BELL_OF_OPENING, BOULDER, DAGGER, GOLD_PIECE, LEASH, POT_HEALING, ROCK, } from '../js/object_data.js';
import { LEVEL_TIMER_KIND, levelTimers } from '../js/object_timers.js';
import { deleteObject } from '../js/object_delete.js';
import { grantIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { punishHero } from '../js/punishment.js';
import { initRng } from '../js/rng.js';
import { addShopObjectToBill } from '../js/shk.js';
import { runDueTimers } from '../js/timer_effects.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('a hero filling shop water pays for the buried pile before hearing the splash', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const { shopkeeper } = await createStaffedShop();
    const potion = await floorObject(POT_HEALING, 12, 10);
    const dagger = await floorObject(DAGGER, 12, 10);
    requireGameLevel().requireAt(12, 10).typ = POOL;
    const boulder = await knownObject(BOULDER);
    const messages = [];
    initRng(1n);
    await applyFloorEffects(boulder, 12, 10, {
        publish: async (text) => {
            messages.push(text);
        },
    });
    assert.equal(requireGameLevel().requireAt(12, 10).typ, ROOM);
    assert.equal(potion.where, 'buried');
    assert.equal(dagger.where, 'buried');
    assert.ok(potion.no_charge && dagger.no_charge);
    assert.ok(shopkeeper.eshk.debit > 0);
    const charges = messages.filter((text) => text.includes('for burying merchandise.'));
    assert.equal(charges.length, 1);
    assert.ok(charges[0]);
    assert.ok(charges[0].endsWith(` ${shopkeeper.eshk.debit} zorkmids for burying merchandise.`));
    assert.ok(messages.indexOf(charges[0]) < messages.findIndex((text) => text.includes('large splash')));
});
void test('a natural thaw filling shop water buries goods without charging the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const { shopkeeper } = await createStaffedShop();
    requireGameLevel().requireAt(12, 10).typ = POOL;
    await applyRayFloorFeatures('cold', 12, 10);
    const timer = levelTimers().find((candidate) => candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY);
    assert.ok(timer);
    const potion = await floorObject(POT_HEALING, 12, 10);
    await floorObject(BOULDER, 12, 10);
    const moving = game.context.mon_moving;
    game.moves = timer.deadline;
    initRng(1n);
    await runDueTimers();
    assert.equal(requireGameLevel().requireAt(12, 10).typ, ROOM);
    assert.equal(potion.where, 'buried');
    assert.equal(!!potion.no_charge, false);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(game.context.mon_moving, moving);
});
void test('burial removes cover and engravings, even on an empty square', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await floorObject(DAGGER, 12, 10);
    const spider = await createMonsterAt('cave spider', 12, 10);
    spider.mundetected = 1;
    makeEngravingAt(12, 10, 'cover');
    makeEngravingAt(13, 10, 'empty');
    await buryFloorObjectsAt(12, 10);
    await buryFloorObjectsAt(13, 10);
    assert.equal(!!spider.mundetected, false);
    assert.equal(engravingAt(12, 10), null);
    assert.equal(engravingAt(13, 10), null);
});
void test('an eel cannot stay hidden over a dry raised drawbridge', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const drawbridge = requireGameLevel().requireAt(12, 10);
    drawbridge.typ = DRAWBRIDGE_UP;
    drawbridge.drawbridgemask = DB_FLOOR;
    const eel = await createMonsterAt('giant eel', 12, 10);
    eel.mundetected = 1;
    maybeUnhideAt(12, 10);
    assert.equal(!!eel.mundetected, false);
});
void test('burying the attached ball deletes its chain and anchors a levitating hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const { ux: x, uy: y } = game.u;
    const gold = await floorObject(GOLD_PIECE, x, y);
    grantIntrinsicProperty('levitation', 'outside');
    await punishHero();
    const ball = game.uball;
    assert.ok(ball);
    const chain = game.uchain;
    assert.ok(chain);
    await buryFloorObjectsAt(x, y);
    assert.equal(game.uball, null);
    assert.equal(game.uchain, null);
    assert.equal(chain.where, 'gone');
    assert.equal(ball.where, 'buried');
    assert.equal(gold.where, 'buried');
    assert.ok(!(requireGameLevel().buriedObjects ?? []).includes(chain));
    assert.equal(game.u.utraptype, TT_BURIEDBALL);
    assert.ok((game.u.utrap ?? 0) >= 20 && (game.u.utrap ?? 0) < 70);
    assert.equal(propertyIsActive('levitation'), false);
    await unearthFloorObjectsAt(x, y);
    assert.equal(game.uball, ball);
    assert.ok(game.uchain && game.uchain !== chain);
    assert.equal(ball.where, 'floor');
    assert.equal(game.u.utrap, 0);
    assert.equal(propertyIsActive('levitation'), true);
});
void test('burying a floor leash releases the animal and the leash attachment', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 11, 10);
    const leash = await floorObject(LEASH, 12, 10);
    leash.leashmon = dog.m_id;
    dog.mleashed = 1;
    await buryObject(leash);
    assert.equal(leash.where, 'buried');
    assert.equal(dog.mleashed, 0);
    assert.equal(leash.leashmon, 0);
});
void test('an absorbed billed rock retains its debt instead of vanishing from the bill', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const { shopkeeper } = await createStaffedShop();
    const rock = await floorObject(ROCK, 12, 10);
    await addShopObjectToBill(rock);
    assert.ok(rock.unpaid);
    await buryObject(rock);
    assert.equal(rock.where, 'onbill');
    assert.ok(game.billObjects);
    assert.ok(game.billObjects.includes(rock));
    assert.equal(shopkeeper.eshk.bill[0]?.useup, true);
    assert.equal(shopkeeper.eshk.debit, 0, 'single-object burial does not bill the whole square');
});
void test('a protected tool and attached chain stay above ground while the rest of a shop pile is buried', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    await createStaffedShop();
    const { ux: x, uy: y } = game.u;
    const coins = await floorObject(GOLD_PIECE, x, y);
    await punishHero();
    const chain = game.uchain;
    assert.ok(chain);
    const ball = game.uball;
    assert.ok(ball);
    remove_object(ball);
    await placeObject(ball, x + 1, y);
    const bell = await floorObject(BELL_OF_OPENING, x, y);
    await buryFloorObjectsAt(x, y);
    assert.equal(bell.where, 'floor');
    assert.equal(chain.where, 'floor');
    assert.equal(game.uchain, chain);
    assert.equal(game.uball, ball);
    assert.ok(bell.no_charge && chain.no_charge);
    assert.equal(coins.where, 'buried');
    assert.equal(!!coins.no_charge, false);
});
void test('shop credit pays for burial without a second merchandise debt', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const { shopkeeper } = await createStaffedShop();
    const dagger = await floorObject(DAGGER, 12, 10);
    shopkeeper.eshk.credit = 1000;
    const messages = [];
    await buryFloorObjectsAt(12, 10, game, {
        publish: async (text) => {
            messages.push(text);
        },
    });
    assert.equal(dagger.where, 'buried');
    assert.ok(dagger.no_charge);
    assert.ok(shopkeeper.eshk.credit < 1000 && shopkeeper.eshk.credit > 0);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.ok(messages.some((text) => text.includes('credit')));
    assert.ok(messages.every((text) => !text.includes('for burying merchandise.')));
});
void test("burying an angry shopkeeper's goods records robbery rather than peaceful debt", async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const { shopkeeper } = await createStaffedShop();
    const dagger = await floorObject(DAGGER, 12, 10);
    shopkeeper.mpeaceful = 0;
    const messages = [];
    await buryFloorObjectsAt(12, 10, game, {
        publish: async (text) => {
            messages.push(text);
        },
    });
    assert.equal(dagger.where, 'buried');
    assert.ok(dagger.no_charge);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.ok((shopkeeper.eshk.robbed ?? 0) > 0);
    assert.equal(messages.filter((text) => text.includes('for burying merchandise.')).length, 1);
});
for (const operation of ['bury', 'delete']) {
    void test(`${operation} releases the leash of a pony mounted through the ride command`, async () => {
        freshObjectRoom({
            role: 'knight',
            hero: { ulevel: 30 },
            flags: { tips: false, verbose: false, pickup: false },
        });
        requirePlayingGame(game);
        const pony = await createSaddledSteed();
        const leash = await addInventoryObject(LEASH, { leashmon: pony.m_id });
        pony.mleashed = 1;
        await runExtendedCommand('ride', 'l' + ' '.repeat(50));
        assert.equal(game.u.usteed, pony);
        assert.equal(pony.mleashed, 1);
        leash.ox = game.u.ux;
        leash.oy = game.u.uy;
        if (operation === 'bury')
            await buryObject(leash);
        else
            await deleteObject(leash);
        assert.equal(pony.mleashed, 0);
        assert.equal(leash.leashmon, 0);
        assert.equal(leash.where, operation === 'bury' ? 'buried' : 'gone');
        assert.equal(game.u.usteed, pony);
    });
}
//# sourceMappingURL=buried_object.test.js.map