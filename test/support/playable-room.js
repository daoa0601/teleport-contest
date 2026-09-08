import { ROOM } from '../../js/const.js';
import { findArmorClass } from '../../js/armor.js';
import { GameMap } from '../../js/game.js';
import { GameDisplay } from '../../js/game_display.js';
import { game } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { initRng } from '../../js/rng.js';
import { vision_reset } from '../../js/vision.js';
import { freshGame } from './game-state.js';

export function freshPlayableRoom({
    left = 8,
    right = 18,
    top = 8,
    bottom = 12,
    heroX = 10,
    heroY = 10,
    role = 'caveman',
    seed = 1n,
    hero = {},
    ...gameState
} = {}) {
    const level = new GameMap();
    for (let x = left; x <= right; x++) {
        for (let y = top; y <= bottom; y++) {
            Object.assign(level.at(x, y), {
                typ: ROOM,
                lit: true,
                waslit: true,
                seenv: 255,
            });
        }
    }

    freshGame({ ...gameState, level, role, heroX, heroY, hero });
    initRng(seed);
    vision_reset();
    game.nhDisplay = new GameDisplay(null);
    return level;
}

export function freshGameplayRoom({
    role = 'caveman', heroLevel = 1, energy = 0, ...room
} = {}) {
    const level = freshPlayableRoom({
        ...room,
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
        seed: 28101n,
    });
    findArmorClass();
    return level;
}

export function freshTurnRoom(room = {}) {
    freshGameplayRoom({ ...room, role: 'valkyrie' });
    game._moveloopStarted = true;
    game._maintenanceMove = 1;
    game._monsterMovementInitialized = true;
    game.u.umovement = 12;
    return resetInputState();
}
