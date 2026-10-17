import test from 'node:test';
import assert from 'node:assert/strict';

import { ROCKTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { ROCK } from '../js/object_data.js';
import { pickUpMonsterFloorObject } from '../js/monster_pickup.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

void test('a visible falling rock joins known rocks before the monster picks up the stack', async () => {
    const { level, monster } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n, monster: { species: 'giant' },
    });
    requirePlayingGame(game);
    game.flags.verbose = true;
    await floorObject(ROCK, 11, 10, { quan: 7, known: false, typeKnown: false });
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => { messages.push(message); },
    });
    const pile = floorObjectsAt(level, 11, 10).filter(object => object.otyp === ROCK);
    assert.equal(pile.length, 1);
    assert.equal(pile[0]?.quan, 8);
    assert.equal(await pickUpMonsterFloorObject(monster, game), true);

    assert.match(game._pending_message, /picks up 8 (?:uncursed )?rocks\./);
    assert.equal(monster.minvent.find(object => object.otyp === ROCK)?.quan, 8);
});

void test('a falling-rock trap hits a visible monster and drops its rock',
    async () => {
        const { level, monster, trap } = await freshMonsterTrapRoom(ROCKTRAP, {
            gameplaySeed: 23n,
            monster: { species: 'giant' },
        });
        requirePlayingGame(game);
        const hitPointsBefore = monster.mhp;
        const messages: string[] = [];

        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async (message: string) => messages.push(message),
        });

        assert.ok(monster.mhp < hitPointsBefore);
        assert.equal(trap.tseen, true);
        assert.ok(floorObjectsAt(level, 11, 10).some(
            object => object.otyp === ROCK,
        ));
        assert.match(messages[0] ?? '', /is hit by a rock/);
    });

void test('a falling rock passes harmlessly through a xorn', async () => {
    const { level, monster } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n,
        monster: { species: 'xorn' },
    });
    requirePlayingGame(game);
    const hitPointsBefore = monster.mhp;
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message: string) => messages.push(message),
    });

    assert.equal(monster.mhp, hitPointsBefore);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ROCK,
    ));
    assert.match(messages[0] ?? '', /is not harmed/);
});

void test('a spent rock trap names the monster beneath it with mon_nam()', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n, monster: { species: 'grid bug' },
    });
    requirePlayingGame(game);
    trap.once = true;
    trap.tseen = true;
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game, { random: () => 0 });
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['A trap door above the grid bug opens, but nothing falls out!']);
});
