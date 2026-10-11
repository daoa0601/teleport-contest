import test from 'node:test';
import assert from 'node:assert/strict';

import { VIBRATING_SQUARE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

void test('a visible monster reveals the vibrating square under its feet',
    async () => {
        const { monster, trap } = await freshMonsterTrapRoom(VIBRATING_SQUARE, {
            monster: { species: 'giant' },
        });
        requirePlayingGame(game);
        const messages: string[] = [];

        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async (message: string) => messages.push(message),
        });

        assert.equal(trap.tseen, true);
        assert.match(messages[0] ?? '', /beneath the giant's feet/);
    });

void test('the vibration appears beneath an airborne monster', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(VIBRATING_SQUARE, {
        monster: { species: 'red dragon' },
    });
    requirePlayingGame(game);
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message: string) => messages.push(message),
    });

    assert.equal(trap.tseen, true);
    assert.match(messages[0] ?? '', /beneath the red dragon/);
});

void test('an unseen monster makes the nearby ground vibrate', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(VIBRATING_SQUARE, {
        monster: { species: 'giant', minvis: 1 },
    });
    requirePlayingGame(game);
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message: string) => messages.push(message),
    });

    assert.equal(trap.tseen, true);
    assert.equal(messages[0], 'You see the ground vibrate nearby.');
});
