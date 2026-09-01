import { ROOM } from '../../js/const.js';
import { GameMap } from '../../js/game.js';
import { game, resetGame } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { initRng } from '../../js/rng.js';
import { installLiveCommandHero } from './live-command-state.js';

export function freshWeaponArena({
    role = 'caveman', heroLevel = 1, energy = 0,
} = {}) {
    resetGame();
    const level = new GameMap();
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            Object.assign(level.at(x, y), {
                typ: ROOM, lit: true, waslit: true, seenv: 255,
            });
        }
    }
    installLiveCommandHero({ role, level, x: 10, y: 10 });
    game.u.ulevel = heroLevel;
    game.u.uen = energy;
    game.u.uenmax = energy;
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
