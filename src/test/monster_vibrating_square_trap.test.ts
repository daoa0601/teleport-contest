import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { VIBRATING_SQUARE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { vision_recalc } from '../js/vision.js';

void test('a monster turn names the giant in lowercase beneath its vibrating feet', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 12, 10);
    giant.mpeaceful = 0;
    giant.msleeping = 0;
    giant.movement = 12;
    const trap = addTrap(game.level, VIBRATING_SQUARE, 11, 10);
    vision_recalc(0);
    game._heroTimePending = true;
    installPagerInput(input, { expected: /vibration/, limit: 2 });

    await finishAtCommandInput(input, moveloop_core,
        /^You see a strange vibration beneath the giant's feet\.$/);

    assert.equal(trap.tseen, true);
});

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
