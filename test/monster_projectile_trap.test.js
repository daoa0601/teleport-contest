import test from 'node:test';
import assert from 'node:assert/strict';

import { ARROW_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { ARROW } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

test('an arrow trap hits a visible monster', async () => {
    const { level, monster, trap } = freshMonsterTrapRoom(ARROW_TRAP, {
        gameplaySeed: 1n,
    });
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.ok(monster.mhp < 20);
    assert.equal(trap.tseen, true);
    assert.equal(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ARROW,
    ), false);
    assert.match(messages[0], /is hit by an arrow/);
});

test('an arrow that misses remains on the floor', async () => {
    const { level, monster } = freshMonsterTrapRoom(ARROW_TRAP, {
        gameplaySeed: 9n,
    });
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mhp, 20);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ARROW,
    ));
    assert.match(messages[0], /is almost hit by an arrow/);
});
