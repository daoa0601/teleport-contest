// Species rules shared by corpse timers and revival.

import { MONSTER_SYMBOL } from './monster_data.js';

export const ZOMBIE_FORM_BY_LIVING_CORPSE = new Map([
    [59, 239], [165, 240], [72, 241], [44, 242],
    [264, 243], [260, 244], [174, 245], [169, 247],
]);

export function zombieForm(mnum: number): number | null {
    return ZOMBIE_FORM_BY_LIVING_CORPSE.get(mnum) ?? null;
}

export function isRider(mnum: number | undefined): boolean {
    return mnum !== undefined && mnum >= 311 && mnum <= 313;
}

export function isReviver(mnum: number | undefined): boolean {
    return isRider(mnum) || mnum !== undefined && MONSTER_SYMBOL[mnum] === 46; // S_TROLL
}

export function isZombieMaker(mnum: number, cancelled = false): boolean {
    if (cancelled) return false;
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === 38) return true; // S_LICH
    return symbol === 52 && mnum !== 246 && mnum !== 248; // ghoul, skeleton
}
