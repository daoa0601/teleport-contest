import assert from 'node:assert/strict';
import test from 'node:test';

import { COLNO, LAVAPOOL, ROOM, ROWNO, STONE, W_NONPASSWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createMonsterAt } from './support/monsters.js';

void test('a flying monster blocking level arrival can move onto the adjacent lava', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    const ghost = await createMonsterAt('ghost', 13, 10);
    source.monsters.splice(source.monsters.indexOf(ghost), 1);
    destination.monsters.push(ghost);
    placeMonsterAt(ghost, 12, 10);
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++) {
        if (x === 12 && y === 10) continue;
        const location = destination.requireAt(x, y);
        location.typ = STONE;
        location.wall_info = W_NONPASSWALL;
    }
    destination.requireAt(13, 10).typ = LAVAPOOL;
    pushKeys(' '.repeat(10));

    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });

    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 10);
    assert.equal(ghost.mx, 13);
    assert.equal(ghost.my, 10);
});

void test('moving the hero aside on level arrival resets the old position to the landing square', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 13, 10);
    source.monsters.splice(source.monsters.indexOf(dog), 1);
    destination.monsters.push(dog);
    placeMonsterAt(dog, 12, 10);
    initRng(4n);
    pushKeys(' '.repeat(10));

    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });

    assert.ok(game.u.ux !== 12 || game.u.uy !== 10, 'the hero must move aside for this arrival');
    assert.equal(destination.requireAt(game.u.ux, game.u.uy).typ, ROOM);
    assert.equal(game.u.ux0, game.u.ux);
    assert.equal(game.u.uy0, game.u.uy);
    assert.equal(destination.requireAt(game.u.ux, game.u.uy).lastseentyp, ROOM);
});
