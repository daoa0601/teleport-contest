import { placeCreatedObject } from '../js/floor_object.js';
import type { KnownObjectOverrides } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { ROOM, SINK } from '../js/const.js';
import { dropRingIntoSink } from '../js/ring_sink.js';
import { initRng, rn2 } from '../js/rng.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function collector() {
    const messages: string[] = [];
    return { messages, publish: (text: string) => { messages.push(text); } };
}

async function ringNamed(name: string, overrides: KnownObjectOverrides = {}) {
    const index = OBJECT_NAMES.indexOf(name);
    return await knownObject(index, overrides);
}

function heroOnSink() {
    freshObjectRoom({ gameplaySeed: 909n });
    requirePlayingGame(game);
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = SINK;
    return game.u;
}

// teleport_sink() only accepts plain room squares far from the hero; the
// test level must offer many of them.
function fillLevelWithRooms() {
    for (let x = 1; x < 80; x++)
        for (let y = 0; y < 21; y++)
            requireGameLevel().requireAt(x, y).typ = ROOM;
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = SINK;
}

function sinkSquares() {
    const squares = [];
    for (let x = 1; x < 80; x++)
        for (let y = 0; y < 21; y++)
            if (requireGameLevel().requireAt(x, y)?.typ === SINK) squares.push([x, y]);
    return squares;
}

void test('a slow digestion ring is regurgitated onto the floor', async () => {
    heroOnSink();
    const ring = await ringNamed('slow digestion');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    assert.ok(log.messages.some(text =>
        /regurgitated/.test(text)));
    assert.ok(log.messages[0]?.includes('down the drain'));
    assert.ok(floorObjectsAt(requireGameLevel(), game.u.ux, game.u.uy).includes(ring),
        'the ring must return to the sink square floor');
    assert.ok(game.inventory.includes(ring) === false);
});

void test('a levitation ring only makes the sink quiver and is consumed', async () => {
    heroOnSink();
    const ring = await ringNamed('levitation');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    assert.ok(log.messages.some(text =>
        /sink quivers upward/.test(text)));
    const pile = requireGameLevel().objects?.[game.u.ux]?.[game.u.uy] || [];
    const onFloor = pile.includes(ring);
    const buried = (requireGameLevel().buriedObjects || []).includes(ring);
    assert.ok(!game.inventory.includes(ring));
    // exactly one disposition for a consumed-or-buried-or-returned ring
    assert.ok(onFloor !== buried, 'exactly one of floor/buried');
});

void test('a teleportation ring moves the sink elsewhere on the level', async () => {
    heroOnSink();
    fillLevelWithRooms();
    const levelFlags = requireGameLevel().flags;
    levelFlags.nsinks = 1;
    levelFlags.nfountains = 0;
    const ring = await ringNamed('teleportation');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    // With abundant distant room squares the sink must actually relocate.
    assert.ok(log.messages.includes('The sink vanishes.'));
    assert.equal(requireGameLevel().requireAt(game.u.ux, game.u.uy).typ, ROOM);
    const sinks = sinkSquares();
    assert.equal(sinks.length, 1);
    assert.notDeepEqual(sinks[0], [game.u.ux, game.u.uy]);
    assert.equal(requireGameLevel().flags.nsinks, 1); // one removed, one added
});

void test('a hunger ring destroys the floor pile around the drain', async () => {
    heroOnSink();
    const ring = await ringNamed('hunger');
    game.inventory = [ring];
    const potion = await ringNamed('levitation');
    placeCreatedObject(potion, game.u.ux, game.u.uy);
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    assert.ok(log.messages.some(text => /vanishes from the sink/.test(text)));
    assert.equal(potion.where, 'gone');
    assert.deepEqual(floorObjectsAt(requireGameLevel(), game.u.ux, game.u.uy), []);
});

void test('a blind hero still feels the levitation quiver, no drainpipe', async () => {
    heroOnSink();
    game.u.blindTurns = 5;
    const ring = await ringNamed('levitation');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    // LEVITATION is in the eyeless switch: blindness cannot hide it, and
    // ideed stays true so the drainpipe line never plays.
    assert.ok(log.messages.some(text => /sink quivers upward/.test(text)));
    assert.ok(!log.messages.some(text =>
        /ring bouncing down the drainpipe/.test(text)));
});

void test('a blind hero misses the visual-only adornment and hears the drainpipe', async () => {
    heroOnSink();
    game.u.blindTurns = 5;
    const ring = await ringNamed('adornment');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    // ADORNMENT's faucet flash is eyes-only: unseen and unidentified, so
    // the drainpipe tail is the only feedback.
    assert.ok(!log.messages.some(text => /faucets flash/.test(text)));
    assert.ok(log.messages.some(text =>
        /ring bouncing down the drainpipe/.test(text)));
});

void test('a deaf hero hears nothing at all', async () => {
    heroOnSink();
    game.u.deafTurns = 5;
    const ring = await ringNamed('conflict');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    assert.ok(!log.messages.some(text =>
        /loud noises|drainpipe/.test(text)));
});

void test('a polymorph ring replaces the sink with other furniture', async () => {
    heroOnSink();
    // C mksink() leaves nsinks one too high; set_levltyp() recounts it.
    requireGameLevel().flags.nsinks = 2;
    requireGameLevel().requireAt(game.u.ux, game.u.uy).looted = 1;
    const ring = await ringNamed('polymorph');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    assert.ok(log.messages.some(text =>
        /transforms into|sink vanishes/.test(text)));
    const location = requireGameLevel().requireAt(game.u.ux, game.u.uy);
    assert.notEqual(location.typ, SINK);
    // set_levltyp() recounts the map: no sink remains, and only the
    // fountain outcome leaves a fountain.
    assert.equal(requireGameLevel().flags.nsinks, 0);
    if (location.typ === 28 /* FOUNTAIN */) {
        assert.equal(requireGameLevel().flags.nfountains, 1);
        assert.equal(location.looted, 1); // looted state carries over
        assert.equal(location.blessedftn, 0);
    } else {
        assert.equal(requireGameLevel().flags.nfountains, 0);
        if (location.typ === 32 /* ALTAR */)
            assert.equal(location.looted, 0); // union clear, no carry
    }
});

void test('a hunger ring over an empty drain destroys nothing quietly', async () => {
    heroOnSink();
    const ring = await ringNamed('hunger');
    game.inventory = [ring];
    const log = collector();

    await dropRingIntoSink(ring, { publish: log.publish });

    assert.ok(!log.messages.some(text =>
        /vanishes from the sink/.test(text)));
    const pile = requireGameLevel().objects?.[game.u.ux]?.[game.u.uy] || [];
    assert.deepEqual(pile, []);
    assert.ok(!game.inventory.includes(ring));
});
