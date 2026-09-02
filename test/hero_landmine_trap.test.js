import test from 'node:test';
import assert from 'node:assert/strict';

import { LANDMINE, PIT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrapAt } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('a hero-triggered land mine changes the level around the blast',
    async () => {
        const level = freshObjectRoom({ gameplaySeed: 19n });
        const mine = addTrap(level, LANDMINE, 10, 10);
        const rock = floorObject(ROCK, 10, 10);
        const sleeper = addMonster({
            species: 'giant',
            x: 15,
            y: 10,
            msleeping: 1,
        });
        level.engravings = [{ x: 10, y: 10, text: 'Elbereth' }];
        pushKeys('                    ');

        await triggerHeroTrapAt(10, 10);

        assert.equal(mine.ttyp, PIT);
        assert.equal(game.u.utraptype, TT_PIT);
        assert.equal(floorObjectsAt(level, 10, 10).includes(rock), false);
        assert.equal(level.engravings.length, 0);
        assert.equal(sleeper.msleeping, 0);
    });
