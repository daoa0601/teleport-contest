import test from 'node:test';
import assert from 'node:assert/strict';

// C dothrow.c:mhurtle() ends with mintrap(FORCEBUNGLE) when the monster lands
// on a trap.  A monster caught by a web during the flight is already trapped,
// so trap.c:mintrap() gives it the trapped monster's escape roll at once.

import { WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a pony knocked into a web immediately tries to pull free', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pony = await createMonsterAt('pony', 11, 10);
    pony.mhp = 100;
    addTrap(game.level, WEB, 12, 10);
    const messages: string[] = [];

    await hurtleMonster(pony, 1, 0, 1, {
        announce: async message => { messages.push(message); },
        random: () => 0,
    });

    assert.equal(pony.mx, 12);
    assert.equal(pony.mtrapped, 0);
    assert.ok(messages.some(message => /pulls free of the web/u.test(message)),
        messages.join(' | '));
});
