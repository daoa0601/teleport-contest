import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, STAIRS } from '../js/const.js';
import { u_on_downstairs, u_on_upstairs } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
void test('descending cannot arrive at a downward branch stair', () => {
    const state = freshGame();
    initRng(42);
    state.level.requireAt(20, 10).typ = ROOM;
    state.level.requireAt(2, 2).typ = STAIRS;
    state.stairs = {
        sx: 2, sy: 2, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 1 }, next: null,
    };
    u_on_upstairs();
    assert.equal(state.u.ux, 20);
    assert.equal(state.u.uy, 10);
});
void test('ascending cannot arrive at an upward branch stair', () => {
    const state = freshGame();
    initRng(42);
    state.level.requireAt(20, 10).typ = ROOM;
    state.level.requireAt(2, 2).typ = STAIRS;
    state.stairs = {
        sx: 2, sy: 2, up: true, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 1 }, next: null,
    };
    u_on_downstairs();
    assert.equal(state.u.ux, 20);
    assert.equal(state.u.uy, 10);
});
//# sourceMappingURL=stair_arrival.test.js.map