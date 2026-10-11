import test from 'node:test';
import assert from 'node:assert/strict';

import { SQKY_BOARD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

function monsterOnSqueakyBoard(species = 'giant') {
    return freshMonsterTrapRoom(SQKY_BOARD, {
        monster: { species },
        trap: { tnote: 0 },
    });
}

void test('a visible monster squeaks a board and wakes a nearby sleeper',
    async () => {
        const { monster, trap } = await monsterOnSqueakyBoard();
        requirePlayingGame(game);
        const sleeper = await createMonsterAt('jackal', 15, 10);
        sleeper.msleeping = 1;
        const messages: string[] = [];

        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async (message: string) => messages.push(message),
        });

        assert.equal(trap.tseen, true);
        assert.equal(sleeper.msleeping, 0);
        assert.match(messages[0] ?? '', /squeaks a C note loudly/);
    });

void test('a deaf hero sees a monster cringe without discovering the board',
    async () => {
        const { monster, trap } = await monsterOnSqueakyBoard();
        requirePlayingGame(game);
        const sleeper = await createMonsterAt('jackal', 15, 10);
        sleeper.msleeping = 1;
        const messages: string[] = [];
        game.deaf = true;

        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async (message: string) => messages.push(message),
        });

        assert.equal(trap.tseen ?? false, false);
        assert.equal(sleeper.msleeping, 0);
        assert.match(messages[0] ?? '', /appears to cringe/);
    });

void test('a flying monster does not press a squeaky board', async () => {
    const { monster, trap } = await monsterOnSqueakyBoard('red dragon');
    requirePlayingGame(game);
    const sleeper = await createMonsterAt('jackal', 15, 10);
    sleeper.msleeping = 1;

    await triggerImmediateMonsterTrap(monster, game);

    assert.equal(trap.tseen ?? false, false);
    assert.equal(sleeper.msleeping, 1);
});
