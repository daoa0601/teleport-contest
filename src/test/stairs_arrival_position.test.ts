import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPagerInput } from './support/pager-input.js';

void test('a stair arrival starts the hero movement history on the destination square', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    installPagerInput(resetInputState(), { expected: /stairs/, limit: 2 });

    await rhack('>'.charCodeAt(0));

    assert.equal(game.u.ux0, game.u.ux, 'the previous x coordinate belongs to the new level');
    assert.equal(game.u.uy0, game.u.uy, 'the previous y coordinate belongs to the new level');
});
