// Species rules shared by corpse timers and revival.

import { MONSTER_SYMBOL } from './monster_data.js';

export const ZOMBIE_FORM_BY_LIVING_CORPSE = new Map([
    [59, 239], [165, 240], [72, 241], [44, 242],
    [264, 243], [260, 244], [174, 245], [169, 247],
]);

export function zombieForm(mnum) {
    return ZOMBIE_FORM_BY_LIVING_CORPSE.get(mnum) ?? null;
}

export function isRider(mnum) {
    return mnum >= 311 && mnum <= 313;
}

export function isReviver(mnum) {
    return isRider(mnum) || MONSTER_SYMBOL[mnum] === 46; // S_TROLL
}
