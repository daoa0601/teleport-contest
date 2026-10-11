import { createSpecialLevel } from './support/topology.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { LAVAPOOL, POOL, ROOM, WATER, W_AMUL } from '../js/const.js';
import { dropBoulderIntoLiquid } from '../js/boulder_pool.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { applyFloorEffects } from '../js/floor_effects.js';
import { remove_object } from '../js/floor_object.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { addShopObjectToBill } from '../js/shk.js';
import { makeBlinded } from '../js/sight_change.js';
import { heroIsSliming, startHeroSliming } from '../js/slime.js';
import { createStaffedShop } from './support/shop.js';
import { AMULET_OF_LIFE_SAVING, BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test("a monster's life-saving amulet works when a boulder fills its pool", async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = POOL;
    await makeBlinded(10, { talk: false });
    game.u.deaf = true;
    vision_recalc(0);
    const monster = await createMonsterAt('giant', 12, 10);
    monster.mhp = 1;
    const amulet = await equipMonsterObject(
        monster,
        await knownObject(AMULET_OF_LIFE_SAVING),
        W_AMUL,
    );
    const boulder = await knownObject(BOULDER);
    initRng(1n);

    await dropBoulderIntoLiquid(boulder, 12, 10, game);

    assert.equal(monster.dead, false);
    assert.ok(monster.mhp > 0);
    assert.equal(requireGameLevel().monsters.includes(monster), true);
    assert.equal(amulet.where, 'gone');
});

void test('a visible boulder splash names the pool and wakes a sleeping monster aloud', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    requireGameLevel().requireAt(11, 10).typ = POOL;
    const sleeper = await createMonsterAt('giant ant', 14, 10);
    sleeper.msleeping = 1;
    const newerSleeper = await createMonsterAt('newt', 13, 11);
    newerSleeper.msleeping = 1;
    const boulder = await knownObject(BOULDER);
    const messages: string[] = [];
    initRng(1n);

    await applyFloorEffects(boulder, 11, 10, {
        publish: async (text: string) => {
            messages.push(text);
        },
    });

    assert.equal(requireGameLevel().requireAt(11, 10).typ, ROOM);
    assert.equal(boulder.where, 'gone');
    assert.equal(sleeper.msleeping, 0);
    assert.ok(messages.some((text) => /boulder fills the pool of water/.test(text)));
    const newtWake = messages.findIndex((text) => /newt wakes up/.test(text));
    const antWake = messages.findIndex((text) => /giant ant wakes up/.test(text));
    assert.ok(newtWake >= 0 && antWake > newtWake, 'newer monsters wake first');
});

void test('an unpaid boulder used to fill water stays on its shop bill', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 10 });
    const boulder = await floorObject(BOULDER, 11, 10);
    await addShopObjectToBill(boulder, game, { ininv: false, silent: true });
    assert.equal(boulder.unpaid, true);
    remove_object(boulder);
    requireGameLevel().requireAt(11, 10).typ = POOL;
    initRng(1n);

    await applyFloorEffects(boulder, 11, 10);

    assert.equal(boulder.where, 'onbill');
    assert.ok(shopkeeper.eshk.bill.some((entry) => entry.bo_id === boulder.o_id && entry.useup));
});

void test('a lava splash burns slime and destroys the polymorphed body, not human HP', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    await polymonHero(MONSTER_NAME.indexOf('giant ant'));
    game.u.mh = 1;
    const humanHp = game.u.uhp;
    assert.equal(startHeroSliming(), true);
    requireGameLevel().requireAt(11, 10).typ = LAVAPOOL;
    const boulder = await knownObject(BOULDER);
    initRng(1n);

    await dropBoulderIntoLiquid(boulder, 11, 10);

    assert.ok(!heroIsSliming());
    assert.equal(game.u.mtimedone, 0);
    assert.equal(game.u.uhp, humanHp);
    assert.equal(boulder.where, 'gone');
    assert.ok(!game.program_state.gameover);
});

void test('life saving resumes boulder disposal after a fatal lava splash', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(100));
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    requireGameLevel().requireAt(11, 10).typ = LAVAPOOL;
    const boulder = await knownObject(BOULDER);
    initRng(1n);

    await dropBoulderIntoLiquid(boulder, 11, 10);

    assert.equal(amulet.where, 'gone');
    assert.ok(game.u.uhp > 0);
    assert.equal(boulder.where, 'gone');
    assert.ok(!game.program_state.gameover);
});

for (const waterPlane of [false, true]) {
    void test(`a boulder ${waterPlane ? 'cannot fill' : 'can fill'} a wall of water ${waterPlane ? 'on' : 'outside'} the Water Plane`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        pushKeys(' '.repeat(100));
        if (waterPlane) game.water_level = createSpecialLevel(game.u.uz);
        requireGameLevel().requireAt(12, 10).typ = WATER;
        const boulder = await knownObject(BOULDER);
        initRng(2n);

        await applyFloorEffects(boulder, 12, 10);

        assert.equal(requireGameLevel().requireAt(12, 10).typ, waterPlane ? WATER : ROOM);
        assert.equal(boulder.where, 'gone');
    });
}

void test('a water wall can swallow a boulder that would fill an ordinary pool', async () => {
    for (const type of [POOL, WATER]) {
        freshObjectRoom();
        requirePlayingGame(game);
        pushKeys(' '.repeat(100));
        requireGameLevel().requireAt(12, 10).typ = type;
        const boulder = await knownObject(BOULDER);
        initRng(1n);

        await applyFloorEffects(boulder, 12, 10);

        assert.equal(requireGameLevel().requireAt(12, 10).typ, type === POOL ? ROOM : WATER);
        assert.equal(boulder.where, 'gone');
    }
});
