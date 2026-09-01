import { ROOM } from '../../js/const.js';
import { GameMap } from '../../js/game.js';
import { game, resetGame } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { installLiveCommandHero } from './live-command-state.js';

export function freshPlayableRoom({
    left = 8,
    right = 18,
    top = 8,
    bottom = 12,
    heroX = 10,
    heroY = 10,
    role = 'caveman',
    hero = {},
} = {}) {
    resetGame();

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

    installLiveCommandHero({ role, level, x: heroX, y: heroY });
    Object.assign(game.u, hero);
    game.inventory = [];
    game.uwep = null;
    game.uswapwep = null;
    game.uquiver = null;
    game.animationFrame = async () => {};
    resetInputState();
    return level;
}
