import { freshGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { getTrack, initTrack, setTrack } from '../js/track.js';

function recordPositions(positions: readonly (readonly [number, number])[]) {
    const state = freshGame();
    initTrack(state);
    for (const [x, y] of positions) {
        state.u.ux = x;
        state.u.uy = y;
        setTrack(state);
    }
    return state;
}

void test('hero tracks forget positions older than one hundred updates', () => {
    const positions = Array.from({ length: 105 }, (_, index) =>
        [index % 70 + 1, Math.floor(index / 70) * 3 + 2] as const);
    const state = recordPositions(positions);

    assert.equal(getTrack(4, 2, state), null);
    assert.deepEqual(getTrack(5, 2, state), { x: 6, y: 2 });
    assert.deepEqual(getTrack(35, 4, state), { x: 35, y: 5 });
});

void test('getTrack searches newest-first and returns an adjacent hero square', () => {
    const state = recordPositions([[70, 5], [72, 7], [73, 7]]);

    assert.deepEqual(getTrack(72, 6, state), { x: 73, y: 7 });
});

void test('getTrack stops when the newest nearby entry is the current square', () => {
    const state = recordPositions([[73, 7], [72, 6]]);

    assert.equal(getTrack(72, 6, state), null);
});
