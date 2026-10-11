// track.js — recent hero-position ring used by monster pursuit.
// C ref: track.c initrack(), settrack(), gettrack().
import { game } from './gstate.js';
import { distmin } from './hacklib.js';
import { OBJECT_NAMES } from './object_data.js';
const RIN_STEALTH = OBJECT_NAMES.indexOf('stealth');
const HERO_TRACK_SIZE = 100;
export function initTrack(state = game) {
    state._heroTrack = [];
}
export function setTrack(state = game) {
    if (!state?.u)
        return;
    if (state.uleft?.otyp === RIN_STEALTH || state.uright?.otyp === RIN_STEALTH)
        return;
    const track = state._heroTrack ??= [];
    track.push({ x: state.u.ux, y: state.u.uy });
    if (track.length > HERO_TRACK_SIZE)
        track.shift();
}
export function hasTrack(x, y, state = game) {
    return (state._heroTrack || []).some(point => point.x === x && point.y === y);
}
// Search newest-first.  C deliberately returns null immediately when the
// newest nearby track is the monster's own square rather than falling back to
// an older adjacent entry.
export function getTrack(x, y, state = game) {
    const track = state?._heroTrack || [];
    for (let i = track.length - 1; i >= 0; i--) {
        const point = track[i];
        if (!point)
            throw new Error(`Missing hero track entry at index ${i}.`);
        const distance = distmin(x, y, point.x, point.y);
        if (distance <= 1)
            return distance ? { x: point.x, y: point.y } : null;
    }
    return null;
}
//# sourceMappingURL=track.js.map