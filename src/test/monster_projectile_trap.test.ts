import test from 'node:test';
import assert from 'node:assert/strict';

import { ARROW_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { ARROW } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

void test('an arrow trap hits a visible monster', async () => {
    const { level, monster, trap } = await freshMonsterTrapRoom(ARROW_TRAP, {
        gameplaySeed: 1n,
    });
    requirePlayingGame(game);
    const hitPointsBefore = monster.mhp;
    const messages: string[] = [];
    initRng(1n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message: string) => messages.push(message),
    });

    assert.ok(monster.mhp < hitPointsBefore);
    assert.equal(trap.tseen, true);
    assert.equal(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ARROW,
    ), false);
    assert.match(messages[0] ?? '', /is hit by an arrow/);
});

void test('an arrow that misses remains on the floor', async () => {
    const { level, monster } = await freshMonsterTrapRoom(ARROW_TRAP, {
        gameplaySeed: 9n,
    });
    requirePlayingGame(game);
    const hitPointsBefore = monster.mhp;
    const messages: string[] = [];
    initRng(9n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message: string) => messages.push(message),
    });

    assert.equal(monster.mhp, hitPointsBefore);
    assert.ok(floorObjectsAt(level, 11, 10).some(
        object => object.otyp === ARROW,
    ));
    assert.match(messages[0] ?? '', /is almost hit by an arrow/);
});

// C trap.c:thitm() names a seen missile with doname(), so the arrow left on
// the floor is known by appearance.
void test('a seen trap arrow that misses is known by appearance', async () => {
    const { level, monster } = await freshMonsterTrapRoom(ARROW_TRAP, {
        gameplaySeed: 9n,
    });
    requirePlayingGame(game);
    initRng(9n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, { publish: async () => {} });

    const arrow = floorObjectsAt(level, 11, 10).find(object => object.otyp === ARROW);
    assert.equal(arrow?.dknown, true);
});
