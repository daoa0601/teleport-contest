import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { LAVAPOOL, NO_MINVENT, ROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('a stationary monster dying during maintenance keeps the other movement allocations unchanged', async () => {
    const movement: number[] = [];
    for (const terrain of [ROOM, LAVAPOOL]) {
        // The jelly's experience must not level up the hero during maintenance.
        const input = freshTurnRoom({ heroLevel: 20 });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
        const jelly = await createMonsterAt('spotted jelly', 16, 10, NO_MINVENT);
        goblin.msleeping = 1;
        goblin.movement = jelly.movement = 0;
        game.level.requireAt(jelly.mx, jelly.my).typ = terrain;
        initRng(1n);
        input.feed('.\x1b');

        await moveloop_core();
        await moveloop_core();

        assert.equal(game.moves, 2);
        movement.push(goblin.movement ?? 0);
        assert.equal(jelly.mhp > 0, terrain === ROOM);
        assert.equal(monsterAtPosition(game.level, 16, 10), terrain === ROOM ? jelly : null,
            'liquid death removes map occupancy immediately');

        input.feed('.\x1b');
        await moveloop_core();
        await moveloop_core();
        if (terrain === LAVAPOOL)
            assert.equal(game.level.monsters.includes(jelly), false,
                'the next monster movement pass must finish deferred death cleanup');
    }
    assert.equal(movement[1], movement[0],
        'a death in mcalcdistress must not shift the surviving goblin movement allocation');
});
