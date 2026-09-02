import test from 'node:test';
import assert from 'node:assert/strict';

import {
    allocateMonsterMovement, finishMonsterLiquidDeath,
    mcalcmove, mfndpos, naturalMonsterSpeed, quietMonsterActionRng,
} from '../js/monmove.js';
import { IRONBARS, LAVAPOOL, ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game } from '../js/gstate.js';
import { resolveMonsterLiquid } from '../js/mon.js';
import { ROCK } from '../js/object_data.js';
import { roles } from '../js/roles.js';
import { addMonster, liveMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function rolls(values) {
    let index = 0;
    return () => values[index++];
}

test('natural monster speed and randomized movement use species data', () => {
    assert.equal(naturalMonsterSpeed({ mnum: 100 }), 16); // pony
    assert.equal(naturalMonsterSpeed({ mnum: 32 }), 18); // kitten
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([2])), 24);
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([4])), 12);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([5])), 24);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([6])), 12);
});

test('monster allocation applies newest-first movement to current actors',
    () => {
        const kobold = liveMonster({
            mnum: 59, x: 66, y: 16, hitPoints: 1,
        });
        const pony = liveMonster({
            mnum: 100, x: 67, y: 9, hitPoints: 8, pet: true,
        });
        const monsters = [kobold, pony];

        allocateMonsterMovement(monsters, rolls([2, 3]));

        assert.equal(pony.movement, 24);
        assert.equal(kobold.movement, 12);
    });

test('Knight starts with the source pony species', () => {
    assert.equal(roles.find(role => role.key === 'knight').petnum, 100);
});

test('a tame red dragon bites and claws an adjacent enemy', () => {
    freshObjectRoom({
        right: 20,
        heroX: 18,
        heroY: 10,
        recalculateVision: false,
    });
    const dragon = addMonster({
        species: 'red dragon',
        x: 10,
        y: 10,
        hitPoints: 100,
        level: 15,
        mtame: 20,
        pet: true,
        mpeaceful: 1,
        edog: { hungrytime: 1000 },
    });
    const goblin = addMonster({
        species: 'goblin',
        x: 11,
        y: 10,
        hitPoints: 100,
        level: 1,
        mac: 100,
    });

    const action = quietMonsterActionRng(
        dragon,
        game,
        () => 1,
        (count, sides) => count * sides,
        () => 1,
    );

    assert.deepEqual(
        action.movement.attack.results.map(attack => attack.type),
        ['bite', 'claw', 'claw'],
    );
    assert.equal(goblin.mhp, 68);
});

test('a land monster in lava burns and drops what it carried', async () => {
    const level = new GameMap();
    level.at(12, 10).typ = LAVAPOOL;
    const rock = {
        otyp: ROCK,
        quan: 1,
        quantity: 1,
        where: 'monster',
    };
    const ant = liveMonster({
        mnum: 0,
        x: 12,
        y: 10,
        hitPoints: 4,
        inventory: [rock],
    });
    level.monsters = [ant];
    const state = {
        level,
        u: { ux: 10, uy: 10, uz: { dnum: 0, dlevel: 1 } },
        moves: 1,
    };

    const result = await resolveMonsterLiquid(ant, state, {
        finishDeath: finishMonsterLiquidDeath,
    });

    assert.equal(result.dead, true);
    assert.equal(level.monsters.includes(ant), false);
    assert.equal(level.objects[12][10].includes(rock), true);
});

test('an engulfer carries only a form which fits through iron bars', () => {
    const level = new GameMap();
    level.at(10, 10).typ = ROOM;
    level.at(11, 10).typ = IRONBARS;
    const fogCloud = liveMonster({
        mnum: 106,
        x: 10,
        y: 10,
        mux: 10,
        muy: 10,
        hitPoints: 8,
        mcansee: 1,
    });
    level.monsters = [fogCloud];
    const state = {
        level,
        u: {
            ux: 10,
            uy: 10,
            ustuck: fogCloud,
            uswallow: 1,
            mtimedone: 0,
        },
    };

    assert.equal(mfndpos(fogCloud, state).some(position =>
        position.x === 11 && position.y === 10), false);

    state.u.mtimedone = 10;
    state.u.umonnum = 106;
    assert.equal(mfndpos(fogCloud, state).some(position =>
        position.x === 11 && position.y === 10), true);
});
