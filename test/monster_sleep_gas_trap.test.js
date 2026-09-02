import test from 'node:test';
import assert from 'node:assert/strict';

import { SLP_GAS_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

test('sleeping gas puts a susceptible visible monster to sleep', async () => {
    const { monster, trap } = freshMonsterTrapRoom(SLP_GAS_TRAP, {
        gameplaySeed: 31n,
    });
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mcanmove, 0);
    assert.ok(monster.mfrozen > 0);
    assert.equal(trap.tseen, true);
    assert.match(messages[0], /suddenly falls asleep/);
});
