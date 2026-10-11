import test from 'node:test';
import assert from 'node:assert/strict';

import { LANDMINE, PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { ROCK } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a heavy monster sets off a land mine and falls into the new pit',
    async () => {
        const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
            gameplaySeed: 1n,
            monster: { species: 'giant', hitPoints: 30 },
        });
        requirePlayingGame(game);
        const messages: string[] = [];

        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            rollOne: () => 2,
            publish: async (message: string) => messages.push(message),
        });

        assert.equal(trap.ttyp, PIT);
        assert.equal(trap.tseen, true);
        assert.equal(monster.mtrapped, 1);
        assert.ok(monster.mhp < 30);
        assert.ok(messages.some(message => message.includes('KAABLAMM')));
        assert.ok(messages.some(message => message.includes('falls into a pit')));
    });

void test('a light monster can cross a land mine without setting it off', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
        gameplaySeed: 1n,
        monster: { species: 'gnome', hitPoints: 30 },
    });
    requirePlayingGame(game);

    const action = await triggerImmediateMonsterTrap(monster, game);

    assert.equal(trap.ttyp, LANDMINE);
    assert.equal(monster.mhp, 30);
});

void test('a flying monster can reveal a land mine without detonating it',
    async () => {
        const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
            gameplaySeed: 2n,
            monster: { species: 'red dragon', hitPoints: 30 },
        });
        requirePlayingGame(game);
        const messages: string[] = [];

        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async (message: string) => messages.push(message),
        });

        assert.equal(trap.ttyp, LANDMINE);
        assert.equal(trap.tseen, true);
        assert.equal(monster.mhp, 30);
        assert.match(messages[0] ?? '', /trigger appears in a pile of soil/);
    });

void test('the blast scatters loose objects away from the mine', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const rock = await floorObject(ROCK, 11, 10);

    await scatterFloorObjects(11, 10, 4, {
        state: game,
        random: range => range === 8 ? 4 : 1,
        rollOne: range => range,
    });

    assert.equal(floorObjectsAt(level, 11, 10).includes(rock), false);
    assert.equal(floorObjectsAt(level, 15, 10).includes(rock), true);
});
