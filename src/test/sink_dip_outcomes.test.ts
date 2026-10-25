import test from 'node:test';
import assert from 'node:assert/strict';
import { SINK, S_LRING, FOUNTAIN, F_LOOTED } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_ACID, POT_FRUIT_JUICE, POT_LEVITATION,
    POT_OBJECT_DETECTION, POT_OIL, POT_POLYMORPH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPropertyTimeout } from '../js/properties.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const RING_CLASS = 4;

function dipRoom() {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = SINK;
    return level;
}

async function dipPotion(otyp: number, seed: bigint) {
    const level = dipRoom();
    const potion = await addInventoryObject(otyp);
    potion.dknown = true;
    resetInputState().feed('');
    initRng(seed);
    await runExtendedCommand('dip', potion.invlet + 'y' + ' '.repeat(20));
    return { level, potion, sink: level.requireAt(10, 10) };
}

// fountain.c:dipsink() POT_LEVITATION: sink_backs_up() announces the splash,
// leaves a real ring, and marks the drain so it can only happen once.
void test('pouring levitation down the drain backs the sink up with a ring', async () => {
    const { level, potion, sink } = await dipPotion(POT_LEVITATION, 1n);

    assert.match(game._pending_message, /ring shining in its midst\./);
    const rings = (level.objects[10]?.[10] || []).filter(object => object.oclass === RING_CLASS);
    assert.equal(rings.length, 1);
    assert.ok(Number(sink.looted ?? 0) & S_LRING);
    assert.equal(game.inventory.includes(potion), false, 'The poured potion is used up');
    assert.equal(game.context.move, 1);
});

// fountain.c:dipsink() POT_OIL: the film message only reaches a sighted hero,
// and the potion is spent either way.
void test('oil poured down the drain leaves an oily film', async () => {
    const { potion } = await dipPotion(POT_OIL, 1n);

    assert.equal(game._pending_message, 'It leaves an oily film on the basin.');
    assert.equal(game.inventory.includes(potion), false);
});

// fountain.c:dipsink() POT_ACID: the drain-clearing message for a sighted hero.
void test('acid acts as a drain cleaner', async () => {
    const { potion } = await dipPotion(POT_ACID, 1n);

    assert.equal(game._pending_message, 'The drain seems less clogged.');
    assert.equal(game.inventory.includes(potion), false);
});

// fountain.c:dipsink(): fruit juice belongs to the potions with no observable
// effect; the potion is still gone.
void test('fruit juice poured down the drain does nothing observable', async () => {
    const { potion, sink } = await dipPotion(POT_FRUIT_JUICE, 1n);

    assert.equal(game._pending_message, 'Nothing seems to happen.');
    assert.equal(game.inventory.includes(potion), false);
    assert.equal(sink.typ, SINK);
});

// fountain.c:dipsink() POT_OBJECT_DETECTION on an unlooted sink senses the
// ring without surfacing it.
void test('object detection senses the ring lost down the drain', async () => {
    const { level } = await dipPotion(POT_OBJECT_DETECTION, 1n);

    assert.equal(game._pending_message, 'You sense a ring lost down the drain.');
    assert.equal((level.objects[10]?.[10] || []).length, 0,
        'Sensing the ring does not move it out of the drain');
});

// fountain.c:dipsink() POT_POLYMORPH: polymorph_sink() replaces the sink with
// another feature and reports the transformation.
void test('polymorph poured down the drain replaces the sink', async () => {
    const { sink } = await dipPotion(POT_POLYMORPH, 3n);

    assert.match(game._pending_message, /The sink transforms into /);
    assert.notEqual(sink.typ, SINK);
});

// fountain.c:dipsink() '-' dip: wash_hands() instead of water damage.
void test('dipping bare hands into a sink washes them', async () => {
    dipRoom();
    resetInputState().feed('');
    initRng(1n);
    await runExtendedCommand('dip', '-y' + ' '.repeat(20));

    assert.equal(game._pending_message, 'You wash your hands in the water.');
});

// fountain.c:dipsink(): the rare pipe break converts the sink into an already
// looted fountain; slippery hands stay slippery through it.
void test('a breaking sink keeps slippery hands slippery', async () => {
    const level = dipRoom();
    setPropertyTimeout('glib', 10);
    resetInputState().feed('');
    initRng(7n);
    await runExtendedCommand('dip', '-y' + ' '.repeat(20));

    const sink = level.requireAt(10, 10);
    assert.equal(sink.typ, FOUNTAIN);
    assert.ok(Number(sink.looted ?? 0) & F_LOOTED);
    assert.match(game._pending_message, /pipes break!  Water spurts out!/);
    assert.match(game._pending_message, /Your fingers are still slippery\./);
});
