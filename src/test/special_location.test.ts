import test from 'node:test';
import assert from 'node:assert/strict';

import { DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, ROOM, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { ANY_LOC, DRY, HOT, NO_LOC_WARN, SOLID, WET, getLocationCoord } from '../js/special_location.js';
import { freshGame } from './support/game-state.js';

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

const drawbridgeCases: readonly [number, number][] = [[WET, DB_MOAT], [HOT, DB_LAVA]];
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
    const state = freshGame();
    state.level.requireAt(10, 6).typ = STONE;
    initRng(17);

    const point = await getLocationCoord(square, null, DRY | NO_LOC_WARN);

    assert.deepEqual(point, { x: -1, y: -1 });
    assert.equal(state.program_state.in_impossible, undefined);
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
