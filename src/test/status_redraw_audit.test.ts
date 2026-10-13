import assert from 'node:assert/strict';
import test from 'node:test';
import { removeHeroAccessory, wearHeroAccessory } from '../js/accessory.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { makeDeaf } from '../js/hero_hearing.js';
import { pushKeys } from '../js/input.js';
import { playInstrument } from '../js/music.js';
import {
    AMULET_OF_STRANGULATION, LEATHER_DRUM, OBJECT_NAMES,
} from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

function status(row = 23): string {
    return requireScreenRow(row).map(cell => cell.ch).join('');
}

void test('wearing and removing a strength ring updates displayed strength', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain strength'), { spe: 2 });
    await bot();

    await wearHeroAccessory(ring, 'uleft');
    await flush_screen(1);
    assert.match(status(22), /St:14\b/);

    await removeHeroAccessory(ring);
    await flush_screen(1);
    assert.match(status(22), /St:12\b/);
});

void test('a strangulation amulet displays its condition until removed', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_STRANGULATION);
    await bot();
    pushKeys(' '.repeat(10));

    await wearHeroAccessory(amulet, 'uamul');
    await flush_screen(1);
    assert.match(status(), /\bStrngl\b/);

    await removeHeroAccessory(amulet);
    await flush_screen(1);
    assert.doesNotMatch(status(), /\bStrngl\b/);
});

void test('a leather drum displays deafness after its deafening row', async () => {
    freshObjectRoom();
    const drum = await addInventoryObject(LEATHER_DRUM);
    await bot();
    pushKeys('y' + ' '.repeat(10));

    await playInstrument(drum);
    await flush_screen(1);

    assert.match(status(), /\bDeaf\b/);
});

void test('curing timed deafness removes the displayed condition', async () => {
    freshObjectRoom();
    await makeDeaf(5, { talk: false });
    await bot();

    await makeDeaf(0, { talk: false });
    await flush_screen(1);

    assert.doesNotMatch(status(), /\bDeaf\b/);
});

void test('a levitation ring displays Lev while worn and clears it on landing', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('levitation'));
    await bot();
    pushKeys(' '.repeat(10));

    await wearHeroAccessory(ring, 'uleft');
    await flush_screen(1);
    assert.match(status(), /\bLev\b/);

    await removeHeroAccessory(ring);
    await flush_screen(1);
    assert.doesNotMatch(status(), /\bLev\b/);
});
