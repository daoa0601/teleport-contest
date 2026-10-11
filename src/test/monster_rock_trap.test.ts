import test from 'node:test';
import assert from 'node:assert/strict';

import { ROCKTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { ROCK } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

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
