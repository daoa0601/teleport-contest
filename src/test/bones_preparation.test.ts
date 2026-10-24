import assert from 'node:assert/strict';
import test from 'node:test';

import { createBonesFromDeath } from '../js/bones_death.js';
import { LEAVESTATUE, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { LEASH } from '../js/object_data.js';
import { punishHero } from '../js/punishment.js';
import { init_objects } from '../js/o_init.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

function dyingHero(): void {
    freshPlayableRoom({ hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.storage = memoryStorage();
    game._canMakeBones = true;
    init_objects();
}

void test('saving bones releases the dead hero leashes before dropping them', async () => {
    dyingHero();
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    dog.mtame = 10;
    dog.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: dog.m_id });

    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);

    assert.equal(dog.mleashed, 0);
    assert.equal(leash.leashmon, 0);
});

void test('saving bones discards the punishment chain and leaves an unworn ball', async () => {
    dyingHero();
    requirePlayingGame(game);
    await punishHero();
    const ball = game.uball;
    const chain = game.uchain;
    assert.ok(ball);
    assert.ok(chain);

    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);

    assert.equal(game.u.punished, false);
    assert.equal(game.uball, null);
    assert.equal(ball.owornmask, 0);
    assert.ok(floorObjects(game.level).includes(ball));
    assert.equal(floorObjects(game.level).includes(chain), false);
});

void test('saving bones dismounts the dead hero and moves the living steed aside', async () => {
    dyingHero();
    requirePlayingGame(game);
    const pony = await createMonsterAt('pony', 10, 10, NO_MINVENT);
    placeMonsterAt(pony, 10, 10);
    game.u.usteed = pony;

    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);

    assert.equal(game.u.usteed, null);
    assert.ok(pony.mx !== 10 || pony.my !== 10, 'the steed must leave room for the ghost');
    assert.ok(pony.mhp > 0, 'bones dismounting must keep the living steed');
});

void test('gear embedded in the dead hero statue remains ghostly', async () => {
    dyingHero();
    game.u.ugrave_arise = LEAVESTATUE;
    const leash = await addInventoryObject(LEASH);

    assert.equal(await createBonesFromDeath('petrified by a cockatrice', async () => 'y'), true);

    assert.equal(leash.where, 'contained');
    assert.equal(leash.ghostly, true);
});
