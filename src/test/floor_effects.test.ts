import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireGameLevel, game } from '../js/gstate.js';
import { landFloorObject } from '../js/floor_effects.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { unlinkObject } from '../js/object_location.js';
import { learnObjectType } from '../js/object_knowledge.js';
import { CHEST, FIRE_HORN, GLOB_OF_BLACK_PUDDING, GOLD_PIECE, POT_HEALING, SPE_BOOK_OF_THE_DEAD } from '../js/object_data.js';
import { LAVAPOOL } from '../js/const.js';
import { initRng } from '../js/rng.js';
import { pushKeys } from '../js/input.js';
import { plineWithContinuation } from '../js/display.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { waterDamageObject } from '../js/trap.js';
import { cansee } from '../js/vision.js';
import { meldNearbyFloorGlobs } from '../js/glob.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a fire horn survives landing in lava', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(12, 10).typ = LAVAPOOL;
    const horn = await knownObject(FIRE_HORN);
    const messages: string[] = [];

    await landFloorObject(horn, 12, 10, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(horn.where, 'floor');
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(horn));
    assert.equal(messages.some(message => message.includes('burn')), false);
});

void test('a chest burning in lava spills surviving contents onto its square', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(12, 10).typ = LAVAPOOL;
    const chest = await knownObject(CHEST, { initialize: false });
    const gold = await knownObject(GOLD_PIECE, { quan: 20 });
    await addCreatedObjectToContainer(chest, gold, game);
    const messages: string[] = [];

    await landFloorObject(chest, 12, 10, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(chest.where, 'gone');
    assert.equal(gold.where, 'floor');
    assert.equal(gold.container, null);
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(gold));
    assert.ok(messages.includes('Its contents fall out.'));
});

void test('a potion broken by hot ground affects the hero near its landing, not its old position', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhpmax: 40 } });
    requireFixtureGame(game);
    game.level.flags.temperature = 1;
    learnObjectType(POT_HEALING);
    const potion = await knownObject(POT_HEALING);
    placeCreatedObject(potion, 16, 10);
    unlinkObject(potion);
    initRng(4n);
    pushKeys('                                        ');

    await landFloorObject(potion, 11, 10, { publish: plineWithContinuation });

    assert.equal(potion.where, 'gone');
    assert.equal(game.u.uhp, 21);
});

void test('a free Book of the Dead does not show steam at its old visible location', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const book = await knownObject(SPE_BOOK_OF_THE_DEAD);
    placeCreatedObject(book, 12, 10);
    assert.equal(cansee(12, 10), true);
    unlinkObject(book);
    const messages: string[] = [];

    await waterDamageObject(book, messages, game, { force: true });

    assert.deepEqual(messages, []);
    assert.equal(book.otyp, SPE_BOOK_OF_THE_DEAD);
});

void test('a carried Book of the Dead shows steam at the hero rather than stale coordinates', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD);
    book.ox = book.oy = 0;
    const messages: string[] = [];

    await waterDamageObject(book, messages, game, { force: true });

    assert.ok(messages.includes('Steam rises from the Book of the Dead.'));
    assert.equal(book.otyp, SPE_BOOK_OF_THE_DEAD);
});

void test('a heavier landing glob is absorbed by the smaller glob already on the floor', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const settled = await knownObject(GLOB_OF_BLACK_PUDDING);
    const landing = await knownObject(GLOB_OF_BLACK_PUDDING);
    landing.owt = 2 * settled.owt;
    const totalWeight = settled.owt + landing.owt;
    placeCreatedObject(settled, 12, 10);
    pushKeys('                    ');

    await landFloorObject(landing, 11, 10, { publish: plineWithContinuation });

    assert.equal(landing.where, 'gone');
    assert.ok(floorObjectsAt(requireGameLevel(game), 12, 10).includes(settled));
    assert.equal(settled.owt, totalWeight);
});

void test('floor glob merging reveals a monster when its cover disappears', async () => {
    freshObjectRoom();
    const large = await knownObject(GLOB_OF_BLACK_PUDDING);
    const cover = await knownObject(GLOB_OF_BLACK_PUDDING);
    large.owt = 2 * cover.owt;
    placeCreatedObject(large, 11, 10);
    placeCreatedObject(cover, 12, 10);
    const hider = await createMonsterAt('scorpion', 12, 10);
    hider.mundetected = 1;
    pushKeys('                    ');

    await meldNearbyFloorGlobs(large);

    assert.equal(cover.where, 'gone');
    assert.equal(hider.mundetected, 0);
});
