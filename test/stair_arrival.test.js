import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, STAIRS } from '../js/const.js';
import { u_on_downstairs, u_on_sstairs, u_on_upstairs } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { createSaddledSteed } from './support/monsters.js';
for (const arrival of ['upstairs', 'downstairs', 'branch', 'random']) {
    void test(`${arrival} arrival reveals the hero and brings the ridden steed to the new square`, async () => {
        const state = freshGame();
        initRng(42);
        state.level.requireAt(11, 10).typ = ROOM;
        const steed = await createSaddledSteed();
        state.u.usteed = steed;
        state.u.uundetected = 1;
        state.u.uz = { dnum: 0, dlevel: 2 };
        const destination = state.level.requireAt(20, 10);
        destination.typ = arrival === 'random' ? ROOM : STAIRS;
        if (arrival === 'random')
            state.level.downTeleportRegion = { lx: 20, ly: 10, hx: 20, hy: 10 };
        else
            state.stairs = {
                sx: 20, sy: 10, up: arrival !== 'downstairs', isladder: false,
                u_traversed: false,
                tolev: { dnum: arrival === 'branch' ? 1 : 0, dlevel: 1 }, next: null,
            };
        if (arrival === 'downstairs')
            await u_on_downstairs();
        else if (arrival === 'branch')
            await u_on_sstairs(0);
        else
            await u_on_upstairs();
        assert.equal(state.u.ux, 20);
        assert.equal(state.u.uy, 10);
        assert.equal(state.u.uundetected, 0, 'arriving reveals the hero');
        assert.equal(steed.mx, 20, 'the steed shares the arrival square');
        assert.equal(steed.my, 10);
        assert.equal(state.u.ux0, 20);
        assert.equal(state.u.uy0, 10);
        assert.equal(destination.lastseentyp, destination.typ, 'arrival records the destination terrain');
    });
}
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