import type { GameMap } from '../js/game.js';
import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { STONE, WEB } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, heroGoldObject } from '../js/hero_gold.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    createGoldMonster, carriedGold, fireQuiveredGold, readyGold, throwGold,
} from './support/gold-arena.js';
import {
    addTrap, floorObjects, floorObjectsAt,
} from './support/level-state.js';
import { freshGameplayRoom } from './support/playable-room.js';


async function quiver(amount: number, id: number) {
    const purse = await carriedGold(amount, id);
    await readyGold();
    return purse;
}

function detachedCoin(level: GameMap, purse: GameObject) {
    const coins = floorObjects(level).filter(object =>
        object.otyp === GOLD_PIECE && object !== purse);
    assert.equal(coins.length, 1);
    const coin = coins[0];
    assert.ok(coin);
    assert.equal(coin.quantity, 1);
    return coin;
}

void test('f fires one quivered coin through the ordinary strength range',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(5, 29101);

        await fireQuiveredGold('l');

        const coin = detachedCoin(level, purse);
        assert.equal(heroGoldObject(game), purse);
        assert.equal(heroGoldAmount(game), 4);
        assert.equal(game.uquiver, purse);
        assert.equal(purse.quantity, 4);
        assert.notEqual(coin.o_id, purse.o_id);
        assert.deepEqual([coin.ox, coin.oy], [15, 10]);
        assert.equal(floorObjectsAt(level, 15, 10).includes(coin), true);
        assert.equal(game.context.move, 1);
    });

void test('t selects the same one-coin quivered path rather than whole-purse gold',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(5, 29102);

        await throwGold('l');

        const coin = detachedCoin(level, purse);
        assert.equal(game.uquiver, purse);
        assert.equal(purse.quantity, 4);
        assert.deepEqual([coin.ox, coin.oy], [15, 10]);
        assert.equal(floorObjectsAt(level, 15, 10).includes(coin), true);
    });

void test('splitting a heavy coin stack recalculates parent and child weight',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(4050, 29103);
        assert.equal(purse.owt, 41);

        await fireQuiveredGold('l');

        const coin = detachedCoin(level, purse);
        assert.equal(purse.quantity, 4049);
        assert.equal(purse.owt, 40);
        assert.equal(heroGoldAmount(game), 4049);
        assert.equal(coin.owt, 1);
        assert.deepEqual([coin.ox, coin.oy], [15, 10]);
    });

void test('a later wall leaves a quivered coin on the last open path cell',
    async () => {
        const level = freshGameplayRoom();
        level.requireAt(14, 10).typ = STONE;
        const purse = await quiver(5, 29104);

        await fireQuiveredGold('l');

        const coin = detachedCoin(level, purse);
        assert.deepEqual([coin.ox, coin.oy], [13, 10]);
        assert.equal(floorObjectsAt(level, 13, 10).includes(coin), true);
    });

void test('underwater limits a quivered coin to one horizontal cell', async () => {
    const level = freshGameplayRoom();
    const purse = await quiver(5, 29116);
    game.underwater = true;

    await fireQuiveredGold('l');

    const coin = detachedCoin(level, purse);
    assert.deepEqual([coin.ox, coin.oy], [11, 10]);
    assert.equal(floorObjectsAt(level, 11, 10).includes(coin), true);
    assert.equal(purse.quantity, 4);
    assert.equal(game.uquiver, purse);
});

void test('a sleeping greedy monster does not catch a quivered coin on an ordinary miss',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(5, 29105);
        const leprechaun = await createGoldMonster({
            mpeaceful: 1, msleeping: 1,
        });
        initRng(2n);

        await fireQuiveredGold('l');

        const coin = detachedCoin(level, purse);
        assert.equal(leprechaun.msleeping, 1);
        assert.equal(leprechaun.mpeaceful, 1);
        assert.equal(leprechaun.minvent.includes(coin), false);
        assert.equal(floorObjectsAt(level, 13, 10).includes(coin), true);
    });

void test('the one-in-three miss wakeup angers but still does not transfer the coin',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(5, 29107);
        const leprechaun = await createGoldMonster({
            mpeaceful: 1, msleeping: 1,
        });
        initRng(1n);

        await fireQuiveredGold('l', ' ');

        const coin = detachedCoin(level, purse);
        assert.equal(leprechaun.msleeping, 0);
        assert.equal(leprechaun.mpeaceful, 0);
        assert.equal(leprechaun.minvent.includes(coin), false);
        assert.equal(floorObjectsAt(level, 13, 10).includes(coin), true);
    });

