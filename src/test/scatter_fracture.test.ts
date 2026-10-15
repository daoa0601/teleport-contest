import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { BOULDER, STATUE, ROCK } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('scattering a named statue leaves unnamed ordinary rock fragments', async () => {
    const level = freshObjectRoom();
    const statue = await floorObject(STATUE, 14, 10, { oname: 'Old King', spe: 1, corpsenm: 0 });

    await scatterFloorObjects(14, 10, 1, {
        mayDestroy: false, random: () => 1, rollOne: () => 1,
        publish: async () => {},
    });

    assert.equal(statue.otyp, ROCK);
    assert.equal(statue.oname, undefined);
    assert.equal(statue.spe, 0);
    assert.ok(level.objects.flat(2).includes(statue));
});

void test('a hero who fractures a Sokoban boulder by scattering it loses luck', async () => {
    const level = freshObjectRoom();
    level.flags.sokoban_rules = true;
    await floorObject(BOULDER, 14, 10);
    const luck = game.u.uluck ?? 0;

    await scatterFloorObjects(14, 10, 1, {
        mayDestroy: false, random: () => 1, rollOne: () => 1,
        publish: async () => {},
    });

    assert.equal(game.u.uluck, luck - 1);
    assert.equal(game.u.uconduct?.sokocheat, 1);
});
