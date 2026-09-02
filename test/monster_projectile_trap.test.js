import test from 'node:test';
import assert from 'node:assert/strict';

import { ARROW_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterProjectileTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { ARROW } from '../js/object_data.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function monsterOnArrowTrap(gameplaySeed) {
    const level = freshObjectRoom({ gameplaySeed });
    const monster = addMonster({
        species: 'giant',
        x: 11,
        y: 10,
        hitPoints: 20,
    });
    const trap = addTrap(level, ARROW_TRAP, 11, 10);
    return { level, monster, trap };
}

test('an arrow trap hits a visible monster', async () => {
    const { level, monster, trap } = monsterOnArrowTrap(1n);
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterProjectileTrap(action, game, {
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
    const { level, monster } = monsterOnArrowTrap(9n);
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterProjectileTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mhp, 20);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ARROW,
    ));
    assert.match(messages[0], /is almost hit by an arrow/);
});
