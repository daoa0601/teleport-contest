import assert from 'node:assert/strict';
import test from 'node:test';
import { dosearch } from '../js/detect.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('searching while swallowed spends a turn looking for the exit without finding outside monsters', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
    installSwallowedHero(worm);
    await createMonsterAt('stalker', game.u.ux + 1, game.u.uy, NO_MINVENT);
    pushKeys(' '.repeat(20));

    await dosearch();

    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'What are you looking for?  The exit?');
});
