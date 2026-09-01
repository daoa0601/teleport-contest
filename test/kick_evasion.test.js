import test from 'node:test';
import assert from 'node:assert/strict';

import { COULD_SEE, IN_SIGHT, ROOM } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { installLiveCommandHero } from './support/live-command-state.js';

function installSnakeArena() {
    resetGame();
    resetInputState();
    const level = new GameMap();
    for (let x = 6; x <= 14; x++) {
        for (let y = 6; y <= 14; y++) {
            Object.assign(level.at(x, y), {
                typ: ROOM, lit: true, waslit: true, seenv: 255,
            });
        }
    }
    const snake = {
        mnum: 215, m_id: 55, mx: 11, my: 10,
        mhp: 20, mhpmax: 20, m_lev: 4, mac: 3,
        mpeaceful: 0, mtame: 0, mcanmove: 1, mcansee: 1,
        msleeping: 0, mstrategy: 0, minvis: 0, mundetected: 0,
        movement: 12,
    };
    level.monsters = [snake];
    installLiveCommandHero({ role: 'tourist', level, x: 10, y: 10 });
    for (const row of game.viz_array) row.fill(IN_SIGHT | COULD_SEE);
    return snake;
}

test('a quick snake can slide away from a kick', async () => {
    const snake = installSnakeArena();
    initRng(7n);
    pushKey('l');

    await rhack(4);

    assert.notDeepEqual([snake.mx, snake.my], [11, 10]);
    assert.equal(snake.mhp, 20);
    assert.match(game._pending_message, /slides, nimbly evading your kick/);
});
