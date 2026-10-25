import assert from 'node:assert/strict';
import test from 'node:test';

import { A_STR, STR19, TT_INFLOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { remove_object } from '../js/floor_object.js';
import { addInventoryItem } from '../js/u_init.js';
import { HEAVY_IRON_BALL } from '../js/object_data.js';
import { punishHero } from '../js/punishment.js';
import { initRng } from '../js/rng.js';
import type { GameObject } from '../js/object_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';

// A punished hero carrying the attached ball: unlink the floor ball and hold
// it, the state pickup leaves behind when the ball is picked up.
async function holdAttachedBall(): Promise<GameObject> {
    resetInputState();
    await punishHero();
    const ball = game.uball;
    if (!ball || !game.uchain) {
        throw new Error('punishing the hero must attach a ball and chain');
    }
    remove_object(ball);
    await addInventoryItem(ball, null, false);
    return ball;
}

void test('a strong hero throws a loose heavy iron ball its rolling range', async () => {
    freshObjectRoom({ right: 35 });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const ball = await addInventoryObject(HEAVY_IRON_BALL);
    initRng(910n);

    await throwInventoryObject(ball);

    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 18);
    assert.equal(ball.oy, 10);
});

void test('a punished hero throws the chained ball no further than the chain', async () => {
    const level = freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const ball = await holdAttachedBall();
    const chain = game.uchain;
    initRng(911n);

    await throwInventoryObject(ball);

    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 15);
    assert.equal(ball.oy, 10);
    assert.ok(floorObjectsAt(level, 15, 10).includes(ball));
    assert.ok(chain && chain.where === 'floor' && chain.ox === 14 && chain.oy === 10,
        'the chain is dragged behind the thrown ball');
});

void test('a hero held by a monster throws the chained ball only one square', async () => {
    freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const ball = await holdAttachedBall();
    const holder = await createMonsterAt('ogre', 12, 8);
    game.u.ustuck = holder;
    initRng(912n);

    await throwInventoryObject(ball);

    assert.equal(holder.mx, 12);
    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 11);
    assert.equal(ball.oy, 10);
});

void test('a hero stuck in the floor throws the chained ball one square', async () => {
    freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const ball = await holdAttachedBall();
    game.u.utrap = 5;
    game.u.utraptype = TT_INFLOOR;
    initRng(913n);

    await throwInventoryObject(ball);

    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 11);
    assert.equal(ball.oy, 10);
});
