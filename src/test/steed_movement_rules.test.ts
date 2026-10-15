import assert from 'node:assert/strict';
import test from 'node:test';

import { DB_ICE, DOOR, DRAWBRIDGE_UP, D_CLOSED, IRONBARS, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

function ridingRoom() {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 }, flags: { pickup: false } });
    installPagerInput(resetInputState(), {
        expected: /mount|dungeon on|boulder|ice|slippery/,
        limit: 8,
    });
}

void test('mounting can reach a steed standing on a boulder without pushing it', async () => {
    ridingRoom();
    const pony = await createSaddledSteed();
    const boulder = await floorObject(BOULDER, pony.mx, pony.my);

    await runExtendedCommand('ride', 'l');

    assert.equal(game.u.usteed, pony);
    assert.equal(game.u.ux, 11);
    assert.equal(boulder.ox, 11);
    assert.equal(boulder.oy, 10);
    assert.equal(boulder.where, 'floor');
    assert.equal(game.context.move, 1);
});

void test('a dismount can land among boulders when every adjacent square has one', async () => {
    ridingRoom();
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    const x = game.u.ux, y = game.u.uy;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx || dy) await floorObject(BOULDER, x + dx, y + dy);
        }
    }

    await runExtendedCommand('ride');

    assert.equal(game.u.usteed, null);
    assert.equal(Math.abs(game.u.ux - x) + Math.abs(game.u.uy - y), 1);
    assert.equal(pony.mx, x);
    assert.equal(pony.my, y);
});

void test('a wall-passing rider can mount diagonally through a closed doorway', async () => {
    ridingRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed('pony', { x: 11, y: 11 });
    const door = game.level.requireAt(11, 11);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    grantIntrinsicProperty('passesWalls', 'outside');

    await runExtendedCommand('ride', 'n');

    assert.equal(game.u.usteed, pony);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 11);
    assert.equal(door.doormask, D_CLOSED);
});

void test('iron bars prevent a rider from reaching a steed', async () => {
    ridingRoom();
    requirePlayingGame(game);
    await createSaddledSteed();
    game.level.requireAt(11, 10).typ = IRONBARS;

    await runExtendedCommand('ride', 'l');

    assert.ok(!game.u.usteed);
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 0);
    assert.match(game._last_message, /unable to swing your leg over/);
});

void test('a worm crossing blocks the diagonal reach to a steed', async () => {
    ridingRoom();
    await createSaddledSteed('pony', { x: 11, y: 11 });
    const worm = await createMonsterAt('long worm', 12, 10);
    worm.wormSegments = [{ x: 11, y: 10 }, { x: 10, y: 11 }];

    await runExtendedCommand('ride', 'n');

    assert.ok(!game.u.usteed);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(game.context.move, 0);
});

void test('dismounting can land on the ice beneath a raised drawbridge', async () => {
    ridingRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    const x = game.u.ux, y = game.u.uy;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx || dy) game.level.requireAt(x + dx, y + dy).typ = STONE;
        }
    }
    const bridge = game.level.requireAt(x + 1, y);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_ICE;

    await runExtendedCommand('ride');

    assert.equal(game.u.usteed, null);
    assert.equal(game.u.ux, x + 1);
    assert.equal(game.u.uy, y);
});
