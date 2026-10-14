import test from 'node:test';
import assert from 'node:assert/strict';
import { W_SADDLE } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { SADDLE } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('apply equips a tame pony with a carried saddle and wakes it', async () => {
    freshPlayableRoom({ hero: { ulevel: 10 } });
    const pony = await createMonsterAt('pony', game.u.ux + 1, game.u.uy);
    initializePet(pony);
    pony.msleeping = 1;
    const saddle = await addInventoryObject(SADDLE);

    await applyInventoryObject(saddle, 'l  ');

    assert.equal(saddle.where, 'minvent');
    assert.equal(saddle.owornmask, W_SADDLE);
    assert.equal(saddle.leashmon, pony.m_id);
    assert.equal(pony.msleeping, 0);
    assert.ok((pony.misc_worn_check ?? 0) & W_SADDLE);
    assert.equal(game.context.move, 1);
});

void test('a saddled creature refuses a second saddle', async () => {
    freshPlayableRoom();
    const pony = await createSaddledSteed();
    const original = pony.saddle;
    const saddle = await addInventoryObject(SADDLE);

    await applyInventoryObject(saddle, 'l');

    assert.equal(saddle.where, 'inventory');
    assert.equal(pony.saddle, original);
    assert.match(game._pending_message, /doesn't need another one/);
    assert.equal(game.context.move, 1);
});

void test('a kitten cannot wear a saddle', async () => {
    freshPlayableRoom();
    await createMonsterAt('kitten', game.u.ux + 1, game.u.uy);
    const saddle = await addInventoryObject(SADDLE);

    await applyInventoryObject(saddle, 'l');

    assert.equal(saddle.where, 'inventory');
    assert.equal(game._pending_message, "You can't saddle such a creature.");
    assert.equal(game.context.move, 1);
});
