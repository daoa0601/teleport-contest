import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameLevel } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { EGG } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, scheduleObjectTimer } from '../js/object_timers.js';
import { splitObjectStack } from '../js/object_stack.js';
import { runDueTimers } from '../js/timer_effects.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';

void test('splitting an egg stack preserves native precedence between hatching and rot', async () => {
    freshObjectRoom();
    const input = resetInputState();
    installPagerInput(input, { expected: /hatch/, limit: 3 });
    const egg = await floorObject(EGG, 12, 10, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf('crocodile'), quan: 2,
    });
    const deadline = game.moves + 1;
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, deadline);
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.ROT_ORGANIC, deadline);
    const split = splitObjectStack(egg, 1);
    assert.ok(split);
    game.moves = deadline;

    await runDueTimers();

    const hatchlings = requireGameLevel(game).monsters.filter(
        monster => monster.mnum === MONSTER_NAME.indexOf('baby crocodile'),
    );
    assert.equal(hatchlings.length, 1);
    assert.equal(egg.where, 'gone');
    assert.equal(split.where, 'gone');
});