void test('targeting can thaw an immobilized monster before the coin misses',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(5, 29109);
        const leprechaun = await createGoldMonster({
            mpeaceful: 1, msleeping: 1,
            mcanmove: 0, mfrozen: 6,
        });
        initRng(13n);

        await fireQuiveredGold('l');

        const coin = detachedCoin(level, purse);
        assert.equal(leprechaun.mcanmove, 1);
        assert.equal(leprechaun.mfrozen, 0);
        assert.equal(leprechaun.msleeping, 1);
        assert.equal(leprechaun.mpeaceful, 1);
        assert.equal(leprechaun.minvent.includes(coin), false);
        assert.equal(floorObjectsAt(level, 13, 10).includes(coin), true);
    });

void test('a swallowed quivered coin wakes the engulfer and enters its inventory',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(5, 29111);
        const engulfer = await createGoldMonster({
            mnum: 202, mx: 10, my: 10,
            mpeaceful: 1, msleeping: 1,
        });
        game.u.uswallow = true;
        game.u.ustuck = engulfer;

        await fireQuiveredGold('l', ' ');

        assert.equal(heroGoldObject(game), purse);
        assert.equal(purse.quantity, 4);
        assert.equal(game.uquiver, purse);
        assert.equal(engulfer.msleeping, 0);
        assert.equal(engulfer.mpeaceful, 0);
        assert.equal(engulfer.minvent.length, 1);
        assert.equal(engulfer.minvent[0]?.quantity, 1);
        assert.equal(engulfer.minvent[0]?.where, 'minvent');
        assert.equal(floorObjects(level).length, 0);
    });

void test('an upward quivered coin falls back, hurts the hero, and leaves the parent ready',
    async () => {
        const level = freshGameplayRoom();
        const purse = await quiver(5, 29113);
        const hpBefore = game.u.uhp;

        await fireQuiveredGold('<');

        const coin = detachedCoin(level, purse);
        assert.ok(hpBefore != null);
        assert.equal(game.u.uhp, hpBefore - 1);
        assert.equal(purse.quantity, 4);
        assert.equal(game.uquiver, purse);
        assert.deepEqual([coin.ox, coin.oy], [10, 10]);
        assert.equal(floorObjectsAt(level, 10, 10).includes(coin), true);
        assert.equal(game.context.move, 1);
    });

void test('a greased quivered coin can slip into a one-coin floor drop', async () => {
    const level = freshGameplayRoom();
    const purse = await quiver(5, 29117);
    purse.greased = true;
    initRng(83n);

    await fireQuiveredGold('l');

    const coin = detachedCoin(level, purse);
    assert.deepEqual([coin.ox, coin.oy], [10, 10]);
    assert.equal(floorObjectsAt(level, 10, 10).includes(coin), true);
    assert.equal(purse.quantity, 4);
    assert.equal(game.uquiver, purse);
});

void test('throwing the last quivered coin transfers its original identity',
    async () => {
        const level = freshGameplayRoom();
        const coin = await quiver(1, 29114);

        await fireQuiveredGold('l');

        assert.equal(heroGoldObject(game), null);
        assert.equal(heroGoldAmount(game), 0);
        assert.equal(game.uquiver, null);
        assert.equal(coin.o_id, 29114);
        assert.equal(coin.quantity, 1);
        assert.equal(coin.where, 'floor');
        assert.deepEqual([coin.ox, coin.oy], [15, 10]);
        assert.equal(floorObjectsAt(level, 15, 10).includes(coin), true);
    });

void test('a web can stop the live detached coin without disturbing the parent',
    async () => {
        const level = freshGameplayRoom();
        const web = addTrap(level, WEB, 12, 10, { tseen: false });
        const purse = await quiver(5, 29115);
        initRng(2n);

        await fireQuiveredGold('l');

        const coin = detachedCoin(level, purse);
        assert.equal(web.tseen, true);
        assert.equal(purse.quantity, 4);
        assert.equal(game.uquiver, purse);
        assert.deepEqual([coin.ox, coin.oy], [12, 10]);
        assert.equal(floorObjectsAt(level, 12, 10).includes(coin), true);
    });
