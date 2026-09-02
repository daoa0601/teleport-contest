import test from 'node:test';
import assert from 'node:assert/strict';

import { ROCKTRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterRockTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { ROCK } from '../js/object_data.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function monsterOnRockTrap(species) {
    const level = freshObjectRoom({ gameplaySeed: 23n });
    const monster = addMonster({
        species,
        x: 11,
        y: 10,
        hitPoints: 20,
    });
    const trap = addTrap(level, ROCKTRAP, 11, 10);
    return { level, monster, trap };
}

test('a falling-rock trap hits a visible monster and drops its rock',
    async () => {
        const { level, monster, trap } = monsterOnRockTrap('giant');
        const messages = [];

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterRockTrap(action, game, {
            publish: async message => messages.push(message),
        });

        assert.ok(monster.mhp < 20);
        assert.equal(trap.tseen, true);
        assert.ok(floorObjectsAt(level, 11, 10).some(
            object => object.otyp === ROCK,
        ));
        assert.match(messages[0], /is hit by a rock/);
    });

test('a falling rock passes harmlessly through a xorn', async () => {
    const { level, monster } = monsterOnRockTrap('xorn');
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterRockTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mhp, 20);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ROCK,
    ));
    assert.match(messages[0], /is not harmed/);
});
