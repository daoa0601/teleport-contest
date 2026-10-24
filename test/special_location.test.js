import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, ROOM, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { flush_screen } from '../js/display.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { BOULDER } from '../js/object_data.js';
import { initRng, rn2 } from '../js/rng.js';
import { ANY_LOC, DRY, HOT, NO_LOC_WARN, SOLID, SPACELOC, WET, getLocation, getLocationCoord } from '../js/special_location.js';
import { freshGame } from './support/game-state.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
const square = { xstart: 10, ystart: 6, width: 1, height: 1 };
void test('dry placement avoids a boulder unless solid locations are also allowed', async () => {
    const state = freshGame();
    state.level.requireAt(10, 6).typ = ROOM;
    initRng(17);
    const boulder = await mksobj(BOULDER, false, false);
    placeCreatedObject(boulder, 10, 6);
    const dry = await getLocationCoord(square, null, DRY | NO_LOC_WARN);
    const solid = await getLocationCoord(square, null, DRY | SOLID);
    assert.deepEqual(dry, { x: -1, y: -1 });
    assert.deepEqual(solid, { x: 10, y: 6 });
});
const drawbridgeCases = [[WET, DB_MOAT], [HOT, DB_LAVA]];
for (const [humidity, underlying] of drawbridgeCases) {
    void test(`placement accepts a raised drawbridge over ${humidity === WET ? 'water' : 'lava'}`, async () => {
        const state = freshGame();
        const location = state.level.requireAt(10, 6);
        location.typ = DRAWBRIDGE_UP;
        location.drawbridgemask = underlying;
        initRng(17);
        const point = await getLocationCoord(square, null, humidity);
        assert.deepEqual(point, { x: 10, y: 6 });
    });
}
void test('an unsuccessful random placement returns the absent coordinate without warnings', async () => {
    const level = freshPlayableRoom();
    level.requireAt(10, 6).typ = STONE;
    initRng(17);
    const point = await getLocationCoord(square, null, DRY | NO_LOC_WARN);
    assert.deepEqual(point, { x: -1, y: -1 });
    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), '');
});
void test('explicit coordinates use the map origin and retain ANY_LOC coordinates outside the level', async () => {
    freshGame();
    const point = await getLocationCoord(square, { x: 80, y: 25 }, ANY_LOC);
    const absent = await getLocationCoord(square, { x: 80, y: 25 }, DRY | NO_LOC_WARN);
    assert.deepEqual(point, { x: 90, y: 31 });
    assert.deepEqual(absent, { x: -1, y: -1 });
});
void test('the water plane accepts terrain even when a placement filter rejects it', async () => {
    const state = freshGame();
    game.water_level = { ...state.u.uz, flags: { town: false }, alignment: null };
    state.level.requireAt(10, 6).typ = STONE;
    initRng(17);
    const point = await getLocationCoord(square, null, DRY, () => false);
    assert.deepEqual(point, { x: 10, y: 6 });
});
void test('a failed raw location search samples 100 pairs before returning no location', async () => {
    freshPlayableRoom();
    initRng(17);
    for (let attempt = 0; attempt < 100; attempt++) {
        rn2(1);
        rn2(1);
    }
    const followingRoll = rn2(10000);
    initRng(17);
    const point = await getLocation(square, { x: -2, y: 0 }, DRY | NO_LOC_WARN);
    assert.deepEqual(point, { x: -1, y: -1 });
    assert.equal(rn2(10000), followingRoll);
});
void test('an exhausted random coordinate retries its default humidity before the following roll', async () => {
    freshPlayableRoom();
    initRng(17);
    for (let attempt = 0; attempt < 200; attempt++) {
        rn2(1);
        rn2(1);
    }
    const followingRoll = rn2(10000);
    initRng(17);
    const point = await getLocationCoord(square, null, DRY | NO_LOC_WARN);
    assert.deepEqual(point, { x: -1, y: -1 });
    assert.equal(rn2(10000), followingRoll);
});
void test('the fallback scan finds a dry square after random sampling misses it', async () => {
    const state = freshGame();
    const area = { xstart: 1, ystart: 0, width: 79, height: 21 };
    const sampled = new Set();
    initRng(17);
    for (let attempt = 0; attempt < 100; attempt++)
        sampled.add(`${1 + rn2(79)},${rn2(21)}`);
    const followingRoll = rn2(10000);
    const y = Array.from({ length: 21 }, (_, index) => index)
        .find(row => !sampled.has(`1,${row}`));
    assert.ok(y !== undefined, 'the fixture needs an unsampled square');
    state.level.requireAt(1, y).typ = ROOM;
    initRng(17);
    const point = await getLocation(area, { x: -1, y: -1 }, DRY);
    assert.deepEqual(point, { x: 1, y });
    assert.equal(rn2(10000), followingRoll);
});
void test('SPACELOC accepts the same floor as DRY without advancing an extra random draw', async () => {
    const state = freshGame();
    state.level.requireAt(10, 6).typ = ROOM;
    initRng(17);
    rn2(1);
    rn2(1);
    const followingRoll = rn2(10000);
    initRng(17);
    const point = await getLocationCoord(square, null, SPACELOC);
    assert.deepEqual(point, { x: 10, y: 6 });
    assert.equal(rn2(10000), followingRoll);
});
void test('an exhausted warned search reports the failure and retains the last scanned square', async () => {
    freshPlayableRoom();
    game.program_state.in_sanity_check = true;
    initRng(17);
    for (let attempt = 0; attempt < 100; attempt++) {
        rn2(1);
        rn2(1);
    }
    const followingRoll = rn2(10000);
    initRng(17);
    const point = await getLocation(square, { x: -1, y: -1 }, DRY);
    await flush_screen(1);
    assert.deepEqual(point, { x: 10, y: 6 });
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /get_location:  can't find a place!/);
    assert.equal(rn2(10000), followingRoll);
});
void test('a raw endpoint with a nonnegative x keeps its negative y instead of sampling', async () => {
    freshGame();
    initRng(17);
    const followingRoll = rn2(10000);
    initRng(17);
    const point = await getLocation(square, { x: 0, y: -2 }, ANY_LOC);
    assert.deepEqual(point, { x: 10, y: 4 });
    assert.equal(rn2(10000), followingRoll);
});
//# sourceMappingURL=special_location.test.js.map