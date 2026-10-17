import test from 'node:test';
import assert from 'node:assert/strict';

// C dothrow.c:will_hurtle() asks goodpos(), whose accessible() test stops a
// knocked-back monster before iron bars even when it could walk through them.

import { IRONBARS, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a newt knocked toward iron bars stays where it was', async () => {
    const level = freshObjectRoom({ heroX: 5, right: 20 });
    requirePlayingGame(game);
    const newt = await createMonsterAt('newt', 12, 10, NO_MINVENT);
    level.requireAt(13, 10).typ = IRONBARS;

    await hurtleMonster(newt, 1, 0, 1, { random: () => 0 });

    assert.equal(newt.mx, 12);
    assert.equal(newt.my, 10);
});
