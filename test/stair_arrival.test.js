import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, STAIRS } from '../js/const.js';
import { u_on_downstairs, u_on_upstairs } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
void test('descending cannot arrive at a downward branch stair', async () => {
    const state = freshGame();
    initRng(42);
    state.level.requireAt(20, 10).typ = ROOM;
    state.level.requireAt(2, 2).typ = STAIRS;
    state.stairs = {
        sx: 2, sy: 2, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 1 }, next: null,
    };
    await u_on_upstairs();
    assert.equal(state.u.ux, 20);
    assert.equal(state.u.uy, 10);
});
void test('ascending cannot arrive at an upward branch stair', async () => {
    const state = freshGame();
    initRng(42);
    state.level.requireAt(20, 10).typ = ROOM;
    state.level.requireAt(2, 2).typ = STAIRS;
    state.stairs = {
        sx: 2, sy: 2, up: true, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 1 }, next: null,
    };
    await u_on_downstairs();
    assert.equal(state.u.ux, 20);
    assert.equal(state.u.uy, 10);
});
void test('descending without stairs honors downward arrival exclusions', async () => {
    const state = freshGame();
    initRng(42);
    state.level.requireAt(20, 10).typ = ROOM;
    state.level.requireAt(21, 10).typ = ROOM;
    state.level.exclusionZones.push({ type: 'teleport-down', lx: 20, ly: 10, hx: 20, hy: 10 }, { type: 'teleport-up', lx: 21, ly: 10, hx: 21, hy: 10 });
    await u_on_upstairs();
    assert.equal(state.u.ux, 21);
    assert.equal(state.u.uy, 10);
});
void test('ascending without stairs honors upward arrival exclusions', async () => {
    const state = freshGame();
    initRng(42);
    state.level.requireAt(20, 10).typ = ROOM;
    state.level.requireAt(21, 10).typ = ROOM;
    state.level.exclusionZones.push({ type: 'teleport-down', lx: 20, ly: 10, hx: 20, hy: 10 }, { type: 'teleport-up', lx: 21, ly: 10, hx: 21, hy: 10 });
    await u_on_downstairs();
    assert.equal(state.u.ux, 20);
    assert.equal(state.u.uy, 10);
});
//# sourceMappingURL=stair_arrival.test.js.map