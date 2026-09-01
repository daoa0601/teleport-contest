import test from 'node:test';
import assert from 'node:assert/strict';

import { COULD_SEE, IN_SIGHT, ROOM } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { installLiveCommandHero } from './support/live-command-state.js';

function installKickArena(mnum) {
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
    const monster = {
        mnum, m_id: 55, mx: 11, my: 10,
        mhp: 20, mhpmax: 20, m_lev: 4, mac: 3,
        mpeaceful: 0, mtame: 0, mcanmove: 1, mcansee: 1,
        msleeping: 0, mstrategy: 0, minvis: 0, mundetected: 0,
        movement: 12,
    };
    level.monsters = [monster];
    installLiveCommandHero({ role: 'tourist', level, x: 10, y: 10 });
    for (const row of game.viz_array) row.fill(IN_SIGHT | COULD_SEE);
    return monster;
}

test('a quick snake can slide away from a kick', async () => {
    const snake = installKickArena(215);
    initRng(7n);
    pushKey('l');

    await rhack(4);

    assert.notDeepEqual([snake.mx, snake.my], [11, 10]);
    assert.equal(snake.mhp, 20);
    assert.match(game._pending_message, /slides, nimbly evading your kick/);
});

test('a heavy load can leave a clumsy kick harmless', async () => {
    const lichen = installKickArena(158);
    game.inventory = [
        { otyp: OBJECT_NAMES.indexOf('plate mail'), quan: 1 },
        { otyp: OBJECT_NAMES.indexOf('food ration'), quan: 2 },
    ];
    initRng(2n);
    pushKey('l');

    await rhack(4);

    assert.equal(lichen.mhp, 20);
    assert.equal(game._pending_message, 'Your clumsy kick does no damage.');
});

test('levitation can spoil a kick against a tiny grounded monster',
    async () => {
        const garterSnake = installKickArena(214);
        game.u.levitating = true;
        initRng(2n);
        pushKey('l');

        await rhack(4);

        assert.equal(garterSnake.mhp, 20);
        assert.deepEqual([garterSnake.mx, garterSnake.my], [11, 10]);
        assert.equal(
            game._pending_message,
            'Floating in the air, you miss wildly!',
        );
    });

test('kicking a pet costs a Samurai honor and frightens the pet', async () => {
    const dog = installKickArena(16);
    game.urole = { key: 'samurai' };
    dog.mpeaceful = 1;
    dog.mtame = 10;
    dog.pet = true;
    dog.edog = {};
    initRng(2n);
    pushKey('l');
    pushKey('y');
    pushKey(' ');
    pushKey(' ');

    await rhack(4);

    assert.equal(game.u.ualign.record, 9);
    assert.equal(dog.mtame, 9);
    assert.equal(dog.mflee, 1);
});

test('declining a pet kick leaves the pet alone and takes no turn', async () => {
    const dog = installKickArena(16);
    dog.mpeaceful = 1;
    dog.mtame = 10;
    dog.pet = true;
    dog.edog = {};
    initRng(2n);
    pushKey('l');
    pushKey('n');

    await rhack(4);

    assert.equal(dog.mhp, 20);
    assert.equal(dog.mtame, 10);
    assert.equal(game.context.move, 0);
});
