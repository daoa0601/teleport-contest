import { initRng } from '../../js/rng.js';
import { freshPlayableRoom } from './playable-room.js';

export function freshWeaponArena({
    role = 'caveman', heroLevel = 1, energy = 0,
} = {}) {
    const level = freshPlayableRoom({
        role,
        hero: {
            ulevel: heroLevel,
            uen: energy,
            uenmax: energy,
        },
        flags: {
            fireassist: true,
            pushweapon: true,
            verbose: true,
            pickup: false,
        },
    });
    initRng(28101n);
    return level;
}
