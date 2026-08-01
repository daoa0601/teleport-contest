// track.js — recent hero-position ring used by monster pursuit.
// C ref: track.c initrack(), settrack(), gettrack().

import { game } from './gstate.js';

const HERO_TRACK_SIZE = 100;

function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function initTrack(state = game) {
    state._heroTrack = [];
}

export function setTrack(state = game) {
    if (!state?.u) return;
    if (!Array.isArray(state._heroTrack)) initTrack(state);
    state._heroTrack.push({ x: state.u.ux, y: state.u.uy });
    if (state._heroTrack.length > HERO_TRACK_SIZE)
        state._heroTrack.shift();
}

// Search newest-first.  C deliberately returns null immediately when the
// newest nearby track is the monster's own square rather than falling back to
// an older adjacent entry.
export function getTrack(x, y, state = game) {
    const track = state?._heroTrack || [];
    for (let i = track.length - 1; i >= 0; i--) {
        const point = track[i];
        const distance = distmin(x, y, point.x, point.y);
        if (distance <= 1)
            return distance ? { x: point.x, y: point.y } : null;
    }
    return null;
}
