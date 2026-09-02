import test from 'node:test';
import assert from 'node:assert/strict';

import { SLP_GAS_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterSleepGasTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { addTrap } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('sleeping gas puts a susceptible visible monster to sleep', async () => {
    const level = freshObjectRoom({ gameplaySeed: 31n });
    const monster = addMonster({
        species: 'giant',
        x: 11,
        y: 10,
    });
    const trap = addTrap(level, SLP_GAS_TRAP, 11, 10);
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterSleepGasTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mcanmove, 0);
    assert.ok(monster.mfrozen > 0);
    assert.equal(trap.tseen, true);
    assert.match(messages[0], /suddenly falls asleep/);
});
