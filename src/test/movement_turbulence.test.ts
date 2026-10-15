import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
import { ROCK } from '../js/object_data.js';

void test('a hero without flight or levitation can lose a move to air turbulence', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.air_level = createSpecialLevel({ ...game.u.uz });
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /tumble in place|control your movements|hard to walk in thin air/);
});

for (const property of ['flying', 'levitation']) {
    void test(`${property} gives control of movement on the Plane of Air`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
    game.air_level = createSpecialLevel({ ...game.u.uz });
        if (property === 'flying') grantIntrinsicProperty('flying', 'outside');
        else grantIntrinsicProperty('levitation', 'outside');
        initRng(1n);

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    });
}

void test('water turbulence can leave a submerged hero in place for the turn', async () => {
    const level = freshObjectRoom({ hero: { uinwater: 1 } });
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++) level.requireAt(x, y).typ = POOL;
    grantIntrinsicProperty('magicalBreathing', 'outside');
    initRng(12n);
    pushKeys(' '.repeat(20));

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'Water turbulence affects your movements.');
});

void test('a heavily laden nonswimmer cannot climb out of water', async () => {
    const level = freshObjectRoom({ hero: { uinwater: 1 } });
    level.requireAt(10, 10).typ = POOL;
    grantIntrinsicProperty('magicalBreathing', 'outside');
    await addInventoryObject(ROCK, { quan: 100 });
    initRng(2n);
    pushKeys(' '.repeat(20));

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You are carrying too much to climb out of the water.');
});
