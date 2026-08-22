import test from 'node:test';
import assert from 'node:assert/strict';

import { getTrack, initTrack, setTrack } from '../js/track.js';

test('hero tracks retain the newest one hundred positions', () => {
    const state = { u: { ux: 1, uy: 1 } };
    initTrack(state);
    for (let i = 0; i < 105; i++) {
        state.u.ux = i + 1;
        setTrack(state);
    }
    assert.equal(state._heroTrack.length, 100);
    assert.deepEqual(state._heroTrack[0], { x: 6, y: 1 });
    assert.deepEqual(state._heroTrack.at(-1), { x: 105, y: 1 });
});

test('getTrack searches newest-first and returns an adjacent hero square', () => {
    const state = {
        _heroTrack: [
            { x: 70, y: 5 },
            { x: 72, y: 7 },
            { x: 73, y: 7 },
        ],
    };
    assert.deepEqual(getTrack(72, 6, state), { x: 73, y: 7 });
});

test('getTrack stops when the newest nearby entry is the current square', () => {
    const state = {
        _heroTrack: [
            { x: 73, y: 7 },
            { x: 72, y: 6 },
        ],
    };
    assert.equal(getTrack(72, 6, state), null);
});
