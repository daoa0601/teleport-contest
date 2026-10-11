import { requireFixtureGame } from './game-state.js';
import { ROOM } from '../../js/const.js';
import { findArmorClass } from '../../js/armor.js';
import { GameMap } from '../../js/game.js';
import { GameDisplay } from '../../js/game_display.js';
import { game } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { initRng } from '../../js/rng.js';
import { vision_reset } from '../../js/vision.js';
import { freshGame } from './game-state.js';
export function requirePlayableRoom(state) {
    requireFixtureGame(state);
    if (!state.nhDisplay)
        throw new Error('The playable room needs a display');
}
export function createRoomLevel({ left = 8, right = 18, top = 8, bottom = 12 } = {}) {
    const level = new GameMap();
    for (let x = left; x <= right; x++) {
        for (let y = top; y <= bottom; y++) {
            const location = level.at(x, y);
            if (!location)
                throw new RangeError(`Room square ${x},${y} is outside the map`);
            location.typ = ROOM;
            location.lit = true;
            location.waslit = true;
            location.seenv = 255;
        }
    }
    return level;
}
export function freshPlayableRoom({ left = 8, right = 18, top = 8, bottom = 12, heroX = 10, heroY = 10, role = 'caveman', seed = 1n, hero = {}, ...gameState } = {}) {
    const level = createRoomLevel({ left, right, top, bottom });
    freshGame({ ...gameState, level, role, heroX, heroY, hero });
    initRng(seed);
    vision_reset();
    game.nhDisplay = new GameDisplay(null);
    return level;
}
export function freshGameplayRoom({ role = 'caveman', heroLevel = 1, energy = 0, hero = {}, flags = {}, seed = 28101n, ...room } = {}) {
    const level = freshPlayableRoom({
        ...room,
        role,
        hero: {
            ulevel: heroLevel,
            uen: energy,
            uenmax: energy,
            ...hero,
        },
        flags: {
            fireassist: true,
            pushweapon: true,
            verbose: true,
            pickup: false,
            ...flags,
        },
        seed,
    });
    findArmorClass();
    return level;
}
export function freshTurnRoom(room = {}) {
    freshGameplayRoom({ role: 'valkyrie', ...room });
    game._moveloopStarted = true;
    game.u.umovement = 12;
    return resetInputState();
}
//# sourceMappingURL=playable-room.js.map