import { game } from '../../js/gstate.js';
import { initRng } from '../../js/rng.js';
import { freshPlayableRoom } from './playable-room.js';

export function freshWeaponArena({
    role = 'caveman', heroLevel = 1, energy = 0,
} = {}) {
    const level = freshPlayableRoom({ role });
    game.u.ulevel = heroLevel;
    game.u.uen = energy;
    game.u.uenmax = energy;
    game.flags = {
        fireassist: true,
        pushweapon: true,
        verbose: true,
        pickup: false,
    };
    initRng(28101n);
    return level;
}
