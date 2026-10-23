import test from 'node:test';
import assert from 'node:assert/strict';

import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { STATUE } from '../js/object_data.js';
import { animateStatue } from '../js/statue_trap.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a mimic statue that comes to life beside the hero is shown as the mimic', async () => {
    freshObjectRoom();
    const { ux, uy } = game.u;
    const statue = await floorObject(STATUE, ux, uy, { corpsenm: MONSTER_NAME.indexOf('small mimic') });

    const animated = await animateStatue(statue, ux, uy);
    await flush_screen(1);

    assert.ok(animated.monster);
    assert.equal(animated.monster.mnum, MONSTER_NAME.indexOf('small mimic'));
    const { mx, my } = animated.monster;
    assert.notDeepEqual([mx, my], [ux, uy]);
    assert.equal(requireScreenRow(my + 1)[mx - 1]?.ch, 'm');
});
