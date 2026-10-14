import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription } from '../js/cmd.js';
import { SCORR } from '../js/const.js';
import { map_object, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DAGGER, STATUE } from '../js/object_data.js';
import { objectDescription } from '../js/object_description.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('farlook describes the species depicted by a floor statue', async () => {
    freshObjectRoom();
    const statue = await floorObject(STATUE, 11, 10, {
        corpsenm: MONSTER_NAME.indexOf('plains centaur'), cknown: false, bknown: false,
    });
    newsym(11, 10);

    assert.equal(await farlookLocationDescription(11, 10), 'a statue of a plains centaur');
    assert.equal(statue.where, 'floor');
});

void test('farlook leaves the quantity of an unobserved distant stack vague', async () => {
    freshObjectRoom();
    const daggers = await floorObject(DAGGER, 15, 10, {
        quan: 6, dknown: false, known: false, bknown: false,
    });
    newsym(15, 10);

    assert.equal(await farlookLocationDescription(15, 10), 'some daggers');
    assert.equal(daggers.quan, 6);
    assert.equal(daggers.dknown, false);
});

void test('farlook describes an object in an arboreal secret corridor as embedded in stone', async () => {
    const level = freshObjectRoom();
    level.flags.arboreal = true;
    level.requireAt(11, 10).typ = SCORR;
    const dagger = await floorObject(DAGGER, 11, 10, { known: false, bknown: false });
    map_object(dagger);

    assert.equal(await farlookLocationDescription(11, 10), 'a dagger embedded in stone');
});

void test('temporary identification shows exact quantities in a vague object description', async () => {
    freshObjectRoom();
    const daggers = await floorObject(DAGGER, 15, 10, {
        quan: 6, dknown: false, known: false, bknown: false,
    });
    game.iflags.override_ID = true;

    assert.match(objectDescription(daggers, { vagueQuantity: true }), /^6 /);
    assert.equal(daggers.dknown, false, 'temporary identification does not learn the appearance');
});
