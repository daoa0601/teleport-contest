import { makeEngravingAt } from '../js/engrave.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { LANDMINE, PIT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrapAt } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a hero-triggered land mine changes the level around the blast',
    async () => {
        const level = freshObjectRoom({ gameplaySeed: 19n });
        requireFixtureGame(game);
        const mine = addTrap(level, LANDMINE, 10, 10);
        const rock = await floorObject(ROCK, 10, 10);
        const sleeper = await createMonsterAt('giant', 15, 10);
        sleeper.msleeping = 1;
        makeEngravingAt(10, 10, 'Elbereth');
        pushKeys('                    ');

        await triggerHeroTrapAt(10, 10);

        assert.equal(mine.ttyp, PIT);
        assert.equal(game.u.utraptype, TT_PIT);
        assert.equal(floorObjectsAt(level, 10, 10).includes(rock), false);
        assert.ok(level.engravings != null);
        assert.equal(level.engravings.length, 0);
        assert.equal(sleeper.msleeping, 0);
    });
