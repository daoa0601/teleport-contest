import { ROOM } from '../../js/const.js';
import { GameMap } from '../../js/game.js';
import { game, resetGame } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import {
    CLUB, DART, FLINT, LOADSTONE, ROCK, SLING,
} from '../../js/object_data.js';
import { initRng } from '../../js/rng.js';
import { installLiveCommandHero } from './live-command-state.js';

export function inventoryObject(otyp, invlet, overrides = {}) {
    const names = new Map([
        [CLUB, ['club', 'clubs', 2]],
        [DART, ['dart', 'darts', 2]],
        [SLING, ['sling', 'slings', 2]],
        [FLINT, ['flint stone', 'flint stones', 13]],
        [LOADSTONE, ['loadstone', 'loadstones', 13]],
        [ROCK, ['rock', 'rocks', 13]],
    ]);
    const [name, plural, oclass] = names.get(otyp);
    return {
        otyp, invlet, name, plural, oclass,
        quan: 1, quantity: 1,
        where: 'inventory',
        cursed: false, blessed: false, bknown: true, dknown: true,
        worn: false, wielded: false, alternate: false, ready: false,
        owornmask: 0,
        contents: [], objectTimers: [], timed: 0,
        ...overrides,
    };
}

export function freshWeaponArena() {
    resetGame();
    const level = new GameMap();
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            Object.assign(level.at(x, y), {
                typ: ROOM, lit: true, waslit: true, seenv: 255,
            });
        }
    }
    installLiveCommandHero({ role: 'caveman', level, x: 10, y: 10 });
    game.flags = {
        fireassist: true,
        pushweapon: true,
        verbose: true,
        pickup: false,
    };
    game.inventory = [];
    game.uwep = game.uswapwep = game.uquiver = null;
    game.animationFrame = async () => {};
    resetInputState();
    initRng(28101n);
    return level;
}
