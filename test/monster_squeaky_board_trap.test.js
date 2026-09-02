import test from 'node:test';
import assert from 'node:assert/strict';

import { SQKY_BOARD } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { addMonster } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

function monsterOnSqueakyBoard(species = 'giant') {
    return freshMonsterTrapRoom(SQKY_BOARD, {
        monster: { species },
        trap: { tnote: 0 },
    });
}

test('a visible monster squeaks a board and wakes a nearby sleeper',
    async () => {
        const { monster, trap } = monsterOnSqueakyBoard();
        const sleeper = addMonster({
            species: 'jackal', x: 15, y: 10, msleeping: 1,
        });
        const messages = [];

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async message => messages.push(message),
        });

        assert.equal(trap.tseen, true);
        assert.equal(sleeper.msleeping, 0);
        assert.match(messages[0], /squeaks a C note loudly/);
    });

test('a deaf hero sees a monster cringe without discovering the board',
    async () => {
        const { monster, trap } = monsterOnSqueakyBoard();
        const sleeper = addMonster({
            species: 'jackal', x: 15, y: 10, msleeping: 1,
        });
        const messages = [];
        game.deaf = true;

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async message => messages.push(message),
        });

        assert.equal(trap.tseen ?? false, false);
        assert.equal(sleeper.msleeping, 0);
        assert.match(messages[0], /appears to cringe/);
    });

test('a flying monster does not press a squeaky board', () => {
    const { monster, trap } = monsterOnSqueakyBoard('red dragon');
    const sleeper = addMonster({
        species: 'jackal', x: 15, y: 10, msleeping: 1,
    });

    triggerImmediateMonsterTrap(monster, game);

    assert.equal(trap.tseen ?? false, false);
    assert.equal(sleeper.msleeping, 1);
});
