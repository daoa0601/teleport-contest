import test from 'node:test';
import assert from 'node:assert/strict';

import { VIBRATING_SQUARE } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

test('a visible monster reveals the vibrating square under its feet',
    async () => {
        const { monster, trap } = freshMonsterTrapRoom(VIBRATING_SQUARE, {
            monster: { species: 'giant' },
        });
        const messages = [];

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async message => messages.push(message),
        });

        assert.equal(trap.tseen, true);
        assert.match(messages[0], /beneath the giant's feet/);
    });

test('the vibration appears beneath an airborne monster', async () => {
    const { monster, trap } = freshMonsterTrapRoom(VIBRATING_SQUARE, {
        monster: { species: 'red dragon' },
    });
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(trap.tseen, true);
    assert.match(messages[0], /beneath the red dragon/);
});

test('an unseen monster makes the nearby ground vibrate', async () => {
    const { monster, trap } = freshMonsterTrapRoom(VIBRATING_SQUARE, {
        monster: { species: 'giant', minvis: 1 },
    });
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(trap.tseen, true);
    assert.equal(messages[0], 'You see the ground vibrate nearby.');
});
