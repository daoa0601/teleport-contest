import test from 'node:test';
import assert from 'node:assert/strict';

import { PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

function monsterOnPit(species) {
    return freshMonsterTrapRoom(PIT, {
        monster: { species },
    });
}

test('a grounded monster falls into a pit', async () => {
    const { monster, trap } = monsterOnPit('giant');
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        rollOne: () => 3,
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mtrapped, 1);
    assert.equal(monster.mhp, 17);
    assert.equal(trap.tseen, true);
    assert.match(messages[0], /falls into a pit/);
});

test('a flying monster passes over a pit', () => {
    const { monster, trap } = monsterOnPit('red dragon');

    const action = triggerImmediateMonsterTrap(monster, game);

    assert.equal(action.event, null);
    assert.equal(monster.mtrapped ?? 0, 0);
    assert.equal(monster.mhp, 20);
    assert.equal(trap.tseen ?? false, false);
});
